import { app } from 'electron'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { AppError } from '@shared/errors'
import type { YtDlpStatus, YtDlpUpdateInfo } from '@shared/types'
import { runProcess } from './process'

const VERSION_CACHE_MS = 60_000

export class BinaryService {
  private readonly resourcesDir: string
  private readonly managedDir: string
  private versionCache: { value: string | null; at: number } | null = null

  constructor() {
    this.resourcesDir = app.isPackaged
      ? process.resourcesPath
      : path.join(app.getAppPath(), 'resources')
    this.managedDir = path.join(app.getPath('userData'), 'bin')
  }

  getManagedDir(): string {
    return this.managedDir
  }

  getManagedYtDlpPath(): string {
    return path.join(this.managedDir, 'yt-dlp.exe')
  }

  getYtDlpPath(): string | null {
    if (!app.isPackaged && process.env.VELA_YTDLP_PATH) {
      const override = process.env.VELA_YTDLP_PATH
      if (path.isAbsolute(override) && fs.existsSync(override)) return override
    }
    const managed = this.getManagedYtDlpPath()
    if (fs.existsSync(managed)) return managed
    const bundled = path.join(this.resourcesDir, 'bin', 'yt-dlp.exe')
    if (fs.existsSync(bundled)) return bundled
    return null
  }

  getPathKind(): 'managed' | 'bundled' | 'missing' {
    if (!app.isPackaged && process.env.VELA_YTDLP_PATH) {
      const override = process.env.VELA_YTDLP_PATH
      if (path.isAbsolute(override) && fs.existsSync(override)) return 'managed'
    }
    if (fs.existsSync(this.getManagedYtDlpPath())) return 'managed'
    if (fs.existsSync(path.join(this.resourcesDir, 'bin', 'yt-dlp.exe'))) return 'bundled'
    return 'missing'
  }

  getFfmpegDir(): string | null {
    if (!app.isPackaged && process.env.VELA_FFMPEG_DIR) {
      const override = process.env.VELA_FFMPEG_DIR
      if (path.isAbsolute(override) && fs.existsSync(path.join(override, 'ffmpeg.exe'))) return override
    }
    const bundledDir = path.join(this.resourcesDir, 'bin')
    if (fs.existsSync(path.join(bundledDir, 'ffmpeg.exe'))) return bundledDir
    if (fs.existsSync(path.join(this.managedDir, 'ffmpeg.exe'))) return this.managedDir
    return null
  }

  hasFfmpeg(): boolean {
    return this.getFfmpegDir() !== null
  }

  async getVersion(force = false): Promise<string | null> {
    if (!force && this.versionCache && Date.now() - this.versionCache.at < VERSION_CACHE_MS) {
      return this.versionCache.value
    }
    const exe = this.getYtDlpPath()
    if (!exe) {
      this.versionCache = { value: null, at: Date.now() }
      return null
    }
    try {
      const result = await runProcess(exe, ['--ignore-config', '--version'], {
        timeoutMs: 15_000,
        maxBufferBytes: 64 * 1024,
        missingCode: 'YTDLP_MISSING'
      })
      const value = result.code === 0 ? result.stdout.trim().split(/\r?\n/).at(-1) ?? null : null
      this.versionCache = { value, at: Date.now() }
      return value
    } catch {
      this.versionCache = { value: null, at: Date.now() }
      return null
    }
  }

  invalidateVersion(): void {
    this.versionCache = null
  }

  async getStatus(update: YtDlpUpdateInfo | null = null): Promise<YtDlpStatus> {
    const pathKind = this.getPathKind()
    return {
      found: pathKind !== 'missing',
      pathKind,
      version: await this.getVersion(),
      ffmpegFound: this.hasFfmpeg(),
      update
    }
  }

  async installManagedVerified(verifiedExecutable: Buffer): Promise<void> {
    await fsp.mkdir(this.managedDir, { recursive: true })
    const target = this.getManagedYtDlpPath()
    const temp = path.join(this.managedDir, `yt-dlp-${randomUUID()}.tmp`)
    const backup = `${target}.bak`
    await fsp.writeFile(temp, verifiedExecutable, { mode: 0o700 })
    let hadExisting = false
    try {
      if (fs.existsSync(target)) {
        hadExisting = true
        await fsp.rm(backup, { force: true })
        await fsp.rename(target, backup)
      }
      await fsp.rename(temp, target)
      const check = await runProcess(target, ['--ignore-config', '--version'], {
        timeoutMs: 20_000,
        maxBufferBytes: 64 * 1024,
        missingCode: 'YTDLP_MISSING'
      })
      if (check.code !== 0 || !check.stdout.trim()) {
        throw new AppError('UPDATE_FAILED', 'downloaded yt-dlp failed its self-test')
      }
      this.invalidateVersion()
      await fsp.rm(backup, { force: true })
    } catch (error) {
      await fsp.rm(temp, { force: true }).catch(() => undefined)
      if (hadExisting && fs.existsSync(backup)) {
        await fsp.rm(target, { force: true }).catch(() => undefined)
        await fsp.rename(backup, target).catch(() => undefined)
      }
      if (error instanceof AppError) throw error
      throw new AppError('UPDATE_FAILED', `could not install update: ${String(error)}`)
    }
  }
}
