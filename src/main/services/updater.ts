import { createHash, timingSafeEqual } from 'node:crypto'
import { MAX_YTDLP_DOWNLOAD_BYTES, YTDLP_ALLOWED_HOSTS, YTDLP_RELEASE_API } from '@shared/constants'
import { parseChecksumFile } from '@shared/checksum'
import { AppError, sanitizeDetail } from '@shared/errors'
import type { UpdateProgress, YtDlpUpdateInfo } from '@shared/types'
import type { BinaryService } from './binaries'

const USER_AGENT = 'Vela/0.1.0 (+https://github.com)'
const API_TIMEOUT_MS = 20_000
const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000
const MAX_SUMS_BYTES = 2 * 1024 * 1024

interface ReleaseAsset {
  name: string
  url: string
  size: number | null
}

interface ReleaseDetails {
  tag: string
  htmlUrl: string
  notes: string | null
  assets: ReleaseAsset[]
}

export type UpdateProgressListener = (progress: UpdateProgress) => void

export class YtDlpUpdater {
  private cached: YtDlpUpdateInfo | null = null
  private release: ReleaseDetails | null = null

  constructor(private readonly binaries: BinaryService) {}

  getCached(): YtDlpUpdateInfo | null {
    return this.cached
  }

  async check(): Promise<YtDlpUpdateInfo> {
    const details = await this.fetchLatestRelease()
    const current = await this.binaries.getVersion(true)
    const available = isNewerVersion(details.tag, current)
    const info: YtDlpUpdateInfo = {
      available,
      currentVersion: current,
      latestVersion: details.tag,
      releaseUrl: details.htmlUrl,
      notes: details.notes
    }
    this.release = details
    this.cached = info
    return info
  }

  async apply(onProgress: UpdateProgressListener): Promise<YtDlpUpdateInfo> {
    const info = await this.check()
    if (!info.available) {
      throw new AppError('UPDATE_FAILED', 'the installed yt-dlp is already up to date')
    }
    const details = this.release
    if (!details) throw new AppError('UPDATE_FAILED', 'release metadata is unavailable')

    const exeAsset = details.assets.find((asset) => asset.name === 'yt-dlp.exe')
    const sumsAsset = details.assets.find((asset) => asset.name === 'SHA2-256SUMS')
    if (!exeAsset || !sumsAsset) {
      throw new AppError('UPDATE_FAILED', 'the release is missing the executable or checksum file')
    }

    const sumsText = await fetchText(sumsAsset.url, MAX_SUMS_BYTES)
    const expected = parseChecksumFile(sumsText, 'yt-dlp.exe')
    if (!expected) {
      throw new AppError('UPDATE_FAILED', 'checksums file does not contain yt-dlp.exe')
    }

    const executable = await downloadToBuffer(exeAsset.url, exeAsset.size, (received, total) => {
      onProgress({ phase: 'downloading', receivedBytes: received, totalBytes: total })
    })

    onProgress({ phase: 'verifying', receivedBytes: executable.length, totalBytes: executable.length })
    const actual = createHash('sha256').update(executable).digest('hex')
    if (!safeHashEqual(actual, expected)) {
      throw new AppError('UPDATE_FAILED', 'SHA256 verification failed; the old version was kept')
    }

    onProgress({ phase: 'installing', receivedBytes: executable.length, totalBytes: executable.length })
    await this.binaries.installManagedVerified(executable)
    const nextInfo: YtDlpUpdateInfo = {
      ...info,
      available: false,
      currentVersion: await this.binaries.getVersion(true)
    }
    this.cached = nextInfo
    return nextInfo
  }

  private async fetchLatestRelease(): Promise<ReleaseDetails> {
    let response: Response
    try {
      response = await fetchAllowed(YTDLP_RELEASE_API, API_TIMEOUT_MS, {
        accept: 'application/vnd.github+json'
      })
    } catch (error) {
      throw new AppError('UPDATE_CHECK_FAILED', `GitHub release lookup failed: ${describeFetchError(error)}`)
    }
    if (!response.ok) {
      throw new AppError('UPDATE_CHECK_FAILED', `GitHub API returned HTTP ${response.status}`)
    }
    let json: unknown
    try {
      json = await response.json()
    } catch {
      throw new AppError('UPDATE_CHECK_FAILED', 'GitHub API returned malformed JSON')
    }
    if (!json || typeof json !== 'object') {
      throw new AppError('UPDATE_CHECK_FAILED', 'GitHub API returned an unexpected response')
    }
    const release = json as Record<string, unknown>
    const tag = typeof release.tag_name === 'string' ? release.tag_name.trim() : ''
    const htmlUrl = typeof release.html_url === 'string' ? release.html_url : ''
    if (!tag || !/^[0-9A-Za-z._-]{1,40}$/.test(tag)) {
      throw new AppError('UPDATE_CHECK_FAILED', 'release tag is missing or invalid')
    }
    if (!isAllowedReleasePage(htmlUrl)) {
      throw new AppError('UPDATE_CHECK_FAILED', 'release page URL is not trusted')
    }

    const assets: ReleaseAsset[] = []
    if (Array.isArray(release.assets)) {
      for (const item of release.assets) {
        if (!item || typeof item !== 'object') continue
        const asset = item as Record<string, unknown>
        const name = typeof asset.name === 'string' ? asset.name : ''
        const url = typeof asset.browser_download_url === 'string' ? asset.browser_download_url : ''
        if (!name || !url || !isAllowedDownloadUrl(url)) continue
        assets.push({
          name,
          url,
          size: typeof asset.size === 'number' && Number.isFinite(asset.size) ? asset.size : null
        })
      }
    }

    const notes =
      typeof release.body === 'string' ? sanitizeDetail(release.body, 1500) : null

    return {
      tag,
      htmlUrl,
      notes,
      assets
    }
  }
}

export function isNewerVersion(latest: string | null, current: string | null): boolean {
  if (!latest) return false
  if (!current) return true
  if (latest === current) return false
  const latestDate = parseDateVersion(latest)
  const currentDate = parseDateVersion(current)
  if (latestDate !== null && currentDate !== null) return latestDate > currentDate
  return false
}

function parseDateVersion(value: string): number | null {
  const match = /^(\d{4})\.(\d{2})\.(\d{2})/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  return year * 10000 + month * 100 + day
}

function safeHashEqual(actual: string, expected: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(actual) || !/^[0-9a-f]{64}$/i.test(expected)) return false
  const a = Buffer.from(actual.toLowerCase(), 'hex')
  const b = Buffer.from(expected.toLowerCase(), 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return YTDLP_ALLOWED_HOSTS.includes(host) || host.endsWith('.githubusercontent.com')
}

function isAllowedDownloadUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && isAllowedHost(url.hostname)
  } catch {
    return false
  }
}

function isAllowedReleasePage(raw: string): boolean {
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && url.hostname.toLowerCase() === 'github.com'
  } catch {
    return false
  }
}

async function fetchAllowed(
  rawUrl: string,
  timeoutMs: number,
  options: { accept?: string } = {}
): Promise<Response> {
  let current = new URL(rawUrl)
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (!isAllowedDownloadUrl(current.toString())) {
      throw new AppError('UPDATE_FAILED', 'download URL is not on the allowlist')
    }
    const response = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'User-Agent': USER_AGENT,
        Accept: options.accept ?? 'application/octet-stream'
      }
    })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      await response.body?.cancel().catch(() => undefined)
      if (!location) throw new AppError('UPDATE_FAILED', 'redirect without a location header')
      current = new URL(location, current)
      continue
    }
    return response
  }
  throw new AppError('UPDATE_FAILED', 'too many redirects while downloading')
}

async function fetchText(rawUrl: string, maxBytes: number): Promise<string> {
  let response: Response
  try {
    response = await fetchAllowed(rawUrl, API_TIMEOUT_MS, { accept: 'text/plain' })
  } catch (error) {
    throw new AppError('UPDATE_FAILED', `checksum download failed: ${describeFetchError(error)}`)
  }
  if (!response.ok) throw new AppError('UPDATE_FAILED', `checksum download returned HTTP ${response.status}`)
  const buffer = await readBody(response, maxBytes, () => undefined)
  return buffer.toString('utf8')
}

async function downloadToBuffer(
  rawUrl: string,
  declaredSize: number | null,
  onChunk: (received: number, total: number | null) => void
): Promise<Buffer> {
  let response: Response
  try {
    response = await fetchAllowed(rawUrl, DOWNLOAD_TIMEOUT_MS)
  } catch (error) {
    throw new AppError('UPDATE_FAILED', `yt-dlp download failed: ${describeFetchError(error)}`)
  }
  if (!response.ok) throw new AppError('UPDATE_FAILED', `yt-dlp download returned HTTP ${response.status}`)
  const contentLength = Number(response.headers.get('content-length'))
  const total = Number.isFinite(contentLength) && contentLength > 0 ? contentLength : declaredSize
  if (total !== null && total > MAX_YTDLP_DOWNLOAD_BYTES) {
    await response.body?.cancel().catch(() => undefined)
    throw new AppError('UPDATE_FAILED', 'yt-dlp download exceeds the size limit')
  }
  return readBody(response, MAX_YTDLP_DOWNLOAD_BYTES, onChunk, total)
}

async function readBody(
  response: Response,
  maxBytes: number,
  onChunk: (received: number, total: number | null) => void,
  total: number | null = null
): Promise<Buffer> {
  const body = response.body
  if (!body) throw new AppError('UPDATE_FAILED', 'download response had no body')
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  let lastEmit = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      received += value.byteLength
      if (received > maxBytes) {
        await reader.cancel().catch(() => undefined)
        throw new AppError('UPDATE_FAILED', 'download exceeded the size limit')
      }
      chunks.push(value)
      const now = Date.now()
      if (now - lastEmit > 200) {
        lastEmit = now
        onChunk(received, total)
      }
    }
  } finally {
    reader.releaseLock()
  }
  onChunk(received, total ?? received)
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
}

function describeFetchError(error: unknown): string {
  if (error instanceof AppError) return error.detail ?? error.code
  if (error instanceof Error) return sanitizeDetail(error.message)
  return 'network error'
}
