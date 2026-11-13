import type { JSX } from 'react'
import { useI18n } from '../i18n'
import { IconArrowRight, IconLink, Spinner } from './Icons'

interface UrlBarProps {
  value: string
  analyzing: boolean
  disabled: boolean
  invalid: boolean
  onChange: (value: string) => void
  onAnalyze: () => void
  onPaste: () => void
}

export function UrlBar({
  value,
  analyzing,
  disabled,
  invalid,
  onChange,
  onAnalyze,
  onPaste
}: UrlBarProps): JSX.Element {
  const { t } = useI18n()

  return (
    <div className="url-area">
      <form
        className={`url-bar ${invalid ? 'is-invalid' : ''}`}
        onSubmit={(event) => {
          event.preventDefault()
          onAnalyze()
        }}
      >
        <span className="url-icon">
          <IconLink size={19} />
        </span>
        <input
          type="text"
          inputMode="url"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t('url.placeholder')}
          aria-label={t('url.label')}
          aria-invalid={invalid}
          aria-describedby="url-hint"
          disabled={disabled}
        />
        <span className="url-status" aria-live="polite">
          {analyzing ? (
            <>
              <Spinner size={16} />
              <span className="visually-hidden">{t('url.analyzing')}</span>
            </>
          ) : null}
        </span>
        <button type="button" className="text-button paste-button" onClick={onPaste}>
          {t('url.paste')}
        </button>
        <button
          type="submit"
          className="url-submit"
          disabled={disabled || !value.trim() || analyzing}
          aria-label={t('action.analyze')}
          title={t('action.analyze')}
        >
          <IconArrowRight size={18} />
        </button>
      </form>
      <p className="url-hint" id="url-hint">
        {t('url.hint')}
      </p>
    </div>
  )
}
