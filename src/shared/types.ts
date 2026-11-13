import type { AUDIO_FORMATS, BROWSERS, CONTAINERS, COOKIES_MODES, LANGUAGES, THEMES } from './constants'

export type ThemeMode = (typeof THEMES)[number]
export type Language = (typeof LANGUAGES)[number]
export type CookiesMode = (typeof COOKIES_MODES)[number]
export type BrowserName = (typeof BROWSERS)[number]
export type Container = (typeof CONTAINERS)[number]
export type AudioFormat = (typeof AUDIO_FORMATS)[number]
export type DownloadMode = 'video' | 'audio'

export interface AppSettings {
  downloadDir: string
  filenameTemplate: string
  theme: ThemeMode
  language: Language
  subtitleEnabled: boolean
  subtitleLangs: string
  cookiesMode: CookiesMode
  cookiesBrowser: BrowserName
  maxConcurrent: number
  acceptedTermsVersion: number
  acceptedTermsAt: string | null
}

export interface SettingsPatch {
  downloadDir?: string
  filenameTemplate?: string
  theme?: ThemeMode
  language?: Language
  subtitleEnabled?: boolean
  subtitleLangs?: string
  cookiesMode?: CookiesMode
  cookiesBrowser?: BrowserName
  maxConcurrent?: number
}

export interface VideoFormat {
  formatId: string
  ext: string
  height: number | null
  width: number | null
  fps: number | null
  vcodec: string | null
  acodec: string | null
  filesize: number | null
  tbr: number | null
  hasVideo: boolean
  hasAudio: boolean
  note: string | null
}

export interface PlaylistEntry {
  url: string
  title: string
  id: string | null
  duration: number | null
  thumbnail: string | null
}

export interface VideoInfo {
  url: string
  id: string | null
  title: string
  uploader: string | null
  duration: number | null
  thumbnail: string | null
  isPlaylist: boolean
  playlistCount: number
  entries: PlaylistEntry[]
  formats: VideoFormat[]
  heights: number[]
  isLive: boolean
  ageLimit: number | null
}

export interface SubtitleOptions {
  enabled: boolean
  langs: string
}

export interface DownloadRequest {
  url: string
  title?: string
  id?: string
  uploader?: string
  thumbnail?: string
  mode: DownloadMode
  height: number | null
  container: Container
  audioFormat: AudioFormat
  subtitles: SubtitleOptions
  playlist: boolean
}

export type DownloadStatus =
  | 'queued'
  | 'analyzing'
  | 'downloading'
  | 'paused'
  | 'merging'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface DownloadJob {
  id: string
  url: string
  title: string
  thumbnail: string | null
  mode: DownloadMode
  height: number | null
  container: Container
  audioFormat: AudioFormat
  subtitles: SubtitleOptions
  playlist: boolean
  status: DownloadStatus
  progress: number
  downloadedBytes: number
  totalBytes: number | null
  speed: number | null
  eta: number | null
  outputPath: string | null
  error: import('./errors').PublicError | null
  createdAt: number
  updatedAt: number
}

export interface YtDlpUpdateInfo {
  available: boolean
  currentVersion: string | null
  latestVersion: string | null
  releaseUrl: string | null
  notes: string | null
}

export interface YtDlpStatus {
  found: boolean
  pathKind: 'managed' | 'bundled' | 'missing'
  version: string | null
  ffmpegFound: boolean
  update: YtDlpUpdateInfo | null
}

export interface CookiesStatus {
  mode: CookiesMode
  stored: boolean
  encryptionAvailable: boolean
}

export interface BootstrapData {
  settings: AppSettings
  termsVersion: number
  termsAccepted: boolean
  appVersion: string
  platform: string
  ytdlp: YtDlpStatus
  cookies: CookiesStatus
}

export interface UpdateProgress {
  phase: 'downloading' | 'verifying' | 'installing'
  receivedBytes: number
  totalBytes: number | null
}

export interface ApiFailure {
  ok: false
  error: import('./errors').PublicError
}

export type ApiResult<T> = { ok: true; data: T } | ApiFailure

export interface ProbePayload {
  url: string
}

export interface DownloadPayload {
  request: DownloadRequest
}

export interface DownloadList {
  jobs: DownloadJob[]
}

export interface ImportCookiesResult {
  imported: boolean
  encryptionAvailable: boolean
}
