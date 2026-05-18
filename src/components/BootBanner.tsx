import type { Translate } from '../constants/i18n'

export type BootPhase =
  | 'idle'
  | 'starting'
  | 'scanning_platforms'
  | 'loading_activity'
  | 'ready'
  | 'failed'

export function BootBanner({ phase, t }: { phase: BootPhase; t: Translate }) {
  const copy =
    phase === 'starting'
      ? t('loadingStart')
      : phase === 'scanning_platforms'
        ? t('loadingScan')
        : phase === 'loading_activity'
          ? t('loadingLog')
          : t('loadingDefault')

  const progress =
    phase === 'starting'
      ? 15
      : phase === 'scanning_platforms'
        ? 45
        : phase === 'loading_activity'
          ? 85
          : 10

  return (
    <div className="mt-3 overflow-hidden rounded-[10px] border border-[var(--accent)]/20 bg-gradient-to-r from-[var(--accent-soft)] to-transparent">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-[var(--accent)]/20" />
          <div className="relative h-3 w-3 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-[var(--text-primary)]">{copy}</div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--panel-1)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent)]/60 transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
