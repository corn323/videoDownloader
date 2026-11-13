import { describe, expect, it } from 'vitest'
import { isNetscapeCookiesFile } from '@shared/cookies'
import { isSha256Hex, parseChecksumFile } from '@shared/checksum'

describe('isNetscapeCookiesFile', () => {
  const valid = [
    '# Netscape HTTP Cookie File',
    '.example.com\tTRUE\t/\tTRUE\t1999999999\tsession\tabc',
    '#HttpOnly_.example.com\tTRUE\t/\tTRUE\t1999999999\thttpOnly\txyz'
  ].join('\n')

  it('accepts a normal netscape cookies file', () => {
    expect(isNetscapeCookiesFile(valid)).toBe(true)
  })

  it('rejects binary, empty and malformed files', () => {
    expect(isNetscapeCookiesFile('')).toBe(false)
    expect(isNetscapeCookiesFile('not a cookie file')).toBe(false)
    expect(isNetscapeCookiesFile('a\u0000b')).toBe(false)
    expect(isNetscapeCookiesFile('one\ttwo\tthree')).toBe(false)
  })

  it('rejects files without any cookie rows', () => {
    expect(isNetscapeCookiesFile('# Netscape HTTP Cookie File\n# comment only')).toBe(false)
  })
})

describe('parseChecksumFile', () => {
  const hash = 'a'.repeat(64)
  const otherHash = 'b'.repeat(64)

  it('parses GNU style checksum files', () => {
    const text = `${otherHash}  ffmpeg.exe\n${hash} *yt-dlp.exe\n`
    expect(parseChecksumFile(text, 'yt-dlp.exe')).toBe(hash)
    expect(parseChecksumFile(text, 'missing.exe')).toBeNull()
  })

  it('parses BSD style checksum files', () => {
    expect(parseChecksumFile(`SHA256 (yt-dlp.exe) = ${hash}`, 'yt-dlp.exe')).toBe(hash)
  })

  it('validates hash shape', () => {
    expect(isSha256Hex(hash)).toBe(true)
    expect(isSha256Hex('zz')).toBe(false)
  })
})
