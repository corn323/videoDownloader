import { useEffect, useRef, type JSX } from 'react'
import gsap from 'gsap'
import type { DownloadStatus } from '@shared/types'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { useI18n } from '../i18n'

interface ProgressBarProps {
  value: number
  status: DownloadStatus
}

export function ProgressBar({ value, status }: ProgressBarProps): JSX.Element {
  const fillRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const { t } = useI18n()
  const ratio = Math.max(0, Math.min(1, value / 100))
  const indeterminate = status === 'analyzing' || status === 'queued'

  useEffect(() => {
    const fill = fillRef.current
    if (!fill) return
    if (reduced) {
      gsap.set(fill, { scaleX: ratio })
      return
    }
    gsap.to(fill, { scaleX: ratio, duration: 0.4, ease: 'power2.out', overwrite: true })
  }, [ratio, reduced])

  return (
    <div
      className={`progress-track ${indeterminate ? 'is-indeterminate' : ''} status-${status}`}
      role="progressbar"
      aria-label={t('a11y.progress')}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : Math.round(value)}
    >
      <div className="progress-fill" ref={fillRef} style={{ transform: 'scaleX(0)' }} />
    </div>
  )
}
