import type { JSX } from 'react'
import type { ThemeMode, YtDlpUpdateInfo } from '@shared/types'
import { useI18n } from '../i18n'
import {
  BrandMark,
  IconList,
  IconMonitor,
  IconMoon,
  IconSettings,
  IconSun,
  IconSparkle
} from './Icons'

interface HeaderProps {
  theme: ThemeMode
  update: YtDlpUpdateInfo | null
  onCycleTheme: () => void
  onOpenSettings: () => void
  onOpenBatch: () => void
  onOpenUpdate: () => void
}

export function Header({
  theme,
  update,
  onCycleTheme,
  onOpenSettings,
  onOpenBatch,
  onOpenUpdate
}: HeaderProps): JSX.Element {
  const { t } = useI18n()
  const ThemeIcon = theme === 'light' ? IconSun : theme === 'dark' ? IconMoon : IconMonitor

  return (
    <header className="app-header">
      <div className="brand">
        <BrandMark />
        <div className="brand-text">
          <span className="brand-name">{t('app.name')}</span>
          <span className="brand-tagline">{t('app.tagline')}</span>
        </div>
      </div>

      <div className="header-actions">
        {update?.available ? (
          <button type="button" className="update-pill" onClick={onOpenUpdate}>
            <IconSparkle size={15} />
            <span>{t('update.banner', { version: update.latestVersion ?? '' })}</span>
          </button>
        ) : null}

        <button
          type="button"
          className="icon-button"
          onClick={onOpenBatch}
          aria-label={t('nav.batch')}
          title={t('nav.batch')}
        >
          <IconList />
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={onCycleTheme}
          aria-label={t('nav.toggleTheme')}
          title={t('nav.toggleTheme')}
        >
          <ThemeIcon />
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={onOpenSettings}
          aria-label={t('nav.settings')}
          title={t('nav.settings')}
        >
          <IconSettings />
        </button>
      </div>
    </header>
  )
}
