import fs from 'node:fs'
import path from 'node:path'
import { buildDownloadArgs, buildProbeArgs } from '@shared/args'
import { AppError, mapYtdlpOutput, sanitizeDetail } from '@shared/errors'
import { assertPathInside } from '@shared/paths'
import { parseMarkedValue, parseProgressLine, type ParsedProgress } from '@shared/progress'
import type { BrowserName, DownloadRequest, PlaylistEntry, VideoFormat, VideoInfo } from '@shared/types'
import { isSafeThumbnailUrl, validateUrl } from '@shared/url'
import type { BinaryService } from './binaries'
import { runProcess } from './process'

const PROBE_TIMEOUT_MS = 60_000
const DOWNLOAD_TIMEOUT_MS = 12 * 60 * 60 * 1000
const MAX_PROBE_BYTES = 32 * 1024 * 1024
const SUBTITLE_EXTS = new Set(['.srt', '.vtt', '.ass', '.ssa', '.lrc', '.json3', '.ttml'])

export interface DownloadCallbacks {
  onProgress: (progress: ParsedProgress) => void
  onTitle: (title: string) => void
  onPhase: (phase: 'merging') => void
}

export interface DownloadInput {
  request: DownloadRequest
  outputDir: string
  outputTemplate: string
  cookiesPath: string | null
  cookiesBrowser: BrowserName | null
  ffmpegDir: string | null
  concurrentFragments: number
  signal: AbortSignal
}

export class YtDlpService {
  constructor(private readonly binaries: BinaryService) {}

  async probe(rawUrl: string, signal?: AbortSignal): Promise<VideoInfo> {
    const exe = this.binaries.getYtDlpPath()
    if (!exe) throw new AppError('YTDLP_MISSING', 'yt-dlp executable was not found')
    const result = await runProcess(exe, buildProbeArgs(rawUrl), {
      timeoutMs: PROBE_TIMEOUT_MS,
      maxBufferBytes: MAX_PROBE_BYTES,
      missingCode: 'YTDLP_MISSING',
      signal
    })
    const combined = `${result.stderr}\n${result.stdout}`
    if (result.aborted) throw new AppError('CANCELLED')
    if (result.timedOut) throw new AppError('NETWORK', 'yt-dlp analysis timed out')
    if (result.overflow) throw new AppError('UNKNOWN', 'yt-dlp output exceeded the size limit')
    if (result.code !== 0) {
      const mapped = mapYtdlpOutput(combined)
      throw new AppError(mapped.code, mapped.detail)
    }

    let raw: RawInfo
    try {
      raw = JSON.parse(result.stdout) as RawInfo
    } catch {
      throw new AppError('UNKNOWN', 'yt-dlp returned malformed metadata')
    }
    if (!raw || typeof raw !== 'object') throw new AppError('UNKNOWN', 'yt-dlp returned empty metadata')
    if (raw._has_drm === true || raw.has_drm === true) {
      throw new AppError('DRM_PROTECTED', 'this content reports DRM protection')
    }

    const isPlaylist = raw._type === 'playlist' || (Array.isArray(raw.entries) && raw.entries.length > 0)
    if (isPlaylist) {
      const entries = normalizeEntries(raw.entries)
      if (entries.length === 0) {
        throw new AppError('PLAYLIST_EMPTY', 'the playlist contains no downloadable public entries')
      }
      return {
        url: canonicalUrl(rawUrl),
        id: asString(raw.id),
        title: cleanText(raw.title, 500) || 'Playlist',
        uploader: cleanText(raw.uploader, 200),
        duration: null,
        thumbnail: pickThumbnail(raw),
        isPlaylist: true,
        playlistCount: asInteger(raw.playlist_count) ?? entries.length,
        entries,
        formats: [],
        heights: [],
        isLive: false,
        ageLimit: null
      }
    }

    const formats = normalizeFormats(raw.formats)
    const heights = Array.from(
      new Set(
        formats
          .filter((format) => format.hasVideo && format.height && format.height > 0)
          .map((format) => format.height as number)
      )
    )
      .sort((a, b) => b - a)
      .slice(0, 20)

    return {
      url: canonicalUrl(rawUrl),
      id: asString(raw.id),
      title: cleanText(raw.title, 500) || 'Untitled',
      uploader: cleanText(raw.uploader, 200),
      duration: asFiniteNumber(raw.duration),
      thumbnail: pickThumbnail(raw),
      isPlaylist: false,
      playlistCount: 1,
      entries: [],
      formats,
      heights,
      isLive: raw.is_live === true || raw.live_status === 'is_live',
      ageLimit: asInteger(raw.age_limit)
    }
  }

  async download(input: DownloadInput, callbacks: DownloadCallbacks): Promise<{ outputPath: string | null }> {
    const exe = this.binaries.getYtDlpPath()
    if (!exe) throw new AppError('YTDLP_MISSING', 'yt-dlp executable was not found')
    assertPathInside(input.outputDir, input.outputTemplate)

    const args = buildDownloadArgs({
      request: input.request,
      outputTemplate: input.outputTemplate,
      cookiesPath: input.cookiesPath,
      cookiesBrowser: input.cookiesBrowser,
      ffmpegDir: input.ffmpegDir,
      concurrentFragments: input.concurrentFragments
    })

    let outputPath: string | null = null
    const result = await runProcess(exe, args, {
      timeoutMs: DOWNLOAD_TIMEOUT_MS,
      maxBufferBytes: 1024 * 1024,
      captureStdout: false,
      signal: input.signal,
      missingCode: 'YTDLP_MISSING',
      onStdoutLine: (line) => {
        const progress = parseProgressLine(line)
        if (progress) callbacks.onProgress(progress)
        const title = parseMarkedValue(line, '@@TITLE@@')
        if (title) {
          const cleanedTitle = cleanText(title, 500)
          if (cleanedTitle) callbacks.onTitle(cleanedTitle)
        }
        const file = parseMarkedValue(line, '@@FILE@@')
        if (file && !SUBTITLE_EXTS.has(path.extname(file).toLowerCase())) {
          try {
            const resolved = assertPathInside(input.outputDir, file)
            if (fs.existsSync(resolved)) outputPath = resolved
          } catch {
            outputPath = null
          }
        }
        if (/^\[(?:Merger|VideoConvertor|ExtractAudio|VideoRemuxer|FixupM3u8)\]/.test(line)) {
          callbacks.onPhase('merging')
        }
      }
    })

    if (result.aborted) throw new AppError('CANCELLED')
    if (result.timedOut) throw new AppError('NETWORK', 'the download timed out')
    if (result.code !== 0) {
      const mapped = mapYtdlpOutput(`${result.stderr}\n${result.stdout}`)
      throw new AppError(mapped.code, mapped.detail)
    }
    return { outputPath }
  }
}

interface RawFormat {
  format_id?: unknown
  ext?: unknown
  height?: unknown
  width?: unknown
  fps?: unknown
  vcodec?: unknown
  acodec?: unknown
  filesize?: unknown
  filesize_approx?: unknown
  tbr?: unknown
  format_note?: unknown
}

interface RawInfo {
  id?: unknown
  title?: unknown
  uploader?: unknown
  duration?: unknown
  thumbnail?: unknown
  thumbnails?: unknown
  is_live?: unknown
  live_status?: unknown
  age_limit?: unknown
  _type?: unknown
  entries?: unknown
  formats?: unknown
  playlist_count?: unknown
  _has_drm?: unknown
  has_drm?: unknown
  webpage_url?: unknown
  url?: unknown
}

function normalizeFormats(value: unknown): VideoFormat[] {
  if (!Array.isArray(value)) return []
  const formats: VideoFormat[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const raw = item as RawFormat
    const formatId = asString(raw.format_id)
    const ext = asString(raw.ext)
    if (!formatId || !ext) continue
    const vcodec = asString(raw.vcodec)
    const acodec = asString(raw.acodec)
    formats.push({
      formatId,
      ext,
      height: asInteger(raw.height),
      width: asInteger(raw.width),
      fps: asFiniteNumber(raw.fps),
      vcodec,
      acodec,
      filesize: asFiniteNumber(raw.filesize) ?? asFiniteNumber(raw.filesize_approx),
      tbr: asFiniteNumber(raw.tbr),
      hasVideo: Boolean(vcodec && vcodec !== 'none'),
      hasAudio: Boolean(acodec && acodec !== 'none'),
      note: cleanText(raw.format_note, 100)
    })
    if (formats.length >= 150) break
  }
  return formats
}

function normalizeEntries(value: unknown): PlaylistEntry[] {
  if (!Array.isArray(value)) return []
  const entries: PlaylistEntry[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const raw = item as RawInfo & { webpage_url?: unknown; thumbnails?: unknown }
    const candidate =
      asString(raw.webpage_url) ??
      asString(raw.url) ??
      (typeof (item as { url?: unknown }).url === 'string' ? ((item as { url: string }).url) : null)
    if (!candidate) continue
    const validation = validateUrl(candidate)
    if (!validation.ok) continue
    const normalized = validation.url.toString()
    if (seen.has(normalized)) continue
    seen.add(normalized)
    entries.push({
      url: normalized,
      title: cleanText(raw.title, 300) || normalized,
      id: asString(raw.id),
      duration: asFiniteNumber(raw.duration),
      thumbnail: pickThumbnail(raw as unknown as RawInfo)
    })
    if (entries.length >= 200) break
  }
  return entries
}

function pickThumbnail(raw: RawInfo): string | null {
  const direct = isSafeThumbnailUrl(raw.thumbnail)
  if (direct) return direct
  if (Array.isArray(raw.thumbnails)) {
    let best: string | null = null
    let bestWidth = -1
    for (const item of raw.thumbnails) {
      if (!item || typeof item !== 'object') continue
      const thumb = item as { url?: unknown; width?: unknown }
      const url = isSafeThumbnailUrl(thumb.url)
      if (!url) continue
      const width = asInteger(thumb.width) ?? 0
      if (width >= bestWidth) {
        best = url
        bestWidth = width
      }
    }
    return best
  }
  return null
}

function canonicalUrl(raw: string): string {
  const validation = validateUrl(raw)
  return validation.ok ? validation.url.toString() : raw
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asFiniteNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(parsed) ? parsed : null
}

function asInteger(value: unknown): number | null {
  const parsed = asFiniteNumber(value)
  return parsed !== null && Number.isInteger(parsed) ? parsed : null
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const cleaned = sanitizeDetail(value, maxLength)
  return cleaned || null
}
