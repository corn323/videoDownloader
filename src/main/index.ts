import { app, BrowserWindow, Menu, session } from 'electron'
import path from 'node:path'
import { APP_ID, APP_NAME } from '@shared/constants'
import { IPC } from '@shared/channels'
import { hardenAllWebContents, hardenSession, hardenWindow } from './security'
import { BinaryService } from './services/binaries'
import { CookiesService } from './services/cookies'
import { DownloadQueue } from './services/queue'
import { SettingsService } from './services/settings'
import { YtDlpUpdater } from './services/updater'
import { YtDlpService } from './services/ytdlp'
import { registerIpc } from './ipc'

app.setName(APP_NAME)

let mainWindow: BrowserWindow | null = null

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })


  app.whenReady().then(start).catch((error) => {
    console.error('failed to start', error)
    app.quit()
  })
}

async function start(): Promise<void> {
  app.setAppUserModelId(APP_ID)
  Menu.setApplicationMenu(null)
  hardenAllWebContents()
  hardenSession(session.defaultSession)

  const settings = new SettingsService(app.getPath('userData'), defaultDownloadDir())
  const cookies = new CookiesService(app.getPath('userData'))
  const binaries = new BinaryService()
  const ytdlp = new YtDlpService(binaries)
  const updater = new YtDlpUpdater(binaries)

  const queue = new DownloadQueue({
    settings,
    cookies,
    binaries,
    ytdlp,
    onUpdate: (job) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC.downloadsUpdated, job)
      }
    }
  })

  registerIpc({
    getWindow: () => mainWindow,
    settings,
    cookies,
    binaries,
    queue,
    updater,
    ytdlp
  })

  mainWindow = createWindow()
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  const checkTimer = setTimeout(() => {
    updater
      .check()
      .then((info) => {
        if (info.available && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC.ytdlpUpdateAvailable, info)
        }
      })
      .catch(() => undefined)
  }, 3000)
  checkTimer.unref()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })

  app.on('before-quit', () => {
    clearTimeout(checkTimer)
    queue.dispose()
    cookies.cleanupAll()
  })
}

function createWindow(): BrowserWindow {
  const devUrl = !app.isPackaged ? process.env['ELECTRON_RENDERER_URL'] ?? null : null
  const window = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f5f5f7',
    title: APP_NAME,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      spellcheck: false,
      devTools: !app.isPackaged
    }
  })

  window.removeMenu()
  hardenWindow(window, devUrl)

  window.once('ready-to-show', () => {
    window.show()
  })

  if (devUrl) {
    void window.loadURL(devUrl)
  } else {
    void window.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return window
}

function defaultDownloadDir(): string {
  try {
    return path.join(app.getPath('downloads'), APP_NAME)
  } catch {
    return path.join(app.getPath('documents'), APP_NAME)
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
