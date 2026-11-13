export const ERROR_CODES = [
  'INVALID_INPUT',
  'FORBIDDEN',
  'TERMS_REQUIRED',
  'INVALID_URL',
  'UNSUPPORTED_PROTOCOL',
  'BLOCKED_HOST',
  'PRIVATE_VIDEO',
  'LOGIN_REQUIRED',
  'AGE_RESTRICTED',
  'GEO_RESTRICTED',
  'DRM_PROTECTED',
  'UNAVAILABLE',
  'ACCESS_DENIED',
  'RATE_LIMITED',
  'NETWORK',
  'DISK',
  'OUTPUT_PATH_INVALID',
  'FFMPEG_MISSING',
  'YTDLP_MISSING',
  'COOKIES_INVALID',
  'COOKIES_MISSING',
  'COOKIES_UNSUPPORTED',
  'UPDATE_CHECK_FAILED',
  'UPDATE_FAILED',
  'PLAYLIST_EMPTY',
  'PLAYLIST_USE_MAIN',
  'CANCELLED',
  'UNKNOWN'
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export interface PublicError {
  code: ErrorCode
  detail?: string
}

export class AppError extends Error {
  readonly code: ErrorCode
  readonly detail?: string

  constructor(code: ErrorCode, detail?: string, options?: { cause?: unknown }) {
    super(detail ? `${code}: ${detail}` : code)
    this.name = 'AppError'
    this.code = code
    this.detail = detail
    if (options?.cause !== undefined) this.cause = options.cause
  }
}

export function sanitizeDetail(text: string, maxLength = 400): string {
  const cleaned = text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}…` : cleaned
}

export function toPublicError(error: unknown): PublicError {
  if (error instanceof AppError) {
    return error.detail ? { code: error.code, detail: sanitizeDetail(error.detail) } : { code: error.code }
  }
  if (error instanceof Error) {
    return { code: 'UNKNOWN', detail: sanitizeDetail(error.message) }
  }
  return { code: 'UNKNOWN' }
}

const DRM_RE = /drm|digital rights management|widevine|playready|fairplay/i
const FFMPEG_RE = /ffmpeg (?:not found|is not installed|is not available)|ffprobe not found|you have requested merging/i
const COOKIES_RE = /cookies?.*(?:expired|invalid|failed|not found|no longer valid)|failed to decrypt|unsupported browser|--cookies-from-browser.*(?:fail|error)/i
const PRIVATE_RE = /private video|this video is private|video is private/i
const LOGIN_RE = /sign in to confirm|please log in|login required|log in to|only available to (?:premium|members)|authentication required|use --cookies|requires? (?:a )?login|account required|members-only|this video is only available/i
const AGE_RE = /age[- ]restricted|confirm your age|inappropriate for some users/i
const GEO_RE = /not available in your country|geo[- ]?restrict|blocked it in your country|not available in your region|available in your country/i
const RATE_RE = /http error 429|too many requests|rate.?limit/i
const ACCESS_RE = /http error (?:401|403)|access denied|forbidden/i
const NETWORK_RE = /unable to download|getaddrinfo|timed out|timeout|network is unreachable|connection (?:reset|refused|aborted)|temporary failure|ns error|ssl|tls|certificate/i
const DISK_RE = /no space left|permission denied|access is denied|read-only file system|disk full|cannot write/i
const UNAVAILABLE_RE = /video unavailable|this video is unavailable|has been removed|does not exist|no video formats found|requested format is not available|unsupported url|not available|404 not found/i

export function mapYtdlpOutput(output: string): PublicError {
  const detail = sanitizeDetail(output)
  if (DRM_RE.test(output)) return withDetail('DRM_PROTECTED', detail)
  if (COOKIES_RE.test(output)) return withDetail('COOKIES_INVALID', detail)
  if (FFMPEG_RE.test(output)) return withDetail('FFMPEG_MISSING', detail)
  if (PRIVATE_RE.test(output)) return withDetail('PRIVATE_VIDEO', detail)
  if (LOGIN_RE.test(output)) return withDetail('LOGIN_REQUIRED', detail)
  if (AGE_RE.test(output)) return withDetail('AGE_RESTRICTED', detail)
  if (GEO_RE.test(output)) return withDetail('GEO_RESTRICTED', detail)
  if (RATE_RE.test(output)) return withDetail('RATE_LIMITED', detail)
  if (DISK_RE.test(output)) return withDetail('DISK', detail)
  if (NETWORK_RE.test(output)) return withDetail('NETWORK', detail)
  if (ACCESS_RE.test(output)) return withDetail('ACCESS_DENIED', detail)
  if (UNAVAILABLE_RE.test(output)) return withDetail('UNAVAILABLE', detail)
  return withDetail('UNKNOWN', detail)
}

function withDetail(code: ErrorCode, detail: string): PublicError {
  return detail ? { code, detail } : { code }
}

export function isRetryable(code: ErrorCode): boolean {
  return ![
    'DRM_PROTECTED',
    'INVALID_URL',
    'UNSUPPORTED_PROTOCOL',
    'BLOCKED_HOST',
    'TERMS_REQUIRED',
    'FORBIDDEN',
    'INVALID_INPUT'
  ].includes(code)
}
