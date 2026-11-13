import type { JSX } from 'react'
import type { DownloadJob, DownloadStatus } from '@shared/types'
import { useI18n } from '../i18n'
import { useFlipList } from '../hooks/useFlipList'
import { DownloadRow } from './DownloadRow'
import { IconDownload } from './Icons'

interface QueueListProps {
  jobs: DownloadJob[]
  onPause: (id: string) => void
  onResume: (id: string) => void
  onCancel: (id: string) => void
  onRetry: (id: string) => void
  onRemove: (id: string) => void
  onReveal: (id: string) => void
}

const RANK: Record<DownloadStatus, number> = {
  downloading: 0,
  merging: 1,
  analyzing: 2,
  queued: 3,
  paused: 4,
  failed: 5,
  cancelled: 6,
  completed: 7
}

export function QueueList({
  jobs,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onRemove,
  onReveal
}: QueueListProps): JSX.Element {
  const { t } = useI18n()
  const sorted = [...jobs].sort((a, b) => {
    const rank = RANK[a.status] - RANK[b.status]
    if (rank !== 0) return rank
    return b.createdAt - a.createdAt
  })
  const setRowRef = useFlipList(sorted.map((job) => job.id))
  const activeCount = sorted.filter(
    (job) => job.status === 'downloading' || job.status === 'merging' || job.status === 'analyzing'
  ).length

  return (
    <section className="queue-section" aria-labelledby="queue-title">
      <div className="section-heading">
        <div>
          <h2 id="queue-title">{t('queue.title')}</h2>
          <p>{t('queue.subtitle')}</p>
        </div>
        <div className="queue-counts">
          <span>{t('queue.count', { count: sorted.length })}</span>
          {activeCount > 0 ? <span className="active-count">{t('queue.active', { count: activeCount })}</span> : null}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="queue-empty">
          <span className="queue-empty-icon" aria-hidden>
            <IconDownload size={26} />
          </span>
          <h3>{t('queue.emptyTitle')}</h3>
          <p>{t('queue.emptyDesc')}</p>
          <ol className="steps">
            <li>
              <span>1</span>
              {t('queue.step1')}
            </li>
            <li>
              <span>2</span>
              {t('queue.step2')}
            </li>
            <li>
              <span>3</span>
              {t('queue.step3')}
            </li>
          </ol>
        </div>
      ) : (
        <div className="download-list" aria-label={t('a11y.downloadList')}>
          {sorted.map((job) => (
            <DownloadRow
              key={job.id}
              job={job}
              rowRef={setRowRef(job.id)}
              onPause={onPause}
              onResume={onResume}
              onCancel={onCancel}
              onRetry={onRetry}
              onRemove={onRemove}
              onReveal={onReveal}
            />
          ))}
        </div>
      )}
    </section>
  )
}
