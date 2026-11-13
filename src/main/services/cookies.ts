import { app, safeStorage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { MAX_COOKIE_FILE_BYTES } from '@shared/constants'
import { isNetscapeCookiesFile } from '@shared/cookies'
import { AppError } from '@shared/errors'
import type { CookiesStatus } from '@shared/types'

export class CookiesService {
  private readonly storePath: string
  private readonly tempFiles = new Set<string>()

  constructor(userDataDir: string) {
    this.storePath = path.join(userDataDir, 'cookies.enc')
  }

  status(): CookiesStatus {
    return {
      mode: 'file',
      stored: fs.existsSync(this.storePath),
      encryptionAvailable: safeStorage.isEncryptionAvailable()
    }
  }

  importFromFile(sourcePath: string): void {
    if (!path.isAbsolute(sourcePath)) {
      throw new AppError('COOKIES_INVALID', 'cookies path must be absolute')
    }
    if (!safeStorage.isEncryptionAvailable()) {
      throw new AppError('COOKIES_UNSUPPORTED', 'OS encryption is not available; refusing to store cookies')
    }
    let stat: fs.Stats
    try {
      stat = fs.statSync(sourcePath)
    } catch {
      throw new AppError('COOKIES_INVALID', 'cannot read the selected cookies file')
    }
    if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_COOKIE_FILE_BYTES) {
      throw new AppError('COOKIES_INVALID', 'cookies file is empty or too large')
    }
    const text = fs.readFileSync(sourcePath, 'utf8')
    if (!isNetscapeCookiesFile(text)) {
      throw new AppError('COOKIES_INVALID', 'file is not in Netscape cookies.txt format')
    }
    const encrypted = safeStorage.encryptString(text)
    fs.writeFileSync(this.storePath, encrypted, { mode: 0o600 })
  }

  clear(): void {
    fs.rmSync(this.storePath, { force: true })
  }

  hasStored(): boolean {
    return fs.existsSync(this.storePath)
  }

  createTempFile(): string | null {
    if (!this.hasStored()) return null
    if (!safeStorage.isEncryptionAvailable()) {
      throw new AppError('COOKIES_UNSUPPORTED', 'OS encryption is not available')
    }
    let decrypted: string
    try {
      decrypted = safeStorage.decryptString(fs.readFileSync(this.storePath))
    } catch {
      throw new AppError('COOKIES_INVALID', 'stored cookies could not be decrypted')
    }
    if (!isNetscapeCookiesFile(decrypted)) {
      throw new AppError('COOKIES_INVALID', 'stored cookies are corrupted')
    }
    const tempRoot = app.getPath('temp')
    const tempPath = path.join(tempRoot, `vela-cookies-${randomUUID()}.txt`)
    fs.writeFileSync(tempPath, decrypted, { mode: 0o600 })
    this.tempFiles.add(tempPath)
    return tempPath
  }

  cleanupTemp(tempPath: string | null): void {
    if (!tempPath) return
    this.tempFiles.delete(tempPath)
    try {
      fs.rmSync(tempPath, { force: true })
    } catch {
      // Best effort; the file name is random and short lived.
    }
  }

  cleanupAll(): void {
    for (const tempPath of this.tempFiles) {
      try {
        fs.rmSync(tempPath, { force: true })
      } catch {
        // Ignore.
      }
    }
    this.tempFiles.clear()
  }
}
