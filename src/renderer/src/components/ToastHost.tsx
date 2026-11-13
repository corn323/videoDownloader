import type { JSX } from 'react'
import { useI18n } from '../i18n'
import { IconAlert, IconCheck, IconInfo, IconX } from './Icons'

export type ToastKind = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  message: string
  kind: ToastKind
}

interface ToastHostProps {
  toasts: ToastItem[]
  onDismiss: (id: number) => void
}

export function ToastHost({ toasts, onDismiss }: ToastHostProps): JSX.Element {
  const { t } = useI18n()
  return (
    <div className="toast-host" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.kind}`} role="status">
          <span className="toast-icon" aria-hidden>
            {toast.kind === 'success' ? <IconCheck size={16} /> : toast.kind === 'error' ? <IconAlert size={16} /> : <IconInfo size={16} />}
          </span>
          <span className="toast-message">{toast.message}</span>
          <button type="button" className="toast-close" onClick={() => onDismiss(toast.id)} aria-label={t('action.close')}>
            <IconX size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
