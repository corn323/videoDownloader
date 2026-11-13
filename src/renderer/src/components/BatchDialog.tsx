import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { parseBatchUrls } from '@shared/batch'
import { DEFAULT_SUBTITLE_LANGS } from '@shared/constants'
import type { AudioFormat, Container, DownloadRequest } from '@shared/types'
import { useI18n } from '../i18n'
import { FormatPicker, type FormatSelection } from './FormatPicker'
import { IconDownload, Spinner, IconX } from './Icons'

interface BatchDialogProps {
  open: boolean
  subtitleLangs: string
  initialSelection: FormatSelection
  onClose: () => void
  onAdd: (requests: DownloadRequest[]) => Promise<boolean>
}

const BATCH_HEIGHTS = [2160, 1440, 1080, 720, 480, 360]

export function BatchDialog({
  open,
  subtitleLangs,
  initialSelection,
  onClose,
  onAdd
}: BatchDialogProps): JSX.Element {
  const { t } = useI18n()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [text, setText] = useState('')
  const [selection, setSelection] = useState<FormatSelection>(initialSelection)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      setSelection(initialSelection)
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
  }, [open, initialSelection])

  const parsed = useMemo(() => parseBatchUrls(text), [text])

  const canSubmit =
    parsed.validCount > 0 && parsed.firstInvalidLine === null && !parsed.tooMany && !submitting

  async function submit(): Promise<void> {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const requests: DownloadRequest[] = parsed.links.map((link) => ({
        url: link,
        mode: selection.audioOnly ? 'audio' : 'video',
        height: selection.audioOnly ? null : selection.height,
        container: selection.container as Container,
        audioFormat: selection.audioFormat as AudioFormat,
        subtitles: {
          enabled: !selection.audioOnly && selection.subtitlesEnabled,
          langs: subtitleLangs || DEFAULT_SUBTITLE_LANGS
        },
        playlist: false
      }))
      const added = await onAdd(requests)
      if (added) {
        setText('')
        onClose()
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal batch-dialog"
      aria-labelledby="batch-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="modal-header">
        <div>
          <h2 id="batch-title">{t('batch.title')}</h2>
          <p>{t('batch.desc')}</p>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label={t('action.close')}>
          <IconX />
        </button>
      </div>

      <div className="modal-body">
        <label className="field field-wide">
          <span className="field-label">{t('batch.title')}</span>
          <textarea
            className="batch-textarea"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t('batch.placeholder')}
            rows={7}
            spellCheck={false}
          />
        </label>

        <div className="batch-status" aria-live="polite">
          {parsed.firstInvalidLine !== null ? (
            <span className="form-error">{t('batch.invalid', { line: parsed.firstInvalidLine })}</span>
          ) : parsed.tooMany ? (
            <span className="form-error">{t('batch.limit')}</span>
          ) : parsed.validCount > 0 ? (
            <span>
              {t('batch.valid', { count: parsed.validCount })}
              {parsed.duplicateCount > 0 ? ` · ${t('batch.duplicates', { count: parsed.duplicateCount })}` : ''}
            </span>
          ) : (
            <span className="muted">{t('batch.empty')}</span>
          )}
        </div>

        <FormatPicker
          selection={selection}
          heights={BATCH_HEIGHTS}
          subtitleLangs={subtitleLangs || DEFAULT_SUBTITLE_LANGS}
          onChange={setSelection}
        />
      </div>

      <div className="modal-footer">
        <button type="button" className="secondary-button" onClick={onClose}>
          {t('action.close')}
        </button>
        <button type="button" className="primary-button" onClick={submit} disabled={!canSubmit}>
          {submitting ? <Spinner size={16} /> : <IconDownload size={17} />}
          {t('batch.add', { count: parsed.validCount })}
        </button>
      </div>
    </dialog>
  )
}
