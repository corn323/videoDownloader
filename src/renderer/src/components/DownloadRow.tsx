import { useState, type JSX } from 'react'
import type { DownloadJob, DownloadStatus } from '@shared/types'
import { useI18n } from '../i18n'
import { formatBytes, formatEta, formatSpeed, hostOf, percentLabel } from '../lib/format'
import { ProgressBar } from './ProgressBar'
import {
  IconAlert,
  IconCheck,
  IconFolder,
  IconPause,
  IconPlay,
  IconRetry,
  IconTrash,
  IconX
} from './Icons'

interface DownloadRowProps {
  job: DownloadJob
  rowRef: (element: HTMLDivElement | null) => void
  onPause: (id: string) => void
  onResume: (id: string) => void
  onCancel: (id: string) => void
  onRetry: (id: string) => void
  onRemove: (id: string) => void
  onReveal: (id: string) => void
}

const STATUS_KEYS: Record<DownloadStatus, 'status.queued' | 'status.analyzing' | 'status.downloading' | 'status.paused' | 'status.merging' | 'status.completed' | 'status.failed' | 'status.cancelled'> = {
  queued: 'status.queued',
  analyzing: 'status.analyzing',
  downloading: 'status.downloading',
  paused: 'status.paused',
  merging: 'status.merging',
  completed: 'status.completed',
  failed: 'status.failed',
  cancelled: 'status.cancelled'
}

export function DownloadRow({
  job,
  rowRef,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onRemove,
  onReveal
}: DownloadRowProps): JSX.Element {
  const { t, te } = useI18n()
  const [thumbFailed, setThumbFailed] = useState(false)

  const spec =
    job.mode === 'audio'
      ? t('spec.audio', { format: job.audioFormat.toUpperCase() })
      : job.height !== null
        ? t('spec.video', { height: `${job.height}p`, container: job.container.toUpperCase() })
        : t('spec.best', { container: job.container.toUpperCase() })

  const isActive = job.status === 'downloading' || job.status === 'merging' || job.status === 'analyzing'
  const isBusy = isActive || job.status === 'queued'
  const canRetry = job.error?.code !== 'DRM_PROTECTED'
  const fileName = job.outputPath ? job.outputPath.split(/[\\/]/).pop() ?? job.outputPath : null

  return (
    <div className={`download-row status-${job.status}`} ref={rowRef}>
      <div className="download-thumb">
        {job.thumbnail && !thumbFailed ? (
          <img src={job.thumbnail} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setThumbFailed(true)} />
        ) : (
          <span className="thumb-fallback small" aria-hidden>
            {job.mode === 'audio' ? '♪' : <IconPlay size={18} />}
          </span>
        )}
      </div>

      <div className="download-main">
        <div className="download-heading">
          <div className="download-title-wrap">
            <span className="download-title" title={job.title}>
              {job.title}
            </span>
            <span className="download-sub">
              {hostOf(job.url)} · {spec}
              {job.subtitles.enabled ? ` · ${t('spec.subtitles', { langs: job.subtitles.langs })}` : ''}
            </span>
          </div>
          <span className={`status-badge status-${job.status}`} aria-live="polite">
            {job.status === 'completed' ? <IconCheck size={13} /> : null}
            {job.status === 'failed' ? <IconAlert size={13} /> : null}
            {t(STATUS_KEYS[job.status])}
          </span>
        </div>

        <div className="download-progress-wrap">
          <ProgressBar value={job.status === 'completed' ? 100 : job.progress} status={job.status} />
          <div className="download-progress-meta">
            <span>{job.status === 'completed' ? '100%' : percentLabel(job.progress)}</span>
            {job.status === 'downloading' || job.status === 'merging' ? (
              <>
                <span>
                  {t('job.speed')}: {formatSpeed(job.speed)}
                </span>
                <span>
                  {t('job.eta')}: {formatEta(job.eta)}
                </span>
                {job.downloadedBytes > 0 ? (
                  <span>
                    {t('job.ofTotal', {
                      done: formatBytes(job.downloadedBytes),
                      total: job.totalBytes !== null ? formatBytes(job.totalBytes) : '—'
                    })}
                  </span>
                ) : null}
              </>
            ) : null}
            {job.status === 'completed' && fileName ? (
              <span className="completed-file" title={job.outputPath ?? undefined}>
                {t('job.completedFile')}: {fileName}
              </span>
            ) : null}
          </div>
        </div>

        {job.error ? (
          <div className="download-error" role="alert">
            <IconAlert size={15} />
            <div>
              <span>{te(job.error.code)}</span>
              {job.error.detail ? (
                <details className="error-details inline">
                  <summary>{t('action.viewDetails')}</summary>
                  <p>{job.error.detail}</p>
                </details>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="download-actions">
        {isBusy ? (
          <button type="button" className="icon-button small" onClick={() => onPause(job.id)} aria-label={t('action.pause')} title={t('action.pause')}>
            <IconPause size={16} />
          </button>
        ) : null}
        {job.status === 'paused' ? (
          <button type="button" className="icon-button small" onClick={() => onResume(job.id)} aria-label={t('action.resume')} title={t('action.resume')}>
            <IconPlay size={16} />
          </button>
        ) : null}
        {isBusy || job.status === 'paused' ? (
          <button type="button" className="icon-button small" onClick={() => onCancel(job.id)} aria-label={t('action.cancel')} title={t('action.cancel')}>
            <IconX size={16} />
          </button>
        ) : null}
        {(job.status === 'failed' || job.status === 'cancelled') && canRetry ? (
          <button type="button" className="icon-button small" onClick={() => onRetry(job.id)} aria-label={t('action.retry')} title={t('action.retry')}>
            <IconRetry size={16} />
          </button>
        ) : null}
        {job.status === 'completed' && job.outputPath ? (
          <button type="button" className="icon-button small" onClick={() => onReveal(job.id)} aria-label={t('action.reveal')} title={t('action.reveal')}>
            <IconFolder size={16} />
          </button>
        ) : null}
        {job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled' ? (
          <button type="button" className="icon-button small" onClick={() => onRemove(job.id)} aria-label={t('action.remove')} title={t('action.remove')}>
            <IconTrash size={16} />
          </button>
        ) : null}
      </div>
    </div>
  )
}
