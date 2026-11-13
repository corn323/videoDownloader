import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import fsp from 'node:fs/promises'
import fs from 'node:fs'
import { DownloadQueue } from '../src/main/services/queue'
import type { AppSettings, DownloadRequest } from '@shared/types'

function makeSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    downloadDir: path.join(os.tmpdir(), 'vela-q-' + Math.random().toString(36).slice(2)),
    filenameTemplate: '{title}',
    theme: 'system',
    language: 'zh-TW',
    subtitleEnabled: false,
    subtitleLangs: 'zh-Hant,en',
    cookiesMode: 'none',
    cookiesBrowser: 'edge',
    maxConcurrent: 2,
    concurrentFragments: 4,
    acceptedTermsVersion: 1,
    acceptedTermsAt: null,
    ...overrides
  }
}

function makeRequest(url: string, overrides: Partial<DownloadRequest> = {}): DownloadRequest {
  return {
    url,
    title: 'Title',
    mode: 'video',
    height: 1080,
    container: 'mp4',
    audioFormat: 'mp3',
    subtitles: { enabled: false, langs: 'en' },
    playlist: false,
    ...overrides
  }
}

type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void }
function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('DownloadQueue', () => {
  let settings: AppSettings
  beforeEach(async () => {
    settings = makeSettings()
    await fsp.mkdir(settings.downloadDir, { recursive: true })
  })
  afterEach(async () => {
    await fsp.rm(settings.downloadDir, { recursive: true, force: true }).catch(() => undefined)
  })

  function makeQueue(overrides: { downloadImpl?: (input: unknown) => Promise<unknown>; cookies?: Record<string, unknown> } = {}) {
    const onUpdate = vi.fn()
    const ytdlp = {
      probe: vi.fn().mockResolvedValue({ title: 'Title', id: 'id', uploader: null, thumbnail: null, isPlaylist: false }),
      download: vi.fn(overrides.downloadImpl ?? (async () => ({ outputPath: null })))
    }
    const cookies = {
      createTempFile: vi.fn(() => null),
      cleanupTemp: vi.fn(),
      status: () => ({}),
      ...(overrides.cookies || {})
    }
    const deps = {
      settings: { get: () => settings },
      cookies,
      binaries: { getFfmpegDir: () => 'C:/ffmpeg' },
      ytdlp,
      onUpdate
    }
    return { queue: new DownloadQueue(deps as never), ytdlp, cookies }
  }

  it('keeps concurrent running count within maxConcurrent and starts next after completion', async () => {
    settings.maxConcurrent = 2
    const defs = [deferred<unknown>(), deferred<unknown>(), deferred<unknown>()]
    let active = 0
    let maxActive = 0
    let i = 0
    const { queue } = makeQueue({
      downloadImpl: async () => {
        active++
        maxActive = Math.max(maxActive, active)
        try {
          return await defs[i++]!.promise
        } finally {
          active--
        }
      }
    })
    queue.addMany([makeRequest('https://e.com/1'), makeRequest('https://e.com/2'), makeRequest('https://e.com/3')])
    await delay(30)
    expect(maxActive).toBeLessThanOrEqual(2)
    expect(queue.list().filter((j) => j.status === 'queued').length).toBe(1)
    defs[0]!.resolve({ outputPath: null })
    await delay(40)
    expect(maxActive).toBeLessThanOrEqual(2)
    expect(queue.list().some((j) => j.url.includes('/3') && j.status !== 'queued')).toBe(true)
    defs[1]!.resolve({ outputPath: null })
    defs[2]!.resolve({ outputPath: null })
  })

  it('pause affects only target job and resume restarts it', async () => {
    settings.maxConcurrent = 2
    const defs = [deferred<unknown>(), deferred<unknown>(), deferred<unknown>()]
    let calls = 0
    const { queue, ytdlp } = makeQueue({ downloadImpl: () => defs[calls++]!.promise })
    const jobs = queue.addMany([makeRequest('https://e.com/1'), makeRequest('https://e.com/2')])
    const j1 = jobs[0]!
    const j2 = jobs[1]!
    await delay(30)
    queue.pause(j1.id)
    expect(queue.list().find((j) => j.id === j1.id)?.status).toBe('paused')
    expect(queue.list().find((j) => j.id === j2.id)?.status).not.toBe('paused')
    defs[0]!.resolve({ outputPath: null })
    await delay(50)
    expect(queue.list().find((j) => j.id === j1.id)?.status).toBe('paused')
    queue.resume(j1.id)
    await delay(40)
    expect(ytdlp.download).toHaveBeenCalledTimes(3)
    expect(queue.list().find((j) => j.id === j1.id)?.status).not.toBe('paused')
    defs[1]!.resolve({ outputPath: null })
    defs[2]!.resolve({ outputPath: null })
  })

  it('cancel affects only target job', async () => {
    settings.maxConcurrent = 2
    const defs = [deferred<unknown>(), deferred<unknown>()]
    let i = 0
    const { queue } = makeQueue({ downloadImpl: () => defs[i++]!.promise })
    const jobs = queue.addMany([makeRequest('https://e.com/1'), makeRequest('https://e.com/2')])
    const j1 = jobs[0]!
    const j2 = jobs[1]!
    await delay(30)
    queue.cancel(j1.id)
    expect(queue.list().find((j) => j.id === j1.id)?.status).toBe('cancelled')
    expect(queue.list().find((j) => j.id === j2.id)?.status).not.toBe('cancelled')
    defs[0]!.resolve({ outputPath: null })
    defs[1]!.resolve({ outputPath: null })
  })

  it('failed job can be retried without duplicating and does not block queue', async () => {
    settings.maxConcurrent = 1
    const outcomes = [
      () => Promise.reject(new Error('boom')),
      () => Promise.resolve({ outputPath: null }),
      () => Promise.resolve({ outputPath: null })
    ]
    let i = 0
    const { queue, ytdlp } = makeQueue({ downloadImpl: () => outcomes[i++]!() })
    const jobs = queue.addMany([makeRequest('https://e.com/1'), makeRequest('https://e.com/2')])
    const j1 = jobs[0]!
    await delay(60)
    expect(queue.list().find((j) => j.id === j1.id)?.status).toBe('failed')
    expect(queue.list().find((j) => j.url.includes('/2'))?.status).toBe('completed')
    const before = queue.list().length
    queue.retry(j1.id)
    await delay(50)
    expect(queue.list().length).toBe(before)
    expect(queue.list().find((j) => j.id === j1.id)?.status).toBe('completed')
    expect(ytdlp.download).toHaveBeenCalledTimes(3)
  })

  it('cleans cookies temp on success, failure, and cancel', async () => {
    settings.cookiesMode = 'file'
    const c1 = { createTempFile: vi.fn(() => 'C:/t/c1.txt'), cleanupTemp: vi.fn() }
    const { queue: q1 } = makeQueue({ cookies: c1 })
    q1.add(makeRequest('https://e.com/s'))
    await delay(50)
    expect(c1.cleanupTemp).toHaveBeenCalledWith('C:/t/c1.txt')

    settings.downloadDir = path.join(os.tmpdir(), 'vela-q-' + Math.random().toString(36).slice(2))
    await fsp.mkdir(settings.downloadDir, { recursive: true })
    const c2 = { createTempFile: vi.fn(() => 'C:/t/c2.txt'), cleanupTemp: vi.fn() }
    const { queue: q2 } = makeQueue({ downloadImpl: async () => { throw new Error('x') }, cookies: c2 })
    q2.add(makeRequest('https://e.com/f'))
    await delay(50)
    expect(c2.cleanupTemp).toHaveBeenCalledWith('C:/t/c2.txt')

    settings.downloadDir = path.join(os.tmpdir(), 'vela-q-' + Math.random().toString(36).slice(2))
    await fsp.mkdir(settings.downloadDir, { recursive: true })
    const d = deferred<unknown>()
    const c3 = { createTempFile: vi.fn(() => 'C:/t/c3.txt'), cleanupTemp: vi.fn() }
    const { queue: q3 } = makeQueue({ downloadImpl: () => d.promise, cookies: c3 })
    const jobs = q3.addMany([makeRequest('https://e.com/c')])
    await delay(30)
    q3.cancel(jobs[0]!.id)
    d.resolve({ outputPath: null })
    await delay(50)
    expect(c3.cleanupTemp).toHaveBeenCalledWith('C:/t/c3.txt')
  })

  it('dynamic maxConcurrent decrease does not stop running jobs', async () => {
    settings.maxConcurrent = 2
    const defs = [deferred<unknown>(), deferred<unknown>()]
    let i = 0
    const { queue, ytdlp } = makeQueue({ downloadImpl: () => defs[i++]!.promise })
    queue.addMany([makeRequest('https://e.com/1'), makeRequest('https://e.com/2')])
    await delay(30)
    expect(ytdlp.download).toHaveBeenCalledTimes(2)
    settings.maxConcurrent = 1
    queue.schedule()
    await delay(20)
    expect(ytdlp.download).toHaveBeenCalledTimes(2)
    defs[0]!.resolve({ outputPath: null })
    defs[1]!.resolve({ outputPath: null })
  })

  it('prevents output filename collisions for same-name concurrent jobs and reserves case-insensitively', async () => {
    settings.maxConcurrent = 2
    const seen: string[] = []
    const defs = [deferred<unknown>(), deferred<unknown>()]
    let i = 0
    const { queue } = makeQueue({
      downloadImpl: async (input) => {
        seen.push(String((input as { outputTemplate: string }).outputTemplate))
        return defs[i++]!.promise
      }
    })
    queue.addMany([
      makeRequest('https://e.com/1', { title: 'Same' }),
      makeRequest('https://e.com/2', { title: 'same' })
    ])
    await delay(50)
    expect(seen.length).toBe(2)
    const bases = seen.map((s) => path.basename(s, '.%(ext)s'))
    expect(new Set(bases.map((b) => b.toLowerCase())).size).toBe(2)
    defs[0]!.resolve({ outputPath: null })
    defs[1]!.resolve({ outputPath: null })
  })

  it('avoids existing files and releases reservation after failure/cancel for later jobs', async () => {
    fs.writeFileSync(path.join(settings.downloadDir, 'Same.mp4'), 'x')
    settings.maxConcurrent = 1
    const seen: string[] = []
    let i = 0
    const { queue } = makeQueue({
      downloadImpl: async (input) => {
        seen.push(String((input as { outputTemplate: string }).outputTemplate))
        i++
        if (i === 1) throw new Error('boom')
        return { outputPath: null }
      }
    })
    queue.addMany([makeRequest('https://e.com/1', { title: 'Same' }), makeRequest('https://e.com/2', { title: 'Same' })])
    await delay(100)
    expect(seen.length).toBe(2)
    const bases = seen.map((s) => path.basename(s, '.%(ext)s').toLowerCase())
    expect(bases[0]).not.toBe('same')
    expect(bases[1]).not.toBe('same')
    expect(queue.list().find((j) => j.url.includes('/2'))?.status).toBe('completed')
  })

  it('passes concurrentFragments setting to ytdlp', async () => {
    settings.concurrentFragments = 8
    const { queue, ytdlp } = makeQueue()
    queue.add(makeRequest('https://e.com/1'))
    await delay(50)
    expect(ytdlp.download).toHaveBeenCalled()
    expect(((ytdlp.download.mock.calls[0] as unknown[])![0] as { concurrentFragments: number }).concurrentFragments).toBe(8)
  })
})
