import { contextBridge, ipcRenderer } from 'electron'
import type { VelaApi } from '@shared/api'
import { IPC } from '@shared/channels'
import type {
  ApiResult,
  AppSettings,
  BootstrapData,
  CookiesStatus,
  DownloadJob,
  DownloadRequest,
  ImportCookiesResult,
  SettingsPatch,
  UpdateProgress,
  VideoInfo,
  YtDlpStatus,
  YtDlpUpdateInfo
} from '@shared/types'

function invoke<T>(channel: string, payload?: unknown): Promise<ApiResult<T>> {
  return ipcRenderer.invoke(channel, payload) as Promise<ApiResult<T>>
}

function subscribe<T>(channel: string, callback: (value: T) => void): () => void {
  if (typeof callback !== 'function') throw new TypeError('callback must be a function')
  const listener = (_event: Electron.IpcRendererEvent, value: T): void => {
    callback(value)
  }
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const api: VelaApi = {
  bootstrap: () => invoke<BootstrapData>(IPC.bootstrap),
  quitApp: () => invoke<null>(IPC.quitApp),
  readClipboard: () => invoke<string | null>(IPC.readClipboard),
  acceptTerms: () => invoke<AppSettings>(IPC.acceptTerms),
  updateSettings: (patch: SettingsPatch) => invoke<AppSettings>(IPC.updateSettings, patch),
  chooseDownloadDir: () => invoke<AppSettings | null>(IPC.chooseDirectory),
  probe: (url: string) => invoke<VideoInfo>(IPC.probe, { url }),
  addDownloads: (requests: DownloadRequest[]) => invoke<DownloadJob[]>(IPC.addDownloads, requests),
  listDownloads: () => invoke<DownloadJob[]>(IPC.listDownloads),
  pauseDownload: (id: string) => invoke<DownloadJob>(IPC.pauseDownload, { id }),
  resumeDownload: (id: string) => invoke<DownloadJob>(IPC.resumeDownload, { id }),
  cancelDownload: (id: string) => invoke<DownloadJob>(IPC.cancelDownload, { id }),
  retryDownload: (id: string) => invoke<DownloadJob>(IPC.retryDownload, { id }),
  removeDownload: (id: string) => invoke<null>(IPC.removeDownload, { id }),
  revealDownload: (id: string) => invoke<null>(IPC.revealDownload, { id }),
  importCookies: () => invoke<ImportCookiesResult>(IPC.importCookies),
  clearCookies: () => invoke<CookiesStatus>(IPC.clearCookies),
  cookiesStatus: () => invoke<CookiesStatus>(IPC.cookiesStatus),
  ytdlpStatus: () => invoke<YtDlpStatus>(IPC.ytdlpStatus),
  checkYtdlpUpdate: () => invoke<YtDlpUpdateInfo>(IPC.checkYtdlpUpdate),
  applyYtdlpUpdate: () => invoke<YtDlpStatus>(IPC.applyYtdlpUpdate, { confirm: true }),
  onDownloadsUpdated: (callback) => subscribe<DownloadJob>(IPC.downloadsUpdated, callback),
  onYtdlpUpdateAvailable: (callback) => subscribe<YtDlpUpdateInfo>(IPC.ytdlpUpdateAvailable, callback),
  onYtdlpUpdateProgress: (callback) => subscribe<UpdateProgress>(IPC.ytdlpUpdateProgress, callback)
}

contextBridge.exposeInMainWorld('vela', api)
