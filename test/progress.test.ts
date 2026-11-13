import { describe, expect, it } from 'vitest'
import { parseMarkedValue, parseProgressLine, stripAnsi } from '@shared/progress'

describe('parseProgressLine', () => {
  it('parses byte, speed, eta and percentage fields', () => {
    const result = parseProgressLine('@@PROGRESS@@12345|NA|54321|1234.5|30| 22.7%')
    expect(result).toEqual({
      percent: 22.7,
      downloadedBytes: 12345,
      totalBytes: 54321,
      speed: 1234.5,
      eta: 30
    })
  })

  it('computes percentage when only byte counts are available', () => {
    const result = parseProgressLine('@@PROGRESS@@50|100|NA|NA|NA|NA')
    expect(result?.percent).toBe(50)
  })

  it('handles unavailable values', () => {
    const result = parseProgressLine('@@PROGRESS@@NA|NA|NA|NA|NA|NA')
    expect(result).toEqual({
      percent: null,
      downloadedBytes: null,
      totalBytes: null,
      speed: null,
      eta: null
    })
  })

  it('ignores unrelated output', () => {
    expect(parseProgressLine('[download] 10% of 10MiB')).toBeNull()
  })
})

describe('markers and ansi', () => {
  it('extracts marked values and ignores empty payloads', () => {
    expect(parseMarkedValue('@@TITLE@@My video', '@@TITLE@@')).toBe('My video')
    expect(parseMarkedValue('@@TITLE@@   ', '@@TITLE@@')).toBeNull()
    expect(parseMarkedValue('nothing', '@@TITLE@@')).toBeNull()
  })

  it('strips terminal color codes', () => {
    expect(stripAnsi('\u001b[31merror\u001b[0m')).toBe('error')
  })
})
