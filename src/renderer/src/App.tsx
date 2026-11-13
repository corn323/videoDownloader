import { useCallback, useEffect, useRef, useState, type JSX } from 'react'
import { THEMES } from '@shared/constants'
import type { PublicError } from '@shared/errors'
import type {
  ApiResult,
  AppSettings,
  BootstrapData,
  CookiesStatus,
  DownloadJob,
  DownloadRequest,
  Language,
  SettingsPatch,
  UpdateProgress,
  VideoInfo,
  YtDlpStatus,
  YtDlpUpdateInfo
} from '@shared/types'
import { validateUrl } from '@shared/url'
import { I18nProvider, useI18n } from './i18n'
import { useTheme } from './hooks/useTheme'
import { useDebouncedValue } from './hooks/useDebouncedValue'
import { BatchDialog } from './components/BatchDialog'
import { Header } from './components/Header'
import { BrandMark, Spinner } from './components/Icons'
import { PreviewCard, PreviewSkeleton, AnalysisError } from './components/PreviewCard'
import type { FormatSelection } from './components/FormatPicker'
import { QueueList } from './components/QueueList'
import { SettingsDialog, type SettingsTab } from './components/SettingsDialog'
import { TermsDialog } from './components/TermsDialog'
import { ToastHost, type ToastItem, type ToastKind } from './components/ToastHost'
import { UrlBar } from './components/UrlBar'

type AnalysisState =
  | { status: 'idle' }
  | { status: 'ready'; info: VideoInfo }
  | { status: 'error'; error: PublicError }

const DEFAULT_SELECTION: FormatSelection = {
  audioOnly: false,
  height: null,
  container: 'mp4',
  audioFormat: 'mp3',
  subtitlesEnabled: false
}

function mergeJob(jobs: DownloadJob[], job: DownloadJob): DownloadJob[] {
  return jobs.some((item) => item.id === job.id)
    ? jobs.map((item) => (item.id === job.id ? job : item))
    : [...jobs, job]
}

function mergeJobs(jobs: DownloadJob[], incoming: DownloadJob[]): DownloadJob[] {
  return incoming.reduce(mergeJob, jobs)
}

interface AppShellProps {
  onLanguage: (language: Language) => void
}

function AppShell({ onLanguage }: AppShellProps): JSX.Element {
  const { t, te } = useI18n()
  const [boot, setBoot] = useState<BootstrapData | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [ytdlp, setYtdlp] = useState<YtDlpStatus | null>(null)
  const [cookies, setCookies] = useState<CookiesStatus | null>(null)
  const [booting, setBooting] = useState(true)
  const [bootError, setBootError] = useState<PublicError | null>(null)
  const [jobs, setJobs] = useState<DownloadJob[]>([])
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [headerUpdate, setHeaderUpdate] = useState<YtDlpUpdateInfo | null>(null)
  const [updateProgress, setUpdateProgress] = useState<UpdateProgress | null>(null)

  const [url, setUrl] = useState('')
  const [urlInvalid, setUrlInvalid] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<AnalysisState>({ status: 'idle' })
  const [selection, setSelection] = useState<FormatSelection>(DEFAULT_SELECTION)
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general')
  const [batchOpen, setBatchOpen] = useState(false)

  const lastProbed = useRef('')
  const probeSeq = useRef(0)
  const toastSeq = useRef(0)

  useTheme(settings?.theme ?? 'system')

  const pushToast = useCallback((kind: ToastKind, message: string): void => {
    const id = ++toastSeq.current
    setToasts((current) => [...current.slice(-3), { id, message, kind }])
    window.setTimeout(
      () => setToasts((current) => current.filter((item) => item.id !== id)),
      kind === 'error' ? 8000 : 4500
    )
  }, [])

  const dismissToast = useCallback((id: number): void => {
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const refreshJobs = useCallback(async (): Promise<void> => {
    const result = await window.vela.listDownloads()
    if (result.ok) setJobs(result.data)
  }, [])

  const loadBootstrap = useCallback(async (): Promise<void> => {
    setBooting(true)
    setBootError(null)
    const result = await window.vela.bootstrap()
    if (!result.ok) {
      setBootError(result.error)
      setBooting(false)
      return
    }
    const data = result.data
    setBoot(data)
    setSettings(data.settings)
    setYtdlp(data.ytdlp)
    setCookies(data.cookies)
    setHeaderUpdate(data.ytdlp.update?.available ? data.ytdlp.update : null)
    setSelection((current) => ({ ...current, subtitlesEnabled: data.settings.subtitleEnabled }))
    onLanguage(data.settings.language)
    setBooting(false)
    await refreshJobs()
  }, [onLanguage, refreshJobs])

  useEffect(() => {
    void loadBootstrap()
  }, [loadBootstrap])

  const booted = Boolean(boot)
  useEffect(() => {
    if (!booted) return
    const unsubscribeDownloads = window.vela.onDownloadsUpdated((job) => {
      setJobs((current) => mergeJob(current, job))
    })
    const unsubscribeUpdate = window.vela.onYtdlpUpdateAvailable((info) => {
      setHeaderUpdate(info.available ? info : null)
      setYtdlp((current) => (current ? { ...current, update: info } : current))
    })
    const unsubscribeProgress = window.vela.onYtdlpUpdateProgress((progress) => {
      setUpdateProgress(progress)
    })
    return () => {
      unsubscribeDownloads()
      unsubscribeUpdate()
      unsubscribeProgress()
    }
  }, [booted])

  const acceptTerms = useCallback(async (): Promise<void> => {
    const result = await window.vela.acceptTerms()
    if (!result.ok) {
      pushToast('error', te(result.error.code))
      return
    }
    setSettings(result.data)
    setBoot((current) =>
      current ? { ...current, termsAccepted: true, settings: result.data } : current
    )
    onLanguage(result.data.language)
    await refreshJobs()
  }, [onLanguage, pushToast, refreshJobs, te])

  const declineTerms = useCallback((): void => {
    void window.vela.quitApp().then((result) => {
      if (!result.ok) pushToast('error', te(result.error.code))
    })
  }, [pushToast, te])

  const applySettings = useCallback(
    async (patch: SettingsPatch, announce = true): Promise<boolean> => {
      const result = await window.vela.updateSettings(patch)
      if (!result.ok) {
        pushToast('error', te(result.error.code))
        return false
      }
      setSettings(result.data)
      setBoot((current) => (current ? { ...current, settings: result.data } : current))
      onLanguage(result.data.language)
      if (announce) pushToast('success', t('toast.saved'))
      return true
    },
    [onLanguage, pushToast, t, te]
  )

  const chooseDir = useCallback(async (): Promise<AppSettings | null> => {
    const result = await window.vela.chooseDownloadDir()
    if (!result.ok) {
      pushToast('error', te(result.error.code))
      return null
    }
    const next = result.data
    if (next) {
      setSettings(next)
      setBoot((current) => (current ? { ...current, settings: next } : current))
      pushToast('success', t('toast.dirChanged'))
    }
    return next
  }, [pushToast, t, te])

  const importCookies = useCallback(async (): Promise<boolean> => {
    const result = await window.vela.importCookies()
    if (!result.ok) {
      pushToast('error', te(result.error.code))
      return false
    }
    if (!result.data.imported) return false
    setCookies((current) => (current ? { ...current, stored: true } : current))
    pushToast('success', t('toast.cookiesImported'))
    return true
  }, [pushToast, t, te])

  const clearCookies = useCallback(async (): Promise<void> => {
    const result = await window.vela.clearCookies()
    if (!result.ok) {
      pushToast('error', te(result.error.code))
      return
    }
    setCookies(result.data)
    pushToast('success', t('toast.cookiesCleared'))
  }, [pushToast, t, te])

  const checkUpdate = useCallback(async (): Promise<YtDlpUpdateInfo | null> => {
    const result = await window.vela.checkYtdlpUpdate()
    if (!result.ok) {
      pushToast('error', te(result.error.code))
      return null
    }
    const info = result.data
    setHeaderUpdate(info.available ? info : null)
    setYtdlp((current) => (current ? { ...current, update: info } : current))
    pushToast(
      info.available ? 'info' : 'success',
      info.available
        ? t('toast.updateAvailable', { version: info.latestVersion ?? '' })
        : t('toast.noUpdate')
    )
    return info
  }, [pushToast, t, te])

  const applyUpdate = useCallback(async (): Promise<YtDlpStatus | null> => {
    setUpdateProgress(null)
    const result = await window.vela.applyYtdlpUpdate()
    setUpdateProgress(null)
    if (!result.ok) {
      pushToast('error', te(result.error.code))
      return null
    }
    setYtdlp(result.data)
    setHeaderUpdate(null)
    pushToast('success', t('toast.updateDone'))
    return result.data
  }, [pushToast, t, te])

  const handleJobResult = useCallback(
    async (promise: Promise<ApiResult<DownloadJob>>): Promise<void> => {
      const result = await promise
      if (!result.ok) {
        pushToast('error', te(result.error.code))
        return
      }
      setJobs((current) => mergeJob(current, result.data))
    },
    [pushToast, te]
  )

  const removeJob = useCallback(
    async (id: string): Promise<void> => {
      const result = await window.vela.removeDownload(id)
      if (!result.ok) {
        pushToast('error', te(result.error.code))
        return
      }
      setJobs((current) => current.filter((job) => job.id !== id))
      pushToast('success', t('toast.removed'))
    },
    [pushToast, t, te]
  )

  const revealJob = useCallback(
    async (id: string): Promise<void> => {
      const result = await window.vela.revealDownload(id)
      if (!result.ok) pushToast('error', te(result.error.code))
    },
    [pushToast, te]
  )

  const analyze = useCallback(
    async (input: string): Promise<void> => {
      const target = input.trim()
      if (!target) {
        pushToast('error', t('validation.urlRequired'))
        return
      }
      if (!validateUrl(target).ok) {
        setUrlInvalid(true)
        pushToast('error', t('validation.invalidUrl'))
        return
      }
      setUrlInvalid(false)
      lastProbed.current = target
      const seq = ++probeSeq.current
      setAnalyzing(true)
      setAnalysis({ status: 'idle' })
      const result = await window.vela.probe(target)
      if (seq !== probeSeq.current) return
      setAnalyzing(false)
      if (!result.ok) {
        setAnalysis({ status: 'error', error: result.error })
        return
      }
      const info = result.data
      setAnalysis({ status: 'ready', info })
      setSelectedEntries(new Set(info.entries.map((entry) => entry.url)))
      setSelection((current) => ({
        ...current,
        height:
          current.height !== null && !info.heights.includes(current.height) ? null : current.height,
        subtitlesEnabled: current.audioOnly ? false : current.subtitlesEnabled
      }))
    },
    [pushToast, t]
  )

  const debouncedUrl = useDebouncedValue(url, 700)
  useEffect(() => {
    if (!boot?.termsAccepted) return
    const candidate = debouncedUrl.trim()
    if (!candidate || candidate === lastProbed.current) return
    if (!validateUrl(candidate).ok) return
    void analyze(candidate)
  }, [debouncedUrl, boot?.termsAccepted, analyze])

  function changeUrl(value: string): void {
    setUrl(value)
    setUrlInvalid(false)
    lastProbed.current = ''
    probeSeq.current += 1
    if (analyzing) setAnalyzing(false)
    if (analysis.status !== 'idle') setAnalysis({ status: 'idle' })
  }

  async function pasteUrl(): Promise<void> {
    const result = await window.vela.readClipboard()
    if (!result.ok || !result.data) {
      pushToast('error', t('url.pasteUnavailable'))
      return
    }
    changeUrl(result.data.trim().slice(0, 2048))
  }

  const toggleEntry = useCallback((entryUrl: string): void => {
    setSelectedEntries((current) => {
      const next = new Set(current)
      if (next.has(entryUrl)) next.delete(entryUrl)
      else next.add(entryUrl)
      return next
    })
  }, [])

  const selectAllEntries = useCallback((): void => {
    if (analysis.status !== 'ready') return
    setSelectedEntries(new Set(analysis.info.entries.map((entry) => entry.url)))
  }, [analysis])

  const clearEntries = useCallback((): void => {
    setSelectedEntries(new Set())
  }, [])

  async function submitDownload(): Promise<void> {
    if (analysis.status !== 'ready' || !settings || submitting) return
    const info = analysis.info
    if (info.isPlaylist && selectedEntries.size === 0) {
      pushToast('error', t('validation.noEntries'))
      return
    }
    const entries = info.isPlaylist
      ? info.entries.filter((entry) => selectedEntries.has(entry.url))
      : [null]
    const requests: DownloadRequest[] = entries.map((entry) => ({
      url: entry?.url ?? info.url,
      title: entry?.title ?? info.title,
      id: entry?.id ?? info.id ?? undefined,
      uploader: info.uploader ?? undefined,
      thumbnail: entry?.thumbnail ?? info.thumbnail ?? undefined,
      mode: selection.audioOnly ? 'audio' : 'video',
      height: selection.audioOnly ? null : selection.height,
      container: selection.container,
      audioFormat: selection.audioFormat,
      subtitles: {
        enabled: !selection.audioOnly && selection.subtitlesEnabled,
        langs: settings.subtitleLangs
      },
      playlist: false
    }))
    setSubmitting(true)
    const result = await window.vela.addDownloads(requests)
    setSubmitting(false)
    if (!result.ok) {
      pushToast('error', te(result.error.code))
      return
    }
    setJobs((current) => mergeJobs(current, result.data))
    pushToast(
      'success',
      requests.length > 1 ? t('toast.addedBatch', { count: requests.length }) : t('toast.added')
    )
    probeSeq.current += 1
    lastProbed.current = ''
    setUrl('')
    setUrlInvalid(false)
    setAnalysis({ status: 'idle' })
    setSelectedEntries(new Set())
  }

  async function addBatch(requests: DownloadRequest[]): Promise<boolean> {
    const result = await window.vela.addDownloads(requests)
    if (!result.ok) {
      pushToast('error', te(result.error.code))
      return false
    }
    setJobs((current) => mergeJobs(current, result.data))
    pushToast('success', t('toast.addedBatch', { count: requests.length }))
    return true
  }

  function cycleTheme(): void {
    if (!settings) return
    const index = THEMES.indexOf(settings.theme)
    const next = THEMES[(index + 1) % THEMES.length]
    void applySettings({ theme: next }, false)
  }

  function openSettings(tab: SettingsTab = 'general'): void {
    setSettingsTab(tab)
    setSettingsOpen(true)
  }

  if (!boot || !settings || !ytdlp || !cookies) {
    if (bootError) {
      return (
        <div className="boot-screen">
          <BrandMark size={54} />
          <h1>{t('bootstrap.error')}</h1>
          <p>{te(bootError.code)}</p>
          <button type="button" className="primary-button" onClick={() => void loadBootstrap()}>
            {t('bootstrap.retry')}
          </button>
        </div>
      )
    }
    return (
      <div className="boot-screen" aria-busy={booting}>
        <BrandMark size={54} />
        <Spinner size={22} />
        <p>{t('bootstrap.loading')}</p>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Header
        theme={settings.theme}
        update={headerUpdate}
        onCycleTheme={cycleTheme}
        onOpenSettings={() => openSettings('general')}
        onOpenBatch={() => setBatchOpen(true)}
        onOpenUpdate={() => openSettings('about')}
      />

      <main className="app-main">
        <section className="hero">
          <h1>{t('hero.title')}</h1>
          <p>{t('hero.subtitle')}</p>
        </section>

        <UrlBar
          value={url}
          analyzing={analyzing}
          disabled={!boot.termsAccepted || submitting}
          invalid={urlInvalid}
          onChange={changeUrl}
          onAnalyze={() => void analyze(url)}
          onPaste={() => void pasteUrl()}
        />

        <div className="stage">
          {analyzing ? <PreviewSkeleton /> : null}
          {!analyzing && analysis.status === 'error' ? (
            <AnalysisError error={analysis.error} onRetry={() => void analyze(url)} />
          ) : null}
          {!analyzing && analysis.status === 'ready' ? (
            <PreviewCard
              info={analysis.info}
              selection={selection}
              subtitleLangs={settings.subtitleLangs}
              selectedEntries={selectedEntries}
              submitting={submitting}
              onSelectionChange={setSelection}
              onToggleEntry={toggleEntry}
              onSelectAll={selectAllEntries}
              onClearSelection={clearEntries}
              onDownload={() => void submitDownload()}
            />
          ) : null}
        </div>

        <QueueList
          jobs={jobs}
          onPause={(id) => void handleJobResult(window.vela.pauseDownload(id))}
          onResume={(id) => void handleJobResult(window.vela.resumeDownload(id))}
          onCancel={(id) => void handleJobResult(window.vela.cancelDownload(id))}
          onRetry={(id) => void handleJobResult(window.vela.retryDownload(id))}
          onRemove={(id) => void removeJob(id)}
          onReveal={(id) => void revealJob(id)}
        />
      </main>

      <footer className="app-footer">
        <p>{t('footer.disclaimer')}</p>
        <div className="footer-meta">
          <span>{t('footer.version', { version: boot.appVersion })}</span>
          <span className="dot" aria-hidden />
          <span>{t('footer.localOnly')}</span>
        </div>
      </footer>

      <TermsDialog
        open={!boot.termsAccepted}
        version={boot.termsVersion}
        onAccepted={acceptTerms}
        onDecline={declineTerms}
      />

      <SettingsDialog
        open={settingsOpen}
        settings={settings}
        ytdlp={ytdlp}
        cookies={cookies}
        appVersion={boot.appVersion}
        updateProgress={updateProgress}
        initialTab={settingsTab}
        onClose={() => setSettingsOpen(false)}
        onSave={(patch) => applySettings(patch, true)}
        onChooseDir={chooseDir}
        onImportCookies={importCookies}
        onClearCookies={clearCookies}
        onCheckUpdate={checkUpdate}
        onApplyUpdate={applyUpdate}
      />

      <BatchDialog
        open={batchOpen}
        subtitleLangs={settings.subtitleLangs}
        initialSelection={selection}
        onClose={() => setBatchOpen(false)}
        onAdd={addBatch}
      />

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

export function App(): JSX.Element {
  const [language, setLanguage] = useState<Language>('zh-TW')
  return (
    <I18nProvider language={language}>
      <AppShell onLanguage={setLanguage} />
    </I18nProvider>
  )
}
