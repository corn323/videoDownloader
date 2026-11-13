import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { SettingsService } from '../src/main/services/settings'

describe('SettingsService migration/compat', () => {
  let dir: string
  let file: string
  const defaultDir = path.join(os.tmpdir(), 'vela-default-dl')
  beforeEach(async () => {
    dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'vela-settings-'))
    file = path.join(dir, 'settings.json')
  })
  afterEach(async () => {
    await fsp.rm(dir, { recursive: true, force: true })
  })

  it('migrates old settings without concurrentFragments and preserves other fields', () => {
    const old = {
      downloadDir: 'C:\\Users\\Test\\Downloads',
      filenameTemplate: '{uploader}-{title}',
      theme: 'dark',
      language: 'en',
      subtitleEnabled: true,
      subtitleLangs: 'en,ja',
      cookiesMode: 'browser',
      cookiesBrowser: 'firefox',
      maxConcurrent: 3,
      acceptedTermsVersion: 1,
      acceptedTermsAt: '2026-01-01T00:00:00.000Z'
    }
    fs.writeFileSync(file, JSON.stringify(old))
    const svc = new SettingsService(dir, defaultDir)
    const s = svc.get()
    expect(s.concurrentFragments).toBe(4)
    expect(s.downloadDir).toBe(old.downloadDir)
    expect(s.filenameTemplate).toBe(old.filenameTemplate)
    expect(s.theme).toBe('dark')
    expect(s.language).toBe('en')
    expect(s.subtitleEnabled).toBe(true)
    expect(s.subtitleLangs).toBe('en,ja')
    expect(s.cookiesMode).toBe('browser')
    expect(s.cookiesBrowser).toBe('firefox')
    expect(s.maxConcurrent).toBe(3)
    expect(s.acceptedTermsVersion).toBe(1)
    expect(s.acceptedTermsAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('loads and saves new settings with concurrentFragments', () => {
    const svc = new SettingsService(dir, defaultDir)
    svc.update({ concurrentFragments: 8, maxConcurrent: 5, theme: 'light' })
    const svc2 = new SettingsService(dir, defaultDir)
    const s = svc2.get()
    expect(s.concurrentFragments).toBe(8)
    expect(s.maxConcurrent).toBe(5)
    expect(s.theme).toBe('light')
  })

  it('falls back safely for invalid settings without bypassing validation', () => {
    fs.writeFileSync(file, JSON.stringify({ maxConcurrent: 99, concurrentFragments: 3, theme: 'neon' }))
    const svc = new SettingsService(dir, defaultDir)
    const s = svc.get()
    expect(s.maxConcurrent).toBe(2)
    expect(s.concurrentFragments).toBe(4)
    expect(s.theme).toBe('system')
  })
})
