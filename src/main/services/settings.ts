import fs from 'node:fs'
import path from 'node:path'
import { DEFAULT_FILENAME_TEMPLATE, DEFAULT_SUBTITLE_LANGS, TERMS_VERSION } from '@shared/constants'
import { AppError } from '@shared/errors'
import { settingsSchema } from '@shared/schemas'
import type { AppSettings, SettingsPatch } from '@shared/types'
import { validateDirectoryInput } from '@shared/paths'

const MAX_SETTINGS_BYTES = 256 * 1024

export class SettingsService {
  private readonly filePath: string
  private readonly defaultDownloadDir: string
  private data: AppSettings

  constructor(userDataDir: string, defaultDownloadDir: string) {
    this.filePath = path.join(userDataDir, 'settings.json')
    this.defaultDownloadDir = defaultDownloadDir
    this.data = this.load()
  }

  get(): AppSettings {
    return { ...this.data }
  }

  isTermsAccepted(): boolean {
    return this.data.acceptedTermsVersion >= TERMS_VERSION
  }

  acceptTerms(): AppSettings {
    this.data.acceptedTermsVersion = TERMS_VERSION
    this.data.acceptedTermsAt = new Date().toISOString()
    this.save()
    return this.get()
  }

  update(patch: SettingsPatch): AppSettings {
    const next: AppSettings = { ...this.data, ...patch }
    if (patch.downloadDir !== undefined) {
      next.downloadDir = validateDirectoryInput(patch.downloadDir)
      try {
        fs.mkdirSync(next.downloadDir, { recursive: true })
      } catch (error) {
        throw new AppError('OUTPUT_PATH_INVALID', `cannot create download directory: ${String(error)}`)
      }
    }
    const parsed = settingsSchema.safeParse(next)
    if (!parsed.success) {
      throw new AppError('INVALID_INPUT', 'settings failed validation')
    }
    this.data = parsed.data
    this.save()
    return this.get()
  }

  private load(): AppSettings {
    const fallback = this.defaults()
    try {
      if (!fs.existsSync(this.filePath)) return fallback
      const stat = fs.statSync(this.filePath)
      if (!stat.isFile() || stat.size > MAX_SETTINGS_BYTES) return fallback
      const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as unknown
      const parsed = settingsSchema.safeParse(raw)
      if (!parsed.success) return fallback
      const candidate = { ...fallback, ...parsed.data }
      try {
        candidate.downloadDir = validateDirectoryInput(candidate.downloadDir)
      } catch {
        candidate.downloadDir = fallback.downloadDir
      }
      return candidate
    } catch {
      return fallback
    }
  }

  private defaults(): AppSettings {
    return {
      downloadDir: this.defaultDownloadDir,
      filenameTemplate: DEFAULT_FILENAME_TEMPLATE,
      theme: 'system',
      language: 'zh-TW',
      subtitleEnabled: false,
      subtitleLangs: DEFAULT_SUBTITLE_LANGS,
      cookiesMode: 'none',
      cookiesBrowser: 'edge',
      maxConcurrent: 2,
      acceptedTermsVersion: 0,
      acceptedTermsAt: null
    }
  }

  private save(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
    const temp = `${this.filePath}.tmp`
    fs.writeFileSync(temp, JSON.stringify(this.data, null, 2), { mode: 0o600 })
    fs.renameSync(temp, this.filePath)
  }
}
