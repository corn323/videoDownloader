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
} from './types'

export type Unsubscribe = () => void

export interface VelaApi {
  bootstrap: () => Promise<ApiResult<BootstrapData>>
  quitApp: () => Promise<ApiResult<null>>
  readClipboard: () => Promise<ApiResult<string | null>>
  acceptTerms: () => Promise<ApiResult<AppSettings>>
  updateSettings: (patch: SettingsPatch) => Promise<ApiResult<AppSettings>>
  chooseDownloadDir: () => Promise<ApiResult<AppSettings | null>>
  probe: (url: string) => Promise<ApiResult<VideoInfo>>
  addDownloads: (requests: DownloadRequest[]) => Promise<ApiResult<DownloadJob[]>>
  listDownloads: () => Promise<ApiResult<DownloadJob[]>>
  pauseDownload: (id: string) => Promise<ApiResult<DownloadJob>>
  resumeDownload: (id: string) => Promise<ApiResult<DownloadJob>>
  cancelDownload: (id: string) => Promise<ApiResult<DownloadJob>>
  retryDownload: (id: string) => Promise<ApiResult<DownloadJob>>
  removeDownload: (id: string) => Promise<ApiResult<null>>
  revealDownload: (id: string) => Promise<ApiResult<null>>
  importCookies: () => Promise<ApiResult<ImportCookiesResult>>
  clearCookies: () => Promise<ApiResult<CookiesStatus>>
  cookiesStatus: () => Promise<ApiResult<CookiesStatus>>
  ytdlpStatus: () => Promise<ApiResult<YtDlpStatus>>
  checkYtdlpUpdate: () => Promise<ApiResult<YtDlpUpdateInfo>>
  applyYtdlpUpdate: () => Promise<ApiResult<YtDlpStatus>>
  onDownloadsUpdated: (callback: (job: DownloadJob) => void) => Unsubscribe
  onYtdlpUpdateAvailable: (callback: (info: YtDlpUpdateInfo) => void) => Unsubscribe
  onYtdlpUpdateProgress: (callback: (progress: UpdateProgress) => void) => Unsubscribe
}
