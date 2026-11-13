import { useEffect, useRef, useState, type JSX } from 'react'
import {
  BROWSERS,
  COOKIES_MODES,
  DEFAULT_SUBTITLE_LANGS,
  LANGUAGES,
  THEMES
} from '@shared/constants'
import { isValidFilenameTemplate, isValidSubtitleLangs, renderFilename } from '@shared/filename'
import type {
  AppSettings,
  BrowserName,
  CookiesMode,
  CookiesStatus,
  Language,
  SettingsPatch,
  ThemeMode,
  UpdateProgress,
  YtDlpStatus,
  YtDlpUpdateInfo
} from '@shared/types'
import { useI18n } from '../i18n'
import {
  IconAlert,
  IconCheck,
  IconFolder,
  IconRefresh,
  IconSparkle,
  IconUpload,
  IconX,
  Spinner
} from './Icons'

export type SettingsTab = 'general' | 'appearance' | 'cookies' | 'about' | 'legal'

interface SettingsDialogProps {
  open: boolean
  settings: AppSettings
  ytdlp: YtDlpStatus
  cookies: CookiesStatus
  appVersion: string
  updateProgress: UpdateProgress | null
  initialTab: SettingsTab
  onClose: () => void
  onSave: (patch: SettingsPatch) => Promise<boolean>
  onChooseDir: () => Promise<AppSettings | null>
  onImportCookies: () => Promise<boolean>
  onClearCookies: () => Promise<void>
  onCheckUpdate: () => Promise<YtDlpUpdateInfo | null>
  onApplyUpdate: () => Promise<YtDlpStatus | null>
}

const TABS: SettingsTab[] = ['general', 'appearance', 'cookies', 'about', 'legal']

const TAB_LABEL_KEYS: Record<SettingsTab, 'settings.tab.general' | 'settings.tab.appearance' | 'settings.tab.cookies' | 'settings.tab.about' | 'settings.tab.legal'> = {
  general: 'settings.tab.general',
  appearance: 'settings.tab.appearance',
  cookies: 'settings.tab.cookies',
  about: 'settings.tab.about',
  legal: 'settings.tab.legal'
}

const PATH_KIND_KEYS = {
  managed: 'settings.ytdlpPath.managed',
  bundled: 'settings.ytdlpPath.bundled',
  missing: 'settings.ytdlpPath.missing'
} as const

const BROWSER_LABELS: Record<BrowserName, string> = {
  chrome: 'Chrome',
  edge: 'Edge',
  firefox: 'Firefox',
  brave: 'Brave',
  chromium: 'Chromium',
  opera: 'Opera',
  vivaldi: 'Vivaldi'
}

const LANGUAGE_LABELS: Record<Language, string> = {
  'zh-TW': '繁體中文',
  en: 'English'
}

export function SettingsDialog({
  open,
  settings,
  ytdlp,
  cookies,
  appVersion,
  updateProgress,
  initialTab,
  onClose,
  onSave,
  onChooseDir,
  onImportCookies,
  onClearCookies,
  onCheckUpdate,
  onApplyUpdate
}: SettingsDialogProps): JSX.Element {
  const { t } = useI18n()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [tab, setTab] = useState<SettingsTab>(initialTab)
  const [draft, setDraft] = useState<AppSettings>(settings)
  const [saving, setSaving] = useState(false)
  const [busyDir, setBusyDir] = useState(false)
  const [busyCookies, setBusyCookies] = useState(false)
  const [checking, setChecking] = useState(false)
  const [applying, setApplying] = useState(false)
  const [update, setUpdate] = useState<YtDlpUpdateInfo | null>(ytdlp.update)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      setTab(initialTab)
      setDraft(settings)
      setUpdate(ytdlp.update)
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
    // Re-sync only when the dialog is opened; settings changes are merged on save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const templateValid = isValidFilenameTemplate(draft.filenameTemplate)
  const langsValid = isValidSubtitleLangs(draft.subtitleLangs)
  const preview = templateValid
    ? renderFilename(draft.filenameTemplate, {
        title: 'Vela 範例影片',
        id: 'dQw4w9WgXcQ',
        uploader: 'Vela',
        date: '2026-01-01',
        resolution: '1080p'
      })
    : ''

  const patch = (next: Partial<AppSettings>): void => setDraft((current) => ({ ...current, ...next }))

  async function save(): Promise<void> {
    if (!templateValid || !langsValid || saving) return
    setSaving(true)
    const saved = await onSave({
      downloadDir: draft.downloadDir,
      filenameTemplate: draft.filenameTemplate,
      theme: draft.theme,
      language: draft.language,
      subtitleEnabled: draft.subtitleEnabled,
      subtitleLangs: draft.subtitleLangs,
      cookiesMode: draft.cookiesMode,
      cookiesBrowser: draft.cookiesBrowser,
      maxConcurrent: draft.maxConcurrent
    })
    setSaving(false)
    if (saved) onClose()
  }

  async function chooseDir(): Promise<void> {
    if (busyDir) return
    setBusyDir(true)
    const next = await onChooseDir()
    setBusyDir(false)
    if (next) setDraft(next)
  }

  async function importCookies(): Promise<void> {
    if (busyCookies) return
    setBusyCookies(true)
    const imported = await onImportCookies()
    setBusyCookies(false)
    if (imported) patch({ cookiesMode: 'file' })
  }

  async function clearCookies(): Promise<void> {
    if (busyCookies) return
    setBusyCookies(true)
    await onClearCookies()
    setBusyCookies(false)
    if (draft.cookiesMode === 'file') patch({ cookiesMode: 'none' })
  }

  async function checkUpdate(): Promise<void> {
    if (checking || applying) return
    setChecking(true)
    const info = await onCheckUpdate()
    setChecking(false)
    if (info) setUpdate(info)
  }

  async function applyUpdate(): Promise<void> {
    if (applying) return
    setApplying(true)
    const status = await onApplyUpdate()
    setApplying(false)
    if (status) {
      setUpdate((current) => ({
        available: false,
        currentVersion: status.version,
        latestVersion: current?.latestVersion ?? status.version,
        releaseUrl: current?.releaseUrl ?? null,
        notes: current?.notes ?? null
      }))
    }
  }

  const updatePercent =
    updateProgress?.totalBytes && updateProgress.totalBytes > 0
      ? Math.round((updateProgress.receivedBytes / updateProgress.totalBytes) * 100)
      : 0

  return (
    <dialog
      ref={dialogRef}
      className="modal settings-dialog"
      aria-labelledby="settings-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="modal-header settings-header">
        <h2 id="settings-title">{t('settings.title')}</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label={t('action.close')}>
          <IconX />
        </button>
      </div>

      <div className="settings-layout">
        <div className="settings-tabs" role="tablist" aria-label={t('settings.title')} aria-orientation="vertical">
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              id={`settings-tab-${item}`}
              aria-selected={tab === item}
              aria-controls={`settings-panel-${item}`}
              className={tab === item ? 'is-active' : ''}
              onClick={() => setTab(item)}
            >
              {t(TAB_LABEL_KEYS[item])}
            </button>
          ))}
        </div>

        <div className="settings-panels">
          {tab === 'general' ? (
            <section id="settings-panel-general" role="tabpanel" aria-labelledby="settings-tab-general" className="settings-panel">
              <div className="field field-wide">
                <span className="field-label">{t('settings.downloadDir')}</span>
                <div className="path-row">
                  <code title={draft.downloadDir}>{draft.downloadDir}</code>
                  <button type="button" className="secondary-button" onClick={chooseDir} disabled={busyDir}>
                    {busyDir ? <Spinner size={15} /> : <IconFolder size={16} />}
                    {t('action.chooseFolder')}
                  </button>
                </div>
                <span className="field-hint">{t('settings.downloadDirHint')}</span>
              </div>

              <label className="field field-wide">
                <span className="field-label">{t('settings.filenameTemplate')}</span>
                <input
                  type="text"
                  value={draft.filenameTemplate}
                  onChange={(event) => patch({ filenameTemplate: event.target.value })}
                  aria-invalid={!templateValid}
                  spellCheck={false}
                />
                {templateValid ? (
                  <span className="field-hint">
                    {t('settings.filenamePreview', { name: `${preview}.mp4` })}
                  </span>
                ) : (
                  <span className="field-hint form-error">{t('settings.filenameInvalid')}</span>
                )}
                <span className="field-hint muted">{t('settings.filenameHint')}</span>
              </label>

              <div className="settings-row">
                <label className="field">
                  <span className="field-label">{t('settings.concurrency')}</span>
                  <select
                    value={draft.maxConcurrent}
                    onChange={(event) => patch({ maxConcurrent: Number(event.target.value) })}
                  >
                    {[1, 2, 3].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">{t('settings.language')}</span>
                  <select
                    value={draft.language}
                    onChange={(event) => patch({ language: event.target.value as Language })}
                  >
                    {LANGUAGES.map((language) => (
                      <option key={language} value={language}>
                        {LANGUAGE_LABELS[language]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <span className="field-hint muted">{t('settings.concurrencyHint')}</span>

              <div className="settings-divider" />

              <label className="switch-row">
                <input
                  type="checkbox"
                  checked={draft.subtitleEnabled}
                  onChange={(event) => patch({ subtitleEnabled: event.target.checked })}
                />
                <span className="switch" aria-hidden />
                <span>
                  <span className="switch-label">{t('format.subtitles')}</span>
                  <span className="switch-hint">{t('format.note')}</span>
                </span>
              </label>
              <label className="field field-wide">
                <span className="field-label">{t('format.subtitleLangs')}</span>
                <input
                  type="text"
                  value={draft.subtitleLangs}
                  onChange={(event) => patch({ subtitleLangs: event.target.value })}
                  aria-invalid={!langsValid}
                  spellCheck={false}
                  placeholder={DEFAULT_SUBTITLE_LANGS}
                />
                {!langsValid ? <span className="field-hint form-error">{t('settings.filenameInvalid')}</span> : null}
              </label>
            </section>
          ) : null}

          {tab === 'appearance' ? (
            <section id="settings-panel-appearance" role="tabpanel" aria-labelledby="settings-tab-appearance" className="settings-panel">
              <div className="field field-wide">
                <span className="field-label">{t('settings.theme')}</span>
                <div className="segmented theme-segmented" role="group" aria-label={t('settings.theme')}>
                  {THEMES.map((theme) => (
                    <button
                      key={theme}
                      type="button"
                      aria-pressed={draft.theme === theme}
                      className={draft.theme === theme ? 'is-active' : ''}
                      onClick={() => patch({ theme: theme as ThemeMode })}
                    >
                      {t(`theme.${theme}` as 'theme.system' | 'theme.light' | 'theme.dark')}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {tab === 'cookies' ? (
            <section id="settings-panel-cookies" role="tabpanel" aria-labelledby="settings-tab-cookies" className="settings-panel">
              <div className="field field-wide">
                <span className="field-label">{t('settings.cookiesMode')}</span>
                <div className="radio-list">
                  {COOKIES_MODES.map((mode) => (
                    <label key={mode} className="radio-row">
                      <input
                        type="radio"
                        name="cookies-mode"
                        value={mode}
                        checked={draft.cookiesMode === mode}
                        onChange={() => patch({ cookiesMode: mode as CookiesMode })}
                        disabled={mode === 'file' && !cookies.encryptionAvailable}
                      />
                      <span>{t(mode === 'none' ? 'cookies.none' : mode === 'file' ? 'cookies.file' : 'cookies.browser')}</span>
                    </label>
                  ))}
                </div>
              </div>

              {!cookies.encryptionAvailable ? (
                <div className="inline-notice warning">
                  <IconAlert size={16} />
                  <span>{t('cookies.encryptionUnavailable')}</span>
                </div>
              ) : null}

              <div className="cookie-file-box">
                <div className="cookie-file-status">
                  <span className={`status-dot ${cookies.stored ? 'ok' : ''}`} aria-hidden />
                  <span>{cookies.stored ? t('cookies.imported') : t('cookies.notImported')}</span>
                </div>
                <div className="cookie-file-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={importCookies}
                    disabled={busyCookies || !cookies.encryptionAvailable}
                  >
                    {busyCookies ? <Spinner size={15} /> : <IconUpload size={16} />}
                    {t('action.import')}
                  </button>
                  {cookies.stored ? (
                    <button type="button" className="danger-button" onClick={clearCookies} disabled={busyCookies}>
                      {t('cookies.clear')}
                    </button>
                  ) : null}
                </div>
                <p className="field-hint muted">{t('cookies.importHint')}</p>
                <p className="field-hint muted">{t('cookies.encrypted')}</p>
              </div>

              {draft.cookiesMode === 'browser' ? (
                <label className="field field-wide">
                  <span className="field-label">{t('cookies.browserLabel')}</span>
                  <select
                    value={draft.cookiesBrowser}
                    onChange={(event) => patch({ cookiesBrowser: event.target.value as BrowserName })}
                  >
                    {BROWSERS.map((browser) => (
                      <option key={browser} value={browser}>
                        {BROWSER_LABELS[browser]}
                      </option>
                    ))}
                  </select>
                  <span className="field-hint muted">{t('cookies.browserHint')}</span>
                </label>
              ) : null}

              <div className="inline-notice">
                <IconAlert size={16} />
                <span>{t('cookies.disclaimer')}</span>
              </div>
            </section>
          ) : null}

          {tab === 'about' ? (
            <section id="settings-panel-about" role="tabpanel" aria-labelledby="settings-tab-about" className="settings-panel">
              <dl className="info-list">
                <div>
                  <dt>{t('settings.appVersion')}</dt>
                  <dd>{appVersion}</dd>
                </div>
                <div>
                  <dt>{t('settings.ytdlpVersion')}</dt>
                  <dd>{ytdlp.version ?? t('settings.notFound')}</dd>
                </div>
                <div>
                  <dt>{t('settings.ytdlpPath')}</dt>
                  <dd>{t(PATH_KIND_KEYS[ytdlp.pathKind])}</dd>
                </div>
                <div>
                  <dt>{t('settings.ffmpeg')}</dt>
                  <dd>{ytdlp.ffmpegFound ? t('settings.found') : t('settings.notFound')}</dd>
                </div>
              </dl>

              <div className="update-box">
                <div className="update-box-heading">
                  <span>{t('settings.about')}</span>
                  {update?.available ? (
                    <span className="badge accent">
                      <IconSparkle size={13} />
                      {t('settings.latestVersion')}: {update.latestVersion ?? '—'}
                    </span>
                  ) : null}
                </div>
                <p className="field-hint">
                  {update && !update.available
                    ? t('settings.upToDate')
                    : update?.available
                      ? t('settings.updateAvailable')
                      : t('settings.updateHint')}
                </p>
                <div className="update-actions">
                  <button type="button" className="secondary-button" onClick={checkUpdate} disabled={checking || applying}>
                    {checking ? <Spinner size={15} /> : <IconRefresh size={16} />}
                    {t('action.checkUpdate')}
                  </button>
                  {update?.available ? (
                    <button type="button" className="primary-button" onClick={applyUpdate} disabled={applying}>
                      {applying ? <Spinner size={15} /> : <IconCheck size={16} />}
                      {applying ? t('action.updating') : t('action.update')}
                    </button>
                  ) : null}
                </div>
                {applying ? (
                  <p className="field-hint">
                    {t('settings.updateProgress', { percent: updatePercent })} · {t('settings.updateNote')}
                  </p>
                ) : null}
                {update?.notes ? (
                  <details className="update-notes">
                    <summary>{t('action.viewDetails')}</summary>
                    <p>{update.notes}</p>
                  </details>
                ) : null}
              </div>
            </section>
          ) : null}

          {tab === 'legal' ? (
            <section id="settings-panel-legal" role="tabpanel" aria-labelledby="settings-tab-legal" className="settings-panel">
              <p>{t('settings.legalSummary')}</p>
              <p className="muted">{t('settings.termsVersion', { version: settings.acceptedTermsVersion })}</p>
              <p className="muted">{t('settings.legalManage')}</p>
              <div className="inline-notice">
                <IconAlert size={16} />
                <span>{t('footer.disclaimer')}</span>
              </div>
            </section>
          ) : null}
        </div>
      </div>

      <div className="modal-footer">
        <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>
          {t('action.close')}
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={save}
          disabled={saving || !templateValid || !langsValid}
        >
          {saving ? <Spinner size={15} /> : null}
          {saving ? t('action.saving') : t('action.save')}
        </button>
      </div>
    </dialog>
  )
}
