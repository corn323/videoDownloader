import { describe, expect, it } from 'vitest'
import { isSafeThumbnailUrl, validateUrl } from '@shared/url'
import { buildProbeArgs } from '@shared/args'

describe('validateUrl', () => {
  it('accepts public http and https urls', () => {
    expect(validateUrl('https://www.youtube.com/watch?v=abc').ok).toBe(true)
    expect(validateUrl('http://example.com/video.mp4').ok).toBe(true)
  })

  it('rejects non-web protocols', () => {
    for (const value of [
      'file:///C:/Windows/System32/cmd.exe',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'ftp://example.com/file',
      'smb://server/share'
    ]) {
      const result = validateUrl(value)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.code).toBe('UNSUPPORTED_PROTOCOL')
    }
  })

  it('rejects malformed urls and embedded credentials', () => {
    expect(validateUrl('').ok).toBe(false)
    expect(validateUrl('not a url').ok).toBe(false)
    expect(validateUrl('https://example.com/has space').ok).toBe(false)
    expect(validateUrl('https://user:pass@example.com/video').ok).toBe(false)
    expect(validateUrl('https://example.com/\n--exec')).toMatchObject({ ok: false, code: 'INVALID_URL' })
  })

  it('blocks loopback, private, link-local and single-label hosts', () => {
    for (const value of [
      'http://localhost:8080/',
      'http://127.0.0.1/',
      'http://10.0.0.5/',
      'http://172.16.5.4/',
      'http://192.168.1.1/',
      'http://169.254.169.254/latest/meta-data',
      'http://[::1]/',
      'http://intranet/',
      'http://metadata.google.internal/',
      'http://printer.local/'
    ]) {
      expect(validateUrl(value)).toMatchObject({ ok: false, code: 'BLOCKED_HOST' })
    }
  })

  it('accepts public hostnames that look unusual', () => {
    expect(validateUrl('https://例子.測試/watch').ok).toBe(true)
    expect(validateUrl('https://8.8.8.8/video').ok).toBe(true)
  })

  it('normalizes numeric IPv4 forms before blocking', () => {
    expect(validateUrl('http://2130706433/')).toMatchObject({ ok: false, code: 'BLOCKED_HOST' })
    expect(validateUrl('http://0x7f.1/')).toMatchObject({ ok: false, code: 'BLOCKED_HOST' })
  })

  it('keeps shell metacharacters in the url argument and never as flags', () => {
    const url = 'https://example.com/watch?v=1;rm -rf /&&calc'
    const validation = validateUrl(url)
    expect(validation.ok).toBe(false)
  })
})

describe('buildProbeArgs', () => {
  it('places the url after the option terminator', () => {
    const args = buildProbeArgs('https://example.com/watch?v=123')
    expect(args.at(-2)).toBe('--')
    expect(args.at(-1)).toBe('https://example.com/watch?v=123')
    expect(args.filter((arg) => arg === '--')).toHaveLength(1)
  })

  it('rejects hostile urls before building args', () => {
    expect(() => buildProbeArgs('file:///C:/secret.txt')).toThrow()
    expect(() => buildProbeArgs('--exec=calc')).toThrow()
    expect(() => buildProbeArgs('https://example.com/\u0000')).toThrow()
  })
})

describe('isSafeThumbnailUrl', () => {
  it('allows only http and https thumbnails', () => {
    expect(isSafeThumbnailUrl('https://i.ytimg.com/vi/x/hq.jpg')).toBeTruthy()
    expect(isSafeThumbnailUrl('file:///C:/secret.png')).toBeNull()
    expect(isSafeThumbnailUrl('javascript:alert(1)')).toBeNull()
    expect(isSafeThumbnailUrl('http://127.0.0.1/thumb.png')).toBeNull()
    expect(isSafeThumbnailUrl('http://localhost/thumb.png')).toBeNull()
    expect(isSafeThumbnailUrl(null)).toBeNull()
  })
})
