import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildDownloadArgs, buildFormatSelector } from '@shared/args'
import type { DownloadRequest } from '@shared/types'

const outputTemplate = path.join('C:/Users/Test/Downloads/Vela', 'video.%(ext)s')

function makeRequest(overrides: Partial<DownloadRequest> = {}): DownloadRequest {
  return {
    url: 'https://example.com/watch?v=abc',
    mode: 'video',
    height: 1080,
    container: 'mp4',
    audioFormat: 'mp3',
    subtitles: { enabled: false, langs: 'zh-Hant,en' },
    playlist: false,
    ...overrides
  }
}

describe('buildDownloadArgs', () => {
  it('keeps the url after the terminator, has no --no-input, and uses no shell syntax', () => {
    const args = buildDownloadArgs({ request: makeRequest(), outputTemplate })
    expect(args.at(-2)).toBe('--')
    expect(args.at(-1)).toBe('https://example.com/watch?v=abc')
    expect(args).not.toContain('--no-input')
    expect(args.every((arg) => typeof arg === 'string')).toBe(true)
  })

  it('keeps query metacharacters entirely inside the url argument', () => {
    const url = 'https://example.com/watch?v=1;rm%20-rf%20/&x=--exec'
    const args = buildDownloadArgs({ request: makeRequest({ url }), outputTemplate })
    expect(args.at(-1)).toBe(url)
    expect(args).not.toContain('--exec')
    expect(args).not.toContain(';rm')
  })

  it('builds video selectors for each container', () => {
    expect(buildFormatSelector(1080, 'mp4')).toContain('bv*[ext=mp4][height<=1080]+ba[ext=m4a]')
    expect(buildFormatSelector(720, 'webm')).toContain('bv*[ext=webm][height<=720]+ba[ext=webm]')
    expect(buildFormatSelector(null, 'mkv')).toBe('bv*+ba/b')
  })

  it('adds audio extraction options and suppresses subtitles', () => {
    const args = buildDownloadArgs({
      request: makeRequest({ mode: 'audio', audioFormat: 'm4a', subtitles: { enabled: false, langs: 'en' } }),
      outputTemplate
    })
    expect(args).toContain('--extract-audio')
    expect(args).toContain('m4a')
    expect(args).not.toContain('--merge-output-format')
    expect(args).not.toContain('--write-subs')
  })

  it('adds subtitle options only for video mode', () => {
    const args = buildDownloadArgs({
      request: makeRequest({ subtitles: { enabled: true, langs: 'zh-Hant,en' } }),
      outputTemplate
    })
    expect(args).toContain('--write-subs')
    expect(args).toContain('zh-Hant,en')
  })

  it('rejects invalid numeric and enum inputs', () => {
    expect(() => buildDownloadArgs({ request: makeRequest({ height: 99999 }), outputTemplate })).toThrow()
    expect(() => buildDownloadArgs({ request: makeRequest({ height: 10.5 }), outputTemplate })).toThrow()
    expect(() =>
      buildDownloadArgs({ request: makeRequest({ container: 'exe' as never }), outputTemplate })
    ).toThrow()
    expect(() =>
      buildDownloadArgs({
        request: makeRequest({ subtitles: { enabled: true, langs: 'en;calc' } }),
        outputTemplate
      })
    ).toThrow()
  })

  it('rejects hostile urls, output templates and cookies paths', () => {
    expect(() => buildDownloadArgs({ request: makeRequest({ url: 'file:///C:/x' }), outputTemplate })).toThrow()
    expect(() =>
      buildDownloadArgs({ request: makeRequest(), outputTemplate: 'C:/out/video.%(ext)s\n--exec=calc' })
    ).toThrow()
    expect(() =>
      buildDownloadArgs({
        request: makeRequest(),
        outputTemplate,
        cookiesPath: 'C:/cookies.txt\n--exec=calc'
      })
    ).toThrow()
  })

  it('passes cookies and ffmpeg locations as separate argument values', () => {
    const args = buildDownloadArgs({
      request: makeRequest(),
      outputTemplate,
      cookiesPath: 'C:/Users/Test/cookies.txt',
      ffmpegDir: 'C:/Program Files/Vela/resources/bin'
    })
    expect(args[args.indexOf('--cookies') + 1]).toBe('C:/Users/Test/cookies.txt')
    expect(args[args.indexOf('--ffmpeg-location') + 1]).toBe('C:/Program Files/Vela/resources/bin')
  })

  it('applies concurrent fragments setting and defaults to 4', () => {
    const defaultArgs = buildDownloadArgs({ request: makeRequest(), outputTemplate })
    expect(defaultArgs[defaultArgs.indexOf('--concurrent-fragments') + 1]).toBe('4')
    for (const value of [1, 2, 4, 8] as const) {
      const args = buildDownloadArgs({ request: makeRequest(), outputTemplate, concurrentFragments: value })
      expect(args[args.indexOf('--concurrent-fragments') + 1]).toBe(String(value))
    }
  })

  it('rejects invalid concurrent fragment values', () => {
    expect(() => buildDownloadArgs({ request: makeRequest(), outputTemplate, concurrentFragments: 3 })).toThrow()
    expect(() => buildDownloadArgs({ request: makeRequest(), outputTemplate, concurrentFragments: 0 as never })).toThrow()
  })

  it('rejects invalid browser names', () => {
    expect(() =>
      buildDownloadArgs({
        request: makeRequest(),
        outputTemplate,
        cookiesBrowser: 'calc' as never
      })
    ).toThrow()
  })
})
