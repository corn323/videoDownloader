import { describe, expect, it } from 'vitest'
import {
  batchRequestSchema,
  downloadRequestSchema,
  jobIdSchema,
  probePayloadSchema,
  settingsPatchSchema,
  updateApplySchema
} from '@shared/schemas'

const validRequest = {
  url: 'https://example.com/watch?v=abc',
  mode: 'video',
  height: 1080,
  container: 'mp4',
  audioFormat: 'mp3',
  subtitles: { enabled: false, langs: 'zh-Hant,en' },
  playlist: false
}

describe('downloadRequestSchema', () => {
  it('accepts a valid request', () => {
    expect(downloadRequestSchema.safeParse(validRequest).success).toBe(true)
  })

  it('rejects unknown fields and hostile values', () => {
    expect(downloadRequestSchema.safeParse({ ...validRequest, extra: true }).success).toBe(false)
    expect(downloadRequestSchema.safeParse({ ...validRequest, height: 0 }).success).toBe(false)
    expect(downloadRequestSchema.safeParse({ ...validRequest, height: 99999 }).success).toBe(false)
    expect(downloadRequestSchema.safeParse({ ...validRequest, container: 'exe' }).success).toBe(false)
    expect(downloadRequestSchema.safeParse({ ...validRequest, url: '--exec=calc' }).success).toBe(false)
  })

  it('rejects subtitles with audio-only downloads', () => {
    const parsed = downloadRequestSchema.safeParse({
      ...validRequest,
      mode: 'audio',
      subtitles: { enabled: true, langs: 'en' }
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects unsafe subtitle language values', () => {
    expect(
      downloadRequestSchema.safeParse({
        ...validRequest,
        subtitles: { enabled: true, langs: 'en;calc' }
      }).success
    ).toBe(false)
  })

  it('limits batch size', () => {
    expect(batchRequestSchema.safeParse([validRequest]).success).toBe(true)
    expect(batchRequestSchema.safeParse([]).success).toBe(false)
    expect(batchRequestSchema.safeParse(Array.from({ length: 51 }, () => validRequest)).success).toBe(false)
  })
})

describe('other schemas', () => {
  it('validates job ids as uuids', () => {
    expect(jobIdSchema.safeParse('5f0f0a2e-0e4c-4f57-9c9e-1c22a3b4c5d6').success).toBe(true)
    expect(jobIdSchema.safeParse('../../etc/passwd').success).toBe(false)
  })

  it('validates probe payloads', () => {
    expect(probePayloadSchema.safeParse({ url: 'https://example.com/v/1' }).success).toBe(true)
    expect(probePayloadSchema.safeParse({ url: 'https://example.com/v/1', extra: 1 }).success).toBe(false)
  })

  it('validates settings patches', () => {
    expect(settingsPatchSchema.safeParse({ theme: 'dark' }).success).toBe(true)
    expect(settingsPatchSchema.safeParse({ theme: 'neon' }).success).toBe(false)
    expect(settingsPatchSchema.safeParse({ filenameTemplate: '../{title}' }).success).toBe(false)
    expect(settingsPatchSchema.safeParse({ filenameTemplate: '{title}%' }).success).toBe(false)
    expect(settingsPatchSchema.safeParse({ maxConcurrent: 1 }).success).toBe(true)
    expect(settingsPatchSchema.safeParse({ maxConcurrent: 5 }).success).toBe(true)
    expect(settingsPatchSchema.safeParse({ maxConcurrent: 6 }).success).toBe(false)
    expect(settingsPatchSchema.safeParse({ concurrentFragments: 1 }).success).toBe(true)
    expect(settingsPatchSchema.safeParse({ concurrentFragments: 2 }).success).toBe(true)
    expect(settingsPatchSchema.safeParse({ concurrentFragments: 4 }).success).toBe(true)
    expect(settingsPatchSchema.safeParse({ concurrentFragments: 8 }).success).toBe(true)
    expect(settingsPatchSchema.safeParse({ concurrentFragments: 3 }).success).toBe(false)
    expect(settingsPatchSchema.safeParse({ cookiesBrowser: 'calc' }).success).toBe(false)
  })

  it('requires explicit confirmation for updates', () => {
    expect(updateApplySchema.safeParse({ confirm: true }).success).toBe(true)
    expect(updateApplySchema.safeParse({ confirm: false }).success).toBe(false)
    expect(updateApplySchema.safeParse({}).success).toBe(false)
  })
})
