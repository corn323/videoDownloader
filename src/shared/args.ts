import { AUDIO_FORMATS, BROWSERS, CONTAINERS, MAX_HEIGHT, MIN_HEIGHT } from './constants'
import { AppError } from './errors'
import { isValidSubtitleLangs } from './filename'
import type { BrowserName, Container, DownloadRequest } from './types'
import { validateUrl } from './url'

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/
const ALLOWED_CONCURRENT_FRAGMENTS = new Set([1, 2, 4, 8])

export interface DownloadArgsInput {
  request: DownloadRequest
  outputTemplate: string
  cookiesPath?: string | null
  cookiesBrowser?: BrowserName | null
  ffmpegDir?: string | null
  concurrentFragments?: number
}

export function assertSafeArgumentValue(value: string, label: string): string {
  if (typeof value !== 'string' || !value || value.length > 4096) {
    throw new AppError('INVALID_INPUT', `${label} is invalid`)
  }
  if (CONTROL_CHARS.test(value)) {
    throw new AppError('INVALID_INPUT', `${label} contains control characters`)
  }
  return value
}

export function buildProbeArgs(rawUrl: string): string[] {
  const validation = validateUrl(rawUrl)
  if (!validation.ok) throw new AppError(validation.code, 'url rejected before spawning yt-dlp')
  return [
    '--ignore-config',
    '--no-warnings',
    '--no-color',
    '--no-progress',
    '--socket-timeout',
    '20',
    '--dump-single-json',
    '--flat-playlist',
    '--',
    validation.url.toString()
  ]
}

export function buildVersionArgs(): string[] {
  return ['--ignore-config', '--version']
}

export function buildDownloadArgs(input: DownloadArgsInput): string[] {
  const { request } = input
  const validation = validateUrl(request.url)
  if (!validation.ok) throw new AppError(validation.code, 'url rejected before spawning yt-dlp')

  if (request.mode !== 'video' && request.mode !== 'audio') {
    throw new AppError('INVALID_INPUT', 'invalid download mode')
  }
  if (!(CONTAINERS as readonly string[]).includes(request.container)) {
    throw new AppError('INVALID_INPUT', 'invalid container')
  }
  if (!(AUDIO_FORMATS as readonly string[]).includes(request.audioFormat)) {
    throw new AppError('INVALID_INPUT', 'invalid audio format')
  }
  if (request.height !== null) {
    if (!Number.isInteger(request.height) || request.height < MIN_HEIGHT || request.height > MAX_HEIGHT) {
      throw new AppError('INVALID_INPUT', 'invalid video height')
    }
  }
  if (request.subtitles.enabled && !isValidSubtitleLangs(request.subtitles.langs)) {
    throw new AppError('INVALID_INPUT', 'invalid subtitle language list')
  }

  const concurrentFragments = input.concurrentFragments ?? 4
  if (!ALLOWED_CONCURRENT_FRAGMENTS.has(concurrentFragments)) {
    throw new AppError('INVALID_INPUT', 'invalid concurrent fragments')
  }

  const outputTemplate = assertSafeArgumentValue(input.outputTemplate, 'output template')
  const args: string[] = [
    '--ignore-config',
    '--no-warnings',
    '--no-color',
    '--newline',
    '--progress',
    '--progress-template',
    'download:@@PROGRESS@@%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s|%(progress._percent_str)s',
    '--print',
    'before_dl:@@TITLE@@%(title)s',
    '--print',
    'after_move:@@FILE@@%(filepath)s',
    '--continue',
    '--windows-filenames',
    '--no-mtime',
    '--retries',
    '3',
    '--fragment-retries',
    '3',
    '--concurrent-fragments',
    String(concurrentFragments),
    '--socket-timeout',
    '20',
    '--output',
    outputTemplate
  ]

  if (input.ffmpegDir) {
    args.push('--ffmpeg-location', assertSafeArgumentValue(input.ffmpegDir, 'ffmpeg directory'))
  }

  if (request.mode === 'audio') {
    args.push('--format', 'ba/b', '--extract-audio', '--audio-format', request.audioFormat, '--audio-quality', '0')
  } else {
    args.push('--format', buildFormatSelector(request.height, request.container))
    args.push('--merge-output-format', request.container)
  }

  if (request.subtitles.enabled && request.mode === 'video') {
    args.push(
      '--write-subs',
      '--sub-langs',
      request.subtitles.langs,
      '--convert-subs',
      'srt'
    )
  }

  if (input.cookiesPath) {
    args.push('--cookies', assertSafeArgumentValue(input.cookiesPath, 'cookies path'))
  } else if (input.cookiesBrowser) {
    if (!(BROWSERS as readonly string[]).includes(input.cookiesBrowser)) {
      throw new AppError('INVALID_INPUT', 'invalid browser choice')
    }
    args.push('--cookies-from-browser', input.cookiesBrowser)
  }

  args.push(request.playlist ? '--yes-playlist' : '--no-playlist')
  args.push('--', validation.url.toString())
  return args
}

export function buildFormatSelector(height: number | null, container: Container): string {
  const limit = height === null ? '' : `[height<=${height}]`
  if (container === 'mp4') {
    return `bv*[ext=mp4]${limit}+ba[ext=m4a]/b[ext=mp4]${limit}/bv*${limit}+ba/b${limit}`
  }
  if (container === 'webm') {
    return `bv*[ext=webm]${limit}+ba[ext=webm]/b[ext=webm]${limit}/bv*${limit}+ba/b${limit}`
  }
  return `bv*${limit}+ba/b${limit}`
}
