import { useEffect, useRef, useState, type JSX } from 'react'
import { useI18n } from '../i18n'
import { TermsClauses } from './LegalContent'
import { BrandMark, Spinner } from './Icons'

interface TermsDialogProps {
  open: boolean
  version: number
  onAccepted: () => Promise<void>
  onDecline: () => void
}

export function TermsDialog({ open, version, onAccepted, onDecline }: TermsDialogProps): JSX.Element {
  const { t } = useI18n()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      setChecked(false)
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  async function accept(): Promise<void> {
    if (!checked || busy) return
    setBusy(true)
    try {
      await onAccepted()
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal terms-dialog"
      aria-labelledby="terms-title"
      onCancel={(event) => event.preventDefault()}
    >
      <div className="terms-header">
        <BrandMark size={40} />
        <div>
          <h2 id="terms-title">{t('terms.title')}</h2>
          <p>{t('terms.version', { version })}</p>
        </div>
      </div>
      <div className="terms-body">
        <p className="terms-intro">{t('terms.intro')}</p>
        <TermsClauses />
      </div>
      <label className="terms-consent">
        <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} />
        <span>{t('terms.agree')}</span>
      </label>
      <div className="modal-footer">
        <button type="button" className="secondary-button" onClick={onDecline} disabled={busy}>
          {t('terms.decline')}
        </button>
        <button type="button" className="primary-button" onClick={accept} disabled={!checked || busy}>
          {busy ? <Spinner size={16} /> : null}
          {t('terms.accept')}
        </button>
      </div>
    </dialog>
  )
}
