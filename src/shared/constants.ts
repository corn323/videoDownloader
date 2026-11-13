export const APP_NAME = 'Vela'
export const APP_ID = 'app.vela.fetch'
export const APP_VERSION = '0.1.0'
export const TERMS_VERSION = 1

export const MAX_URL_LENGTH = 2048
export const MAX_BATCH_SIZE = 50
export const MAX_COOKIE_FILE_BYTES = 2 * 1024 * 1024
export const MAX_YTDLP_DOWNLOAD_BYTES = 200 * 1024 * 1024

export const DEFAULT_FILENAME_TEMPLATE = '{title}'
export const DEFAULT_SUBTITLE_LANGS = 'zh-Hant,zh-Hans,en'

export const CONTAINERS = ['mp4', 'webm', 'mkv'] as const
export const AUDIO_FORMATS = ['mp3', 'm4a', 'opus'] as const
export const BROWSERS = ['chrome', 'edge', 'firefox', 'brave', 'chromium', 'opera', 'vivaldi'] as const
export const THEMES = ['system', 'light', 'dark'] as const
export const LANGUAGES = ['zh-TW', 'en'] as const
export const COOKIES_MODES = ['none', 'file', 'browser'] as const

export const MIN_HEIGHT = 144
export const MAX_HEIGHT = 4320

export const YTDLP_RELEASE_API = 'https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest'
export const YTDLP_ALLOWED_HOSTS = [
  'api.github.com',
  'github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
  'github-releases.githubusercontent.com'
]

export const TERMS_URL_PLACEHOLDER = 'https://example.invalid/terms'
