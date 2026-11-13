import { describe, expect, it } from 'vitest'
import { parseBatchUrls } from '@shared/batch'

describe('parseBatchUrls', () => {
  it('parses valid urls, trims blanks, and removes duplicates', () => {
    const result = parseBatchUrls('\n https://a.com/1 \n\nhttps://a.com/1\nhttps://b.com/2  \n')
    expect(result.links).toEqual(['https://a.com/1', 'https://b.com/2'])
    expect(result.validCount).toBe(2)
    expect(result.duplicateCount).toBe(1)
    expect(result.firstInvalidLine).toBeNull()
    expect(result.tooMany).toBe(false)
  })

  it('reports first invalid line among non-empty lines', () => {
    const result = parseBatchUrls('https://ok.com\nnot-a-url\nhttps://ok2.com')
    expect(result.firstInvalidLine).toBe(2)
    expect(result.validCount).toBe(2)
  })

  it('enforces max 50 urls', () => {
    const many = Array.from({ length: 51 }, (_, i) => `https://example.com/${i}`).join('\n')
    const result = parseBatchUrls(many)
    expect(result.tooMany).toBe(true)
    expect(result.validCount).toBe(51)
  })
})
