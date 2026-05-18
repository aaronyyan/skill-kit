import { MonitorCog, Moon, Sun } from 'lucide-react'
import type { LanguagePreference, ThemePreference, Translate } from '../constants/i18n'

function PreferenceRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 px-1 py-1">
      <div className="w-fit shrink-0 !whitespace-nowrap pr-2 text-[14px] font-medium text-[var(--text-primary)]">{label}</div>
      {children}
    </div>
  )
}

export function SettingsPanel({
  themePreference,
  language,
  debugMode,
  onThemeChange,
  onLanguageChange,
  onDebugModeChange,
  t,
}: {
  themePreference: ThemePreference
  language: LanguagePreference
  debugMode: boolean
  onThemeChange: (value: ThemePreference) => void
  onLanguageChange: (value: LanguagePreference) => void
  onDebugModeChange: (value: boolean) => void
  t: Translate
}) {
  const themeOptions: Array<{
    key: ThemePreference
    icon: React.ReactNode
    label: string
  }> = [
    { key: 'light', icon: <Sun className="h-4 w-4" />, label: t('themeLight') },
    { key: 'dark', icon: <Moon className="h-4 w-4" />, label: t('themeDark') },
    { key: 'system', icon: <MonitorCog className="h-4 w-4" />, label: t('themeSystem') },
  ]

  const languageOptions: Array<{ key: LanguagePreference; label: string }> = [
    { key: 'zh', label: t('languageZh') },
    { key: 'en', label: t('languageEn') },
  ]

  return (
    <div className="space-y-3">
      <PreferenceRow label={t('theme')}>
        <div className="grid flex-1 grid-cols-3 gap-2">
          {themeOptions.map((option) => {
            const active = option.key === themePreference
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => onThemeChange(option.key)}
                className={[
                  'flex h-10 items-center justify-center gap-2 rounded-[8px] border px-3 text-[13px] transition',
                  active
                    ? 'border-[var(--accent)] bg-[var(--panel-1)] text-[var(--text-primary)]'
                    : 'border-[var(--line-soft)] bg-[var(--chrome-elevated)] text-[var(--text-secondary)] hover:border-[var(--line-strong)] hover:text-[var(--text-primary)]',
                ].join(' ')}
              >
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
                  {option.icon}
                </span>
                <span className="font-medium">{option.label}</span>
              </button>
            )
          })}
        </div>
      </PreferenceRow>

      <PreferenceRow label={t('language')}>
        <div className="grid flex-1 grid-cols-2 gap-2">
          {languageOptions.map((option) => {
            const active = option.key === language
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => onLanguageChange(option.key)}
                className={[
                  'flex h-10 items-center justify-center rounded-[8px] border px-3 text-[13px] font-medium transition',
                  active
                    ? 'border-[var(--accent)] bg-[var(--panel-1)] text-[var(--text-primary)]'
                    : 'border-[var(--line-soft)] bg-[var(--chrome-elevated)] text-[var(--text-secondary)] hover:border-[var(--line-strong)] hover:text-[var(--text-primary)]',
                ].join(' ')}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </PreferenceRow>

      <PreferenceRow label={t('debugMode')}>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            role="switch"
            aria-checked={debugMode}
            onClick={() => onDebugModeChange(!debugMode)}
            className={[
              'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 transition-colors',
              debugMode
                ? 'border-[var(--accent)] bg-[var(--accent)]'
                : 'border-[var(--line-strong)] bg-[var(--chrome-elevated)]',
            ].join(' ')}
          >
            <span
              className={[
                'inline-block h-4 w-4 rounded-full bg-white transition-transform',
                debugMode ? 'translate-x-5' : 'translate-x-0.5',
              ].join(' ')}
            />
          </button>
          {t('debugModeDesc') ? <span className="text-[12px] text-[var(--text-muted)]">{t('debugModeDesc')}</span> : null}
        </div>
      </PreferenceRow>
    </div>
  )
}
