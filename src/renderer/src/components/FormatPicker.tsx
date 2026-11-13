import type { JSX } from 'react'
import { AUDIO_FORMATS, CONTAINERS } from '@shared/constants'
import type { AudioFormat, Container } from '@shared/types'
import { useI18n } from '../i18n'

export interface FormatSelection {
  audioOnly: boolean
  height: number | null
  container: Container
  audioFormat: AudioFormat
  subtitlesEnabled: boolean
}

interface FormatPickerProps {
  selection: FormatSelection
  heights: number[]
  subtitleLangs: string
  disabled?: boolean
  onChange: (next: FormatSelection) => void
}

export function FormatPicker({
  selection,
  heights,
  subtitleLangs,
  disabled = false,
  onChange
}: FormatPickerProps): JSX.Element {
  const { t } = useI18n()
  const update = (patch: Partial<FormatSelection>): void => onChange({ ...selection, ...patch })
  const heightOptions =
    selection.height !== null && !heights.includes(selection.height)
      ? [selection.height, ...heights]
      : heights

  return (
    <div className={`format-picker ${disabled ? 'is-disabled' : ''}`}>
      <div className="field field-wide">
        <span className="field-label">{t('format.mode')}</span>
        <div className="segmented" role="group" aria-label={t('format.mode')}>
          <button
            type="button"
            aria-pressed={!selection.audioOnly}
            className={!selection.audioOnly ? 'is-active' : ''}
            onClick={() => update({ audioOnly: false })}
            disabled={disabled}
          >
            {t('format.video')}
          </button>
          <button
            type="button"
            aria-pressed={selection.audioOnly}
            className={selection.audioOnly ? 'is-active' : ''}
            onClick={() => update({ audioOnly: true })}
            disabled={disabled}
          >
            {t('format.audio')}
          </button>
        </div>
      </div>

      {selection.audioOnly ? (
        <div className="field field-wide">
          <span className="field-label">{t('format.audioFormat')}</span>
          <div className="segmented" role="group" aria-label={t('format.audioFormat')}>
            {AUDIO_FORMATS.map((format) => (
              <button
                key={format}
                type="button"
                aria-pressed={selection.audioFormat === format}
                className={selection.audioFormat === format ? 'is-active' : ''}
                onClick={() => update({ audioFormat: format })}
                disabled={disabled}
              >
                {format.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="field">
            <label className="field-label" htmlFor="resolution-select">
              {t('format.resolution')}
            </label>
            <select
              id="resolution-select"
              value={selection.height === null ? 'best' : String(selection.height)}
              onChange={(event) => {
                update({ height: event.target.value === 'best' ? null : Number(event.target.value) })
              }}
              disabled={disabled}
            >
              <option value="best">{t('format.best')}</option>
              {heightOptions.map((height) => (
                <option key={height} value={height}>
                  {height}p
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <span className="field-label">{t('format.container')}</span>
            <div className="segmented" role="group" aria-label={t('format.container')}>
              {CONTAINERS.map((container) => (
                <button
                  key={container}
                  type="button"
                  aria-pressed={selection.container === container}
                  className={selection.container === container ? 'is-active' : ''}
                  onClick={() => update({ container })}
                  disabled={disabled}
                >
                  {container.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="field field-wide subtitle-field">
        <label className="switch-row">
          <input
            type="checkbox"
            checked={selection.audioOnly ? false : selection.subtitlesEnabled}
            onChange={(event) => update({ subtitlesEnabled: event.target.checked })}
            disabled={disabled || selection.audioOnly}
          />
          <span className="switch" aria-hidden />
          <span>
            <span className="switch-label">{t('format.subtitles')}</span>
            <span className="switch-hint">
              {selection.audioOnly ? t('format.note') : `${t('format.subtitleLangs')}: ${subtitleLangs}`}
            </span>
          </span>
        </label>
      </div>
    </div>
  )
}
