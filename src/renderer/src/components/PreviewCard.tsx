import { useEffect, useRef, useState, type JSX } from 'react'
import gsap from 'gsap'
import type { PublicError } from '@shared/errors'
import type { VideoInfo } from '@shared/types'
import { useI18n } from '../i18n'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { formatDuration, hostOf } from '../lib/format'
import { FormatPicker, type FormatSelection } from './FormatPicker'
import { IconAlert, IconDownload, IconPlay } from './Icons'

interface PreviewCardProps {
  info: VideoInfo
  selection: FormatSelection
  subtitleLangs: string
  selectedEntries: Set<string>
  submitting: boolean
  onSelectionChange: (next: FormatSelection) => void
  onToggleEntry: (url: string) => void
  onSelectAll: () => void
  onClearSelection: () => void
  onDownload: () => void
}

export function PreviewCard({
  info,
  selection,
  subtitleLangs,
  selectedEntries,
  submitting,
  onSelectionChange,
  onToggleEntry,
  onSelectAll,
  onClearSelection,
  onDownload
}: PreviewCardProps): JSX.Element {
  const { t } = useI18n()
  const cardRef = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const [failedThumbUrl, setFailedThumbUrl] = useState<string | null>(null)

  useEffect(() => {
    const card = cardRef.current
    if (!card) return
    if (reduced) {
      gsap.set(card, { opacity: 1, y: 0 })
      return
    }
    gsap.fromTo(
      card,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', clearProps: 'transform' }
    )
  }, [info.url, reduced])

  const spec = selection.audioOnly
    ? t('spec.audio', { format: selection.audioFormat.toUpperCase() })
    : selection.height !== null
      ? t('spec.video', { height: `${selection.height}p`, container: selection.container.toUpperCase() })
      : t('spec.best', { container: selection.container.toUpperCase() })
  const canDownload = !submitting && (!info.isPlaylist || selectedEntries.size > 0)

  return (
    <article className="preview-card" ref={cardRef}>
      <div className="preview-media">
        {info.thumbnail && failedThumbUrl !== info.url ? (
          <img
            src={info.thumbnail}
            alt=""
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setFailedThumbUrl(info.url)}
          />
        ) : (
          <div className="thumb-fallback" aria-hidden>
            <IconPlay size={30} />
          </div>
        )}
        {info.duration ? <span className="media-badge">{formatDuration(info.duration)}</span> : null}
        {info.isLive ? <span className="media-badge live">{t('preview.live')}</span> : null}
      </div>

      <div className="preview-body">
        <div className="preview-heading">
          <span className="eyebrow">
            {info.isPlaylist ? t('preview.playlist') : hostOf(info.url)}
            {info.isPlaylist ? ` · ${t('preview.playlistCount', { count: info.playlistCount })}` : ''}
          </span>
          <h2 className="preview-title" title={info.title}>
            {info.title}
          </h2>
          <div className="preview-meta">
            {info.uploader ? (
              <span>
                {t('preview.author')}: {info.uploader}
              </span>
            ) : null}
            {info.duration ? (
              <span>
                {t('preview.duration')}: {formatDuration(info.duration)}
              </span>
            ) : null}
          </div>
        </div>

        {info.isPlaylist ? (
          <div className="playlist-panel">
            <div className="playlist-toolbar">
              <span className="selected-count">{t('preview.selected', { count: selectedEntries.size })}</span>
              <div className="playlist-tools">
                <button type="button" className="text-button" onClick={onSelectAll}>
                  {t('preview.selectAll')}
                </button>
                <button type="button" className="text-button" onClick={onClearSelection}>
                  {t('preview.clearSelection')}
                </button>
              </div>
            </div>
            <div className="playlist-entries">
              {info.entries.map((entry, index) => (
                <label className="playlist-item" key={entry.url}>
                  <input
                    type="checkbox"
                    checked={selectedEntries.has(entry.url)}
                    onChange={() => onToggleEntry(entry.url)}
                  />
                  <span className="playlist-index">{index + 1}</span>
                  <span className="playlist-title" title={entry.title}>
                    {entry.title}
                  </span>
                  <span className="playlist-duration">{formatDuration(entry.duration)}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <FormatPicker
          selection={selection}
          heights={info.heights}
          subtitleLangs={subtitleLangs}
          onChange={onSelectionChange}
        />

        <div className="preview-footer">
          <div className="spec-summary">
            <span>{spec}</span>
            {!selection.audioOnly && selection.subtitlesEnabled ? (
              <span className="spec-note">{t('spec.subtitles', { langs: subtitleLangs })}</span>
            ) : null}
          </div>
          <button type="button" className="primary-button" onClick={onDownload} disabled={!canDownload}>
            <IconDownload size={18} />
            <span>{submitting ? t('action.downloading') : t('action.download')}</span>
          </button>
        </div>
      </div>
    </article>
  )
}

export function PreviewSkeleton(): JSX.Element {
  const { t } = useI18n()
  return (
    <div className="preview-card preview-skeleton" aria-busy="true" aria-live="polite">
      <div className="preview-media skeleton-block" />
      <div className="preview-body">
        <div className="skeleton-line w20" />
        <div className="skeleton-line w70 tall" />
        <div className="skeleton-line w40" />
        <div className="skeleton-grid">
          <div className="skeleton-line" />
          <div className="skeleton-line" />
          <div className="skeleton-line" />
        </div>
        <span className="visually-hidden">{t('preview.loading')}</span>
      </div>
    </div>
  )
}

interface AnalysisErrorProps {
  error: PublicError
  onRetry: () => void
}

export function AnalysisError({ error, onRetry }: AnalysisErrorProps): JSX.Element {
  const { t, te } = useI18n()
  return (
    <div className="analysis-error" role="alert">
      <span className="error-icon">
        <IconAlert />
      </span>
      <div className="analysis-error-body">
        <strong>{te(error.code)}</strong>
        {error.detail ? (
          <details className="error-details">
            <summary>{t('action.viewDetails')}</summary>
            <p>{error.detail}</p>
          </details>
        ) : null}
      </div>
      <button type="button" className="secondary-button" onClick={onRetry}>
        {t('action.analyze')}
      </button>
    </div>
  )
}
