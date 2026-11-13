import { app, type BrowserWindow, type Session } from 'electron'
import { DEV_CSP, PROD_CSP } from '@shared/csp'

export function isTrustedRenderer(
  event: Electron.IpcMainInvokeEvent,
  window: BrowserWindow | null
): boolean {
  if (!window || window.isDestroyed()) return false
  if (event.sender !== window.webContents) return false
  return event.senderFrame === window.webContents.mainFrame
}

export function hardenSession(session: Session): void {
  session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })
  session.setPermissionCheckHandler(() => false)

  session.webRequest.onHeadersReceived((details, callback) => {
    if (details.resourceType === 'mainFrame' && !details.url.startsWith('devtools://')) {
      const headers = { ...(details.responseHeaders ?? {}) }
      for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === 'content-security-policy') delete headers[key]
      }
      headers['Content-Security-Policy'] = [app.isPackaged ? PROD_CSP : DEV_CSP]
      callback({ responseHeaders: headers })
      return
    }
    callback({ responseHeaders: details.responseHeaders })
  })
}

export function hardenWindow(window: BrowserWindow, devUrl: string | null): void {
  const contents = window.webContents
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  contents.on('will-attach-webview', (event) => {
    event.preventDefault()
  })
  contents.on('will-navigate', (event, targetUrl) => {
    if (!isAllowedNavigation(contents.getURL(), targetUrl, devUrl)) event.preventDefault()
  })
  contents.on('will-redirect', (event, targetUrl) => {
    if (!isAllowedNavigation(contents.getURL(), targetUrl, devUrl)) event.preventDefault()
  })
}

export function hardenAllWebContents(): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }))
    contents.on('will-attach-webview', (event) => {
      event.preventDefault()
    })
  })
}

function isAllowedNavigation(currentUrl: string, targetUrl: string, devUrl: string | null): boolean {
  if (targetUrl === currentUrl) return true
  if (!devUrl) return false
  try {
    return new URL(targetUrl).origin === new URL(devUrl).origin
  } catch {
    return false
  }
}
