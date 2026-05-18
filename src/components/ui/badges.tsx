import { Boxes } from 'lucide-react'
import type { PlatformKind } from '../../types'
import type { Translate } from '../../constants/i18n'
import type { SyncState } from '../../types'
import { PLATFORM_TABS, CATEGORY_ICONS } from '../../constants/platforms'
import type { PlatformTab } from '../../constants/platforms'

export function PlatformGlyph({ tab }: { tab: PlatformTab }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-[6px] border border-[var(--line-soft)] bg-[var(--panel-0)]">
      {tab.iconType === 'emoji' ? (
        <span className="text-[15px] leading-none">{tab.icon}</span>
      ) : (
        <img src={tab.icon} alt={tab.iconAlt} className="h-4.5 w-4.5 object-cover" />
      )}
    </span>
  )
}

export function PlatformMiniBadge({ platform }: { platform: PlatformKind }) {
  const tab = PLATFORM_TABS.find((item) => item.key === platform) ?? PLATFORM_TABS[0]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px]"
      style={{ borderColor: tab.accent, backgroundColor: tab.softAccent, color: tab.accent }}
    >
      {tab.iconType === 'emoji' ? (
        <span className="text-[12px] leading-none">{tab.icon}</span>
      ) : (
        <img src={tab.icon} alt={tab.iconAlt} className="h-3.5 w-3.5 rounded-full object-cover" />
      )}
      {tab.label}
    </span>
  )
}

export function CategoryIcon({ categoryKey }: { categoryKey: string }) {
  const Icon = CATEGORY_ICONS[categoryKey] ?? Boxes
  return <Icon className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
}

export function SyncBadge({
  state,
  t,
}: {
  state: SyncState
  t: Translate
}) {
  const label =
    state === 'synced'
      ? t('synced')
      : state === 'conflict'
        ? t('conflict')
        : state === 'ready'
          ? t('ready')
          : ''
  const styles =
    state === 'synced'
      ? 'border-[var(--success-line)] bg-[var(--success-soft)] text-[var(--success-text)]'
      : state === 'conflict'
        ? 'border-[var(--danger-line)] bg-[var(--danger-soft)] text-[var(--danger-text)]'
        : state === 'ready'
          ? 'border-[var(--warn-line)] bg-[var(--warn-soft)] text-[var(--warn-text)]'
          : 'border-[var(--line-soft)] bg-[var(--chrome-elevated)] text-[var(--text-muted)]'

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[12px] font-medium ${styles}`}>{label}</span>
}
