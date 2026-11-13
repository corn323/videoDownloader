import { describe, expect, it } from 'vitest'
import { AppError, isRetryable, mapYtdlpOutput, sanitizeDetail, toPublicError } from '@shared/errors'

describe('mapYtdlpOutput', () => {
  it('recognizes DRM and never suggests retrying', () => {
    const error = mapYtdlpOutput('ERROR: [example] abc: This video is DRM protected by Widevine.')
    expect(error.code).toBe('DRM_PROTECTED')
    expect(isRetryable(error.code)).toBe(false)
  })

  it('maps common failure modes to human-readable codes', () => {
    expect(mapYtdlpOutput('ERROR: Private video. Sign in if you have been granted access').code).toBe('PRIVATE_VIDEO')
    expect(mapYtdlpOutput('ERROR: Please log in to view this video').code).toBe('LOGIN_REQUIRED')
    expect(mapYtdlpOutput('ERROR: This video is age-restricted').code).toBe('AGE_RESTRICTED')
    expect(mapYtdlpOutput('ERROR: The uploader has not made this video available in your country').code).toBe('GEO_RESTRICTED')
    expect(mapYtdlpOutput('ERROR: HTTP Error 429: Too Many Requests').code).toBe('RATE_LIMITED')
    expect(mapYtdlpOutput('ERROR: HTTP Error 403: Forbidden').code).toBe('ACCESS_DENIED')
    expect(mapYtdlpOutput('ERROR: Video unavailable').code).toBe('UNAVAILABLE')
    expect(mapYtdlpOutput('ERROR: You have requested merging of multiple formats but ffmpeg is not installed').code).toBe('FFMPEG_MISSING')
    expect(mapYtdlpOutput('ERROR: cookies are no longer valid').code).toBe('COOKIES_INVALID')
    expect(mapYtdlpOutput('ERROR: unable to download: timed out').code).toBe('NETWORK')
    expect(mapYtdlpOutput('ERROR: No space left on device').code).toBe('DISK')
  })

  it('falls back to UNKNOWN with a truncated detail', () => {
    const error = mapYtdlpOutput(`some strange failure ${'x'.repeat(1000)}`)
    expect(error.code).toBe('UNKNOWN')
    expect(error.detail?.length).toBeLessThanOrEqual(401)
  })
})

describe('error serialization', () => {
  it('serializes AppError without stack traces', () => {
    const error = toPublicError(new AppError('BLOCKED_HOST', 'private address'))
    expect(error).toEqual({ code: 'BLOCKED_HOST', detail: 'private address' })
    expect(JSON.stringify(error)).not.toContain('at ')
  })

  it('strips control characters from details', () => {
    expect(sanitizeDetail('line1\u0000\nline2')).toBe('line1 line2')
  })

  it('does not mark security refusals as retryable', () => {
    expect(isRetryable('DRM_PROTECTED')).toBe(false)
    expect(isRetryable('INVALID_URL')).toBe(false)
    expect(isRetryable('NETWORK')).toBe(true)
  })
})
