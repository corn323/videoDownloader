import { app, BrowserWindow, clipboard, dialog, ipcMain, shell, type OpenDialogOptions } from 'electron'
import { z } from 'zod'
import { APP_VERSION, MAX_URL_LENGTH, TERMS_VERSION } from '@shared/constants'
import { IPC } from '@shared/channels'
import { AppError, ERROR_CODES, toPublicError, type ErrorCode } from '@shared/errors'
import {
  batchRequestSchema,
  emptyPayloadSchema,
  jobIdSchema,
  probePayloadSchema,
  settingsPatchSchema,
  updateApplySchema
} from '@shared/schemas'
import type {
  AppSettings,
  BootstrapData,
  CookiesStatus,
  DownloadJob,
  ImportCookiesResult,
  YtDlpStatus,
  YtDlpUpdateInfo
} from '@shared/types'
import { validateDirectoryInput } from '@shared/paths'
import type { BinaryService } from './services/binaries'
import type { CookiesService } from './services/cookies'
import type { DownloadQueue } from './services/queue'
import type { SettingsService } from './services/settings'
import type { YtDlpUpdater } from './services/updater'
import type { YtDlpService } from './services/ytdlp'
import { isTrustedRenderer } from './security'

interface IpcDependencies {
  getWindow: () => BrowserWindow | null
  settings: SettingsService
  cookies: CookiesService
  binaries: BinaryService
  queue: DownloadQueue
  updater: YtDlpUpdater
  ytdlp: YtDlpService
}

const idPayloadSchema = z.object({ id: jobIdSchema }).strict()

export function registerIpc(deps: IpcDependencies): void {
  const register = <TSchema extends z.ZodTypeAny>(
    channel: string,
    schema: TSchema,
    handler: (payload: z.infer<TSchema>) => Promise<unknown> | unknown
  ): void => {
    ipcMain.handle(channel, async (event, payload: unknown) => {
      try {
        if (!isTrustedRenderer(event, deps.getWindow())) {
          throw new AppError('FORBIDDEN', 'IPC sender is not the trusted renderer')
        }
        const parsed = schema.safeParse(payload)
        if (!parsed.success) {
          throw new AppError(schemaErrorCode(parsed.error), 'IPC payload failed validation')
        }
        const data = await handler(parsed.data)
        return { ok: true, data }
      } catch (error) {
        return { ok: false, error: toPublicError(error) }
      }
    })
  }

  const requireTerms = (): void => {
    if (!deps.settings.isTermsAccepted()) {
      throw new AppError('TERMS_REQUIRED', 'the terms of use have not been accepted')
    }
  }

  const bootstrap = async (): Promise<BootstrapData> => {
    const settings = deps.settings.get()
    const status = await deps.binaries.getStatus(deps.updater.getCached())
    const cookies = deps.cookies.status()
    return {
      settings,
      termsVersion: TERMS_VERSION,
      termsAccepted: deps.settings.isTermsAccepted(),
      appVersion: APP_VERSION,
      platform: process.platform,
      ytdlp: status,
      cookies: { ...cookies, mode: settings.cookiesMode }
    }
  }

  register(IPC.bootstrap, emptyPayloadSchema, bootstrap)

  register(IPC.quitApp, emptyPayloadSchema, (): null => {
    app.quit()
    return null
  })

  register(IPC.readClipboard, emptyPayloadSchema, async (): Promise<string | null> => {
    const text = await clipboard.readText()
    if (!text?.trim()) return null
    return text.slice(0, MAX_URL_LENGTH)
  })

  register(IPC.acceptTerms, emptyPayloadSchema, (): AppSettings => {
    return deps.settings.acceptTerms()
  })

  register(IPC.updateSettings, settingsPatchSchema, (patch): AppSettings => {
    const next = deps.settings.update(patch)
    deps.queue.schedule()
    return next
  })

  register(IPC.chooseDirectory, emptyPayloadSchema, async (): Promise<AppSettings | null> => {
    const window = deps.getWindow()
    const options: OpenDialogOptions = {
      title: '選擇下載資料夾',
      properties: ['openDirectory', 'createDirectory', 'dontAddToRecent']
    }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled) return null
    const selected = result.filePaths[0]
    if (!selected) return null
    const validated = validateDirectoryInput(selected)
    return deps.settings.update({ downloadDir: validated })
  })

  register(IPC.probe, probePayloadSchema, async (payload) => {
    requireTerms()
    return deps.ytdlp.probe(payload.url)
  })

  register(IPC.addDownloads, batchRequestSchema, (requests): DownloadJob[] => {
    requireTerms()
    return deps.queue.addMany(requests)
  })

  register(IPC.listDownloads, emptyPayloadSchema, (): DownloadJob[] => {
    return deps.queue.list()
  })

  register(IPC.pauseDownload, idPayloadSchema, (payload): DownloadJob => {
    return deps.queue.pause(payload.id)
  })

  register(IPC.resumeDownload, idPayloadSchema, (payload): DownloadJob => {
    return deps.queue.resume(payload.id)
  })

  register(IPC.cancelDownload, idPayloadSchema, (payload): DownloadJob => {
    return deps.queue.cancel(payload.id)
  })

  register(IPC.retryDownload, idPayloadSchema, (payload): DownloadJob => {
    return deps.queue.retry(payload.id)
  })

  register(IPC.removeDownload, idPayloadSchema, (payload): null => {
    deps.queue.remove(payload.id)
    return null
  })

  register(IPC.revealDownload, idPayloadSchema, (payload): null => {
    const filePath = deps.queue.getOutputPath(payload.id)
    if (!filePath) throw new AppError('OUTPUT_PATH_INVALID', 'no completed file is available to reveal')
    shell.showItemInFolder(filePath)
    return null
  })

  register(IPC.importCookies, emptyPayloadSchema, async (): Promise<ImportCookiesResult> => {
    requireTerms()
    if (!deps.cookies.status().encryptionAvailable) {
      throw new AppError('COOKIES_UNSUPPORTED', 'OS encryption is not available')
    }
    const window = deps.getWindow()
    const options: OpenDialogOptions = {
      title: '匯入 cookies.txt',
      properties: ['openFile', 'dontAddToRecent'],
      filters: [
        { name: 'Cookies', extensions: ['txt'] },
        { name: 'All files', extensions: ['*'] }
      ]
    }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled) return { imported: false, encryptionAvailable: true }
    const selected = result.filePaths[0]
    if (!selected) return { imported: false, encryptionAvailable: true }
    deps.cookies.importFromFile(selected)
    return { imported: true, encryptionAvailable: true }
  })

  register(IPC.clearCookies, emptyPayloadSchema, (): CookiesStatus => {
    deps.cookies.clear()
    return deps.cookies.status()
  })

  register(IPC.cookiesStatus, emptyPayloadSchema, (): CookiesStatus => {
    return deps.cookies.status()
  })

  register(IPC.ytdlpStatus, emptyPayloadSchema, async (): Promise<YtDlpStatus> => {
    return deps.binaries.getStatus(deps.updater.getCached())
  })

  register(IPC.checkYtdlpUpdate, emptyPayloadSchema, async (): Promise<YtDlpUpdateInfo> => {
    return deps.updater.check()
  })

  register(IPC.applyYtdlpUpdate, updateApplySchema, async (): Promise<YtDlpStatus> => {
    if (deps.queue.hasActiveWork()) {
      throw new AppError('UPDATE_FAILED', 'finish or cancel active downloads before updating yt-dlp')
    }
    const window = deps.getWindow()
    await deps.updater.apply((progress) => {
      if (window && !window.isDestroyed()) {
        window.webContents.send(IPC.ytdlpUpdateProgress, progress)
      }
    })
    return deps.binaries.getStatus(deps.updater.getCached())
  })
}

function schemaErrorCode(error: z.ZodError): ErrorCode {
  for (const issue of error.issues) {
    if ((ERROR_CODES as readonly string[]).includes(issue.message)) {
      return issue.message as ErrorCode
    }
  }
  return 'INVALID_INPUT'
}
