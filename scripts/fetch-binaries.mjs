import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'

const ROOT = path.resolve(import.meta.dirname, '..')
const BIN_DIR = path.join(ROOT, 'resources', 'bin')
const VERSIONS_FILE = path.join(BIN_DIR, 'VERSIONS.json')
const FORCE = process.argv.includes('--force')

const YTDLP_RELEASE_API = 'https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest'
const FFMPEG_RELEASE_API = 'https://api.github.com/repos/BtbN/FFmpeg-Builds/releases/latest'
const FFMPEG_ASSET = 'ffmpeg-master-latest-win64-lgpl.zip'

const MAX_YTDLP_BYTES = 200 * 1024 * 1024
const MAX_FFMPEG_BYTES = 400 * 1024 * 1024

function apiHeaders() {
  const headers = {
    accept: 'application/vnd.github+json',
    'user-agent': 'vela-fetch-build'
  }
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  return headers
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: apiHeaders(),
    signal: AbortSignal.timeout(60_000)
  })
  if (!response.ok) throw new Error(`GitHub API ${response.status} for ${url}`)
  return response.json()
}

async function fetchText(url, maxBytes = 128 * 1024) {
  const response = await fetch(url, {
    headers: apiHeaders(),
    signal: AbortSignal.timeout(60_000)
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  const length = Number(response.headers.get('content-length') ?? 0)
  if (length > maxBytes) throw new Error(`response too large for ${url}`)
  const text = await response.text()
  if (Buffer.byteLength(text) > maxBytes) throw new Error(`response too large for ${url}`)
  return text
}

async function downloadVerified(url, destination, expectedHash, maxBytes) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'vela-fetch-build' },
    signal: AbortSignal.timeout(15 * 60_000)
  })
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status} for ${url}`)
  const length = Number(response.headers.get('content-length') ?? 0)
  if (length > maxBytes) throw new Error(`download exceeds size limit: ${url}`)

  await fsp.mkdir(path.dirname(destination), { recursive: true })
  const temporary = `${destination}.part`
  const handle = await fsp.open(temporary, 'w')
  const hash = createHash('sha256')
  let received = 0
  try {
    for await (const chunk of Readable.fromWeb(response.body)) {
      received += chunk.length
      if (received > maxBytes) throw new Error(`download exceeds size limit: ${url}`)
      hash.update(chunk)
      await handle.write(chunk)
    }
  } catch (error) {
    await handle.close()
    await fsp.rm(temporary, { force: true })
    throw error
  }
  await handle.close()

  const actual = hash.digest('hex')
  if (actual !== expectedHash.toLowerCase()) {
    await fsp.rm(temporary, { force: true })
    throw new Error(`SHA256 mismatch for ${path.basename(destination)}: expected ${expectedHash}, got ${actual}`)
  }
  await fsp.rename(temporary, destination)
  return { sha256: actual, bytes: received }
}

function parseChecksums(text) {
  const map = new Map()
  for (const line of text.split(/\r?\n/)) {
    const match = /^([a-fA-F0-9]{64})\s+\*?(.+?)\s*$/.exec(line)
    if (match) map.set(path.basename(match[2]), match[1].toLowerCase())
  }
  return map
}

async function fetchYtDlp(metadata) {
  const destination = path.join(BIN_DIR, 'yt-dlp.exe')
  if (!FORCE && fs.existsSync(destination)) {
    console.log('yt-dlp.exe already present, skipping (use --force to refresh)')
    return
  }
  console.log('Resolving latest yt-dlp release...')
  const release = await fetchJson(YTDLP_RELEASE_API)
  const asset = (release.assets ?? []).find((item) => item.name === 'yt-dlp.exe')
  const sumsAsset = (release.assets ?? []).find((item) => item.name === 'SHA2-256SUMS')
  if (!asset || !sumsAsset) throw new Error('yt-dlp release does not contain yt-dlp.exe or SHA2-256SUMS')

  const sums = parseChecksums(await fetchText(sumsAsset.browser_download_url))
  const expected = sums.get('yt-dlp.exe')
  if (!expected) throw new Error('yt-dlp.exe missing from SHA2-256SUMS')

  console.log(`Downloading yt-dlp ${release.tag_name}...`)
  const result = await downloadVerified(asset.browser_download_url, destination, expected, MAX_YTDLP_BYTES)
  metadata.ytDlp = {
    version: release.tag_name,
    source: asset.browser_download_url,
    checksums: sumsAsset.browser_download_url,
    sha256: result.sha256,
    bytes: result.bytes
  }
  console.log(`yt-dlp ${release.tag_name} verified (${result.sha256.slice(0, 12)}...)`)
}

function extractFfmpeg(zipPath) {
  if (process.platform !== 'win32') {
    throw new Error('ffmpeg extraction currently requires Windows PowerShell')
  }
  const script = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($env:VELA_ZIP)
try {
  foreach ($entry in $zip.Entries) {
    if ($entry.FullName -match '(^|/)bin/ffmpeg\.exe$') {
      [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, (Join-Path $env:VELA_BIN 'ffmpeg.exe'), $true)
    } elseif ($entry.FullName -match '(^|/)bin/ffprobe\.exe$') {
      [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, (Join-Path $env:VELA_BIN 'ffprobe.exe'), $true)
    } elseif ($entry.Name -match '^(LICENSE|COPYING)') {
      [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, (Join-Path $env:VELA_BIN ('FFMPEG_' + $entry.Name)), $true)
    }
  }
} finally {
  $zip.Dispose()
}
`
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    {
      stdio: 'inherit',
      env: { ...process.env, VELA_ZIP: zipPath, VELA_BIN: BIN_DIR }
    }
  )
  if (result.status !== 0) throw new Error(`ffmpeg extraction failed with exit code ${result.status}`)
}

async function fetchFfmpeg(metadata) {
  const ffmpegPath = path.join(BIN_DIR, 'ffmpeg.exe')
  const ffprobePath = path.join(BIN_DIR, 'ffprobe.exe')
  if (!FORCE && fs.existsSync(ffmpegPath) && fs.existsSync(ffprobePath)) {
    console.log('ffmpeg.exe and ffprobe.exe already present, skipping (use --force to refresh)')
    return
  }
  console.log('Resolving latest LGPL ffmpeg build...')
  const release = await fetchJson(FFMPEG_RELEASE_API)
  const asset = (release.assets ?? []).find((item) => item.name === FFMPEG_ASSET)
  const sumsAsset = (release.assets ?? []).find((item) => item.name === 'checksums.sha256')
  if (!asset || !sumsAsset) throw new Error(`ffmpeg release does not contain ${FFMPEG_ASSET} or checksums.sha256`)

  const sums = parseChecksums(await fetchText(sumsAsset.browser_download_url))
  const expected = sums.get(FFMPEG_ASSET)
  if (!expected) throw new Error(`${FFMPEG_ASSET} missing from checksums.sha256`)

  const temporaryZip = path.join(os.tmpdir(), `vela-${FFMPEG_ASSET}`)
  console.log(`Downloading ${FFMPEG_ASSET} (${Math.round(asset.size / 1024 / 1024)} MB)...`)
  try {
    const result = await downloadVerified(asset.browser_download_url, temporaryZip, expected, MAX_FFMPEG_BYTES)
    extractFfmpeg(temporaryZip)
    metadata.ffmpeg = {
      version: release.tag_name,
      source: asset.browser_download_url,
      checksums: sumsAsset.browser_download_url,
      sha256: result.sha256,
      bytes: result.bytes,
      license: 'LGPL-2.1-or-later'
    }
    console.log(`ffmpeg ${release.tag_name} verified (${result.sha256.slice(0, 12)}...)`)
  } finally {
    await fsp.rm(temporaryZip, { force: true })
  }
  if (!fs.existsSync(ffmpegPath) || !fs.existsSync(ffprobePath)) {
    throw new Error('ffmpeg package did not contain the expected executables')
  }
}

function readExistingMetadata() {
  try {
    return JSON.parse(fs.readFileSync(VERSIONS_FILE, 'utf8'))
  } catch {
    return {}
  }
}

await fsp.mkdir(BIN_DIR, { recursive: true })
const metadata = readExistingMetadata()
metadata.generatedAt = new Date().toISOString()

await fetchYtDlp(metadata)
await fetchFfmpeg(metadata)

await fsp.writeFile(VERSIONS_FILE, `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o644 })
console.log('Binaries are ready in resources/bin')
