import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { AppError, toPublicError, type PublicError } from '@shared/errors'
import { renderFilename } from '@shared/filename'
import { buildOutputTemplate, assertPathInside, validateDirectoryInput } from '@shared/paths'
import { sanitizeDetail } from '@shared/errors'
import type {
  BrowserName,
  DownloadJob,
  DownloadRequest,
  DownloadStatus
} from '@shared/types'
import { isSafeThumbnailUrl, validateUrl } from '@shared/url'
import type { BinaryService } from './binaries'
import type { CookiesService } from './cookies'
import type { SettingsService } from './settings'
import type { YtDlpService } from './ytdlp'

const MAX_QUEUE_SIZE = 200
const EMIT_THROTTLE_MS = 300

type DesiredState = 'run' | 'pause' | 'cancel'

interface QueueEntry {
  job: DownloadJob
  request: DownloadRequest
  controller: AbortController | null
  running: boolean
  desired: DesiredState
  outputDir: string | null
  reservedBaseKey: string | null
  lastEmit: number
}

export interface QueueDependencies {
  settings: SettingsService
  cookies: CookiesService
  binaries: BinaryService
  ytdlp: YtDlpService
  onUpdate: (job: DownloadJob) => void
}

export class DownloadQueue {
  private readonly entries = new Map<string, QueueEntry>()
  private readonly reservedBases = new Set<string>()

  constructor(private readonly deps: QueueDependencies) {}

  list(): DownloadJob[] {
    return Array.from(this.entries.values()).map((entry) => snapshot(entry.job))
  }

  add(request: DownloadRequest): DownloadJob {
    return this.addMany([request])[0] as DownloadJob
  }

  addMany(requests: DownloadRequest[]): DownloadJob[] {
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new AppError('INVALID_INPUT', 'no download requests were provided')
    }
    if (this.entries.size + requests.length > MAX_QUEUE_SIZE) {
      throw new AppError('INVALID_INPUT', 'download queue limit reached')
    }

    const created: DownloadJob[] = []
    for (const request of requests) {
      const validation = validateUrl(request.url)
      if (!validation.ok) throw new AppError(validation.code, 'url rejected before queueing')

      const now = Date.now()
      const host = (() => {
        try {
          return new URL(request.url).hostname
        } catch {
          return 'video'
        }
      })()
      const job: DownloadJob = {
        id: randomUUID(),
        url: validation.url.toString(),
        title: cleanText(request.title, 500) ?? host,
        thumbnail: isSafeThumbnailUrl(request.thumbnail),
        mode: request.mode,
        height: request.height,
        container: request.container,
        audioFormat: request.audioFormat,
        subtitles: { ...request.subtitles },
        playlist: false,
        status: 'queued',
        progress: 0,
        downloadedBytes: 0,
        totalBytes: null,
        speed: null,
        eta: null,
        outputPath: null,
        error: null,
        createdAt: now,
        updatedAt: now
      }
      const entry: QueueEntry = {
        job,
        request: {
          ...request,
          url: validation.url.toString(),
          playlist: false,
          subtitles: { ...request.subtitles }
        },
        controller: null,
        running: false,
        desired: 'run',
        outputDir: null,
        reservedBaseKey: null,
        lastEmit: 0
      }
      this.entries.set(job.id, entry)
      created.push(snapshot(job))
      this.emit(entry, true)
    }
    this.schedule()
    return created
  }

  pause(id: string): DownloadJob {
    const entry = this.requireEntry(id)
    if (isTerminal(entry.job.status)) return snapshot(entry.job)
    entry.desired = 'pause'
    entry.job.status = 'paused'
    entry.job.speed = null
    entry.job.eta = null
    entry.controller?.abort()
    this.emit(entry, true)
    return snapshot(entry.job)
  }

  resume(id: string): DownloadJob {
    const entry = this.requireEntry(id)
    if (entry.running || entry.job.status !== 'paused') return snapshot(entry.job)
    entry.desired = 'run'
    entry.job.status = 'queued'
    entry.job.error = null
    this.emit(entry, true)
    this.schedule()
    return snapshot(entry.job)
  }

  cancel(id: string): DownloadJob {
    const entry = this.requireEntry(id)
    if (isTerminal(entry.job.status)) return snapshot(entry.job)
    entry.desired = 'cancel'
    entry.job.status = 'cancelled'
    entry.job.speed = null
    entry.job.eta = null
    entry.job.error = null
    entry.controller?.abort()
    this.emit(entry, true)
    return snapshot(entry.job)
  }

  retry(id: string): DownloadJob {
    const entry = this.requireEntry(id)
    if (entry.job.error?.code === 'DRM_PROTECTED') {
      throw new AppError('DRM_PROTECTED', 'DRM protected content is not supported')
    }
    if (entry.running || (entry.job.status !== 'failed' && entry.job.status !== 'cancelled')) {
      return snapshot(entry.job)
    }
    entry.desired = 'run'
    entry.job.status = 'queued'
    entry.job.error = null
    entry.job.progress = 0
    entry.job.downloadedBytes = 0
    entry.job.totalBytes = null
    entry.job.speed = null
    entry.job.eta = null
    entry.job.outputPath = null
    this.emit(entry, true)
    this.schedule()
    return snapshot(entry.job)
  }

  remove(id: string): void {
    const entry = this.requireEntry(id)
    if (entry.running || !isTerminal(entry.job.status)) {
      throw new AppError('INVALID_INPUT', 'only finished downloads can be removed')
    }
    this.entries.delete(id)
  }

  getOutputPath(id: string): string | null {
    const entry = this.requireEntry(id)
    const output = entry.job.outputPath
    if (!output || !entry.outputDir) return null
    const resolved = assertPathInside(entry.outputDir, output)
    if (!fs.existsSync(resolved)) return null
    return resolved
  }

  hasActiveWork(): boolean {
    return Array.from(this.entries.values()).some((entry) => entry.running)
  }

  schedule(): void {
    const concurrency = this.deps.settings.get().maxConcurrent
    let active = Array.from(this.entries.values()).filter((entry) => entry.running).length
    if (active >= concurrency) return
    for (const entry of this.entries.values()) {
      if (active >= concurrency) break
      if (!entry.running && entry.job.status === 'queued' && entry.desired === 'run') {
        active += 1
        void this.start(entry)
      }
    }
  }

  dispose(): void {
    for (const entry of this.entries.values()) {
      entry.desired = 'cancel'
      entry.controller?.abort()
    }
  }

  private async start(entry: QueueEntry): Promise<void> {
    entry.running = true
    const controller = new AbortController()
    entry.controller = controller
    let cookieTemp: string | null = null

    try {
      const settings = this.deps.settings.get()
      const outputDir = validateDirectoryInput(settings.downloadDir)
      await fsp.mkdir(outputDir, { recursive: true })
      entry.outputDir = outputDir

      let title = cleanText(entry.request.title, 500)
      let videoId = cleanText(entry.request.id, 200)
      let uploader = cleanText(entry.request.uploader, 200)
      let thumbnail = isSafeThumbnailUrl(entry.request.thumbnail)

      if (!title) {
        entry.job.status = 'analyzing'
        this.emit(entry, true)
        const info = await this.deps.ytdlp.probe(entry.request.url, controller.signal)
        if (info.isPlaylist) {
          throw new AppError('PLAYLIST_USE_MAIN', 'open this playlist in the main view to choose entries')
        }
        title = info.title
        videoId = videoId ?? info.id
        uploader = uploader ?? info.uploader
        thumbnail = info.thumbnail ?? thumbnail
        entry.job.title = info.title
        entry.job.thumbnail = thumbnail
        this.emit(entry, true)
      }

      if (entry.desired !== 'run') {
        this.applyDesiredStatus(entry)
        return
      }

      const ffmpegDir = this.deps.binaries.getFfmpegDir()
      if (!ffmpegDir) throw new AppError('FFMPEG_MISSING', 'ffmpeg is required for merging and audio extraction')

      const base = renderFilename(settings.filenameTemplate, {
        title,
        id: videoId ?? entry.job.id.slice(0, 8),
        uploader,
        date: new Date().toISOString().slice(0, 10),
        resolution:
          entry.request.mode === 'audio' ? 'audio' : entry.request.height ? `${entry.request.height}p` : 'best'
      })
      const uniqueBase = await this.reserveUniqueBase(entry, outputDir, base)
      const outputTemplate = buildOutputTemplate(outputDir, uniqueBase)

      if (entry.desired !== 'run') {
        this.applyDesiredStatus(entry)
        return
      }

      let cookiesBrowser: BrowserName | null = null
      if (settings.cookiesMode === 'file') {
        cookieTemp = this.deps.cookies.createTempFile()
        if (!cookieTemp) throw new AppError('COOKIES_MISSING', 'no imported cookies.txt is available')
      } else if (settings.cookiesMode === 'browser') {
        cookiesBrowser = settings.cookiesBrowser
      }

      if (entry.desired !== 'run') {
        this.applyDesiredStatus(entry)
        return
      }

      entry.job.status = 'downloading'
      entry.job.error = null
      this.emit(entry, true)

      const result = await this.deps.ytdlp.download(
        {
          request: entry.request,
          outputDir,
          outputTemplate,
          cookiesPath: cookieTemp,
          cookiesBrowser,
          ffmpegDir,
          concurrentFragments: settings.concurrentFragments,
          signal: controller.signal
        },
        {
          onProgress: (progress) => {
            if (entry.desired !== 'run') return
            entry.job.progress = progress.percent ?? entry.job.progress
            entry.job.downloadedBytes = progress.downloadedBytes ?? entry.job.downloadedBytes
            entry.job.totalBytes = progress.totalBytes ?? entry.job.totalBytes
            entry.job.speed = progress.speed
            entry.job.eta = progress.eta
            if (entry.job.status !== 'merging') entry.job.status = 'downloading'
            this.emit(entry)
          },
          onTitle: (value) => {
            if (entry.desired !== 'run') return
            entry.job.title = value.slice(0, 500)
            this.emit(entry)
          },
          onPhase: () => {
            if (entry.desired !== 'run') return
            entry.job.status = 'merging'
            entry.job.speed = null
            entry.job.eta = null
            this.emit(entry, true)
          }
        }
      )

      if (entry.desired !== 'run') {
        this.applyDesiredStatus(entry)
        return
      }

      entry.job.status = 'completed'
      entry.job.progress = 100
      entry.job.speed = null
      entry.job.eta = 0
      entry.job.outputPath = result.outputPath
      if (entry.job.totalBytes === null) entry.job.totalBytes = entry.job.downloadedBytes
    } catch (error) {
      if (entry.desired === 'pause') {
        entry.job.status = 'paused'
        entry.job.error = null
      } else if (entry.desired === 'cancel') {
        entry.job.status = 'cancelled'
        entry.job.error = null
      } else {
        entry.job.status = 'failed'
        entry.job.speed = null
        entry.job.eta = null
        entry.job.error = toPublicError(error)
        if (entry.job.error.code === 'DRM_PROTECTED') {
          entry.job.progress = 0
        }
      }
    } finally {
      try {
        this.deps.cookies.cleanupTemp(cookieTemp)
      } catch {
        // ignore cleanup errors
      }
      this.releaseReservedBase(entry)
      entry.controller = null
      entry.running = false
      this.emit(entry, true)
      this.schedule()
    }
  }

  private applyDesiredStatus(entry: QueueEntry): void {
    if (entry.desired === 'pause') entry.job.status = 'paused'
    else if (entry.desired === 'cancel') entry.job.status = 'cancelled'
    else entry.job.status = 'queued'
    this.emit(entry, true)
  }

  private requireEntry(id: string): QueueEntry {
    const entry = this.entries.get(id)
    if (!entry) throw new AppError('INVALID_INPUT', 'unknown download job')
    return entry
  }

  private emit(entry: QueueEntry, force = false): void {
    const now = Date.now()
    entry.job.updatedAt = now
    if (!force && now - entry.lastEmit < EMIT_THROTTLE_MS) return
    entry.lastEmit = now
    try {
      this.deps.onUpdate(snapshot(entry.job))
    } catch {
      // The window may have been closed between events.
    }
  }

  private reserveBaseKey(outputDir: string, base: string): string {
    return `${outputDir.toLowerCase()}::${base.toLowerCase()}`
  }

  private releaseReservedBase(entry: QueueEntry): void {
    if (entry.reservedBaseKey) {
      this.reservedBases.delete(entry.reservedBaseKey)
      entry.reservedBaseKey = null
    }
  }

  private async reserveUniqueBase(entry: QueueEntry, outputDir: string, base: string): Promise<string> {
    this.releaseReservedBase(entry)
    const names = await fsp.readdir(outputDir).catch(() => [] as string[])
    const lowerNames = names.map((name) => name.toLowerCase())
    const isTaken = (candidate: string): boolean => {
      const key = this.reserveBaseKey(outputDir, candidate)
      if (this.reservedBases.has(key)) return true
      const prefix = `${candidate.toLowerCase()}.`
      return lowerNames.some((name) => name === candidate.toLowerCase() || name.startsWith(prefix))
    }
    let chosen = base
    if (isTaken(chosen)) {
      chosen = `${base} (${randomUUID().slice(0, 8)})`
      for (let index = 2; index < 1000; index += 1) {
        const candidate = `${base} (${index})`
        if (!isTaken(candidate)) {
          chosen = candidate
          break
        }
      }
    }
    const key = this.reserveBaseKey(outputDir, chosen)
    this.reservedBases.add(key)
    entry.reservedBaseKey = key
    return chosen
  }
}

function snapshot(job: DownloadJob): DownloadJob {
  return { ...job, subtitles: { ...job.subtitles }, error: job.error ? ({ ...job.error } as PublicError) : null }
}

function isTerminal(status: DownloadStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled'
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const cleaned = sanitizeDetail(value, maxLength)
  return cleaned || null
}
