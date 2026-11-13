import { describe, expect, it } from 'vitest'
import { isValidFilenameTemplate, isValidSubtitleLangs, renderFilename, sanitizeFilename } from '@shared/filename'

describe('sanitizeFilename', () => {
  it('removes path separators and traversal sequences', () => {
    expect(sanitizeFilename('../../Windows/System32/cmd.exe')).not.toContain('/')
    expect(sanitizeFilename('..\\..\\Windows\\System32\\cmd.exe')).not.toContain('\\')
    expect(sanitizeFilename('../../etc/passwd')).toBe('etc_passwd')
    expect(sanitizeFilename('..')).toBe('video')
    expect(sanitizeFilename('.')).toBe('video')
  })

  it('removes characters that are illegal on Windows', () => {
    expect(sanitizeFilename('a<b>c:d"e/f\\g|h?i*j')).toBe('a_b_c_d_e_f_g_h_i_j')
  })

  it('removes control, bidi and yt-dlp template characters', () => {
    expect(sanitizeFilename('safe\u0000name\u202eevil')).toBe('safenameevil')
    expect(sanitizeFilename('100%(title)s')).toBe('100_(title)s')
    expect(sanitizeFilename('$(calc)' )).toBe('$(calc)')
  })

  it('avoids reserved Windows device names', () => {
    expect(sanitizeFilename('CON')).toBe('_CON')
    expect(sanitizeFilename('con.txt')).toBe('_con.txt')
    expect(sanitizeFilename('lpt9')).toBe('_lpt9')
    expect(sanitizeFilename('console')).toBe('console')
  })

  it('strips trailing dots and spaces and limits length', () => {
    expect(sanitizeFilename('name...   ')).toBe('name')
    expect(Array.from(sanitizeFilename('a'.repeat(300), 110))).toHaveLength(110)
  })

  it('never returns an empty filename', () => {
    expect(sanitizeFilename('')).toBe('video')
    expect(sanitizeFilename('...')).toBe('video')
  })

  it('strips leading dots and dashes', () => {
    expect(sanitizeFilename('--exec=calc')).toBe('exec=calc')
    expect(sanitizeFilename('.hidden')).toBe('hidden')
  })
})

describe('renderFilename', () => {
  const vars = {
    title: 'My: Video / Part 1',
    id: 'abc123',
    uploader: 'Someone',
    resolution: '1080p'
  }

  it('renders known tokens and sanitizes the result', () => {
    expect(renderFilename('{title} [{id}]', vars)).toBe('My_ Video _ Part 1 [abc123]')
  })

  it('drops unknown tokens and removes percent template injection', () => {
    expect(renderFilename('{title}-{unknown}-%{id}s', vars)).toBe('My_ Video _ Part 1--_abc123s')
  })

  it('falls back to the title when the template sanitizes to nothing', () => {
    expect(renderFilename('...', { title: 'Fallback' })).toBe('Fallback')
  })

  it('validates templates and subtitle languages', () => {
    expect(isValidFilenameTemplate('{title}-{id}')).toBe(true)
    expect(isValidFilenameTemplate('../{title}')).toBe(false)
    expect(isValidFilenameTemplate('{title}%')).toBe(false)
    expect(isValidSubtitleLangs('zh-Hant,en')).toBe(true)
    expect(isValidSubtitleLangs('en;calc')).toBe(false)
    expect(isValidSubtitleLangs('en --exec')).toBe(false)
  })
})
