// ── 左侧边栏 ─────────────────────────────────────────────────────
// 平台 Tab 列表 + 分类列表 + 底部操作按钮

import { PackagePlus, PanelLeft, Settings2, Terminal } from 'lucide-react'
import type { PlatformKind } from '../types'
import type { Translate } from '../constants/i18n'
import { PLATFORM_TABS } from '../constants/platforms'
import { PlatformGlyph, CategoryIcon } from './ui/badges'

type CategoryItem = {
  key: string
  label: string
  count: number
}

type SidebarProps = {
  collapsed: boolean
  onToggleCollapse: () => void
  activePlatform: PlatformKind
  onPlatformChange: (platform: PlatformKind) => void
  effectiveCategory: string
  onCategoryChange: (category: string) => void
  categoryItems: CategoryItem[]
  counts: Record<PlatformKind, number>
  updatedPlatforms: Set<PlatformKind>
  onClearUpdated: (platform: PlatformKind) => void
  debugMode: boolean
  debugLogsOpen: boolean
  onToggleDebugLogs: () => void
  onOpenInstall: () => void
  onOpenSettings: () => void
  t: Translate
}

export function Sidebar({
  collapsed,
  onToggleCollapse,
  activePlatform,
  onPlatformChange,
  effectiveCategory,
  onCategoryChange,
  categoryItems,
  counts,
  updatedPlatforms,
  onClearUpdated,
  debugMode,
  debugLogsOpen,
  onToggleDebugLogs,
  onOpenInstall,
  onOpenSettings,
  t,
}: SidebarProps) {
  return (
    <aside
      className={[
        'flex min-h-0 shrink-0 flex-col border-r border-[var(--line-soft)] bg-[var(--chrome)] transition-[width] duration-300 ease-out',
        collapsed ? 'w-[72px]' : 'w-[252px]',
      ].join(' ')}
    >
      <div className="border-b border-[var(--line-soft)] px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          {!collapsed ? (
            <div className="flex min-w-0 items-center gap-2 text-[13px] font-medium tracking-[-0.01em] text-[var(--text-primary)]">
              SkillKit
            </div>
          ) : null}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-[var(--line-soft)] bg-[var(--chrome-elevated)] text-[var(--text-secondary)] transition hover:border-[var(--line-strong)] hover:text-[var(--text-primary)]"
          >
            <PanelLeft className={`h-4 w-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      <div className="px-2 py-2">
        {!collapsed ? <div className="px-2 pb-2 text-[13px] font-medium text-[var(--text-secondary)]">{t('platform')}</div> : null}
        <div className="space-y-1">
          {PLATFORM_TABS.map((tab) => {
            const active = tab.key === activePlatform
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  onPlatformChange(tab.key)
                  onClearUpdated(tab.key)
                }}
                className={[
                  'flex w-full items-center rounded-[8px] px-2.5 py-2.5 text-left transition',
                  active ? 'bg-[var(--panel-1)]' : 'hover:bg-[var(--chrome-elevated)]',
                ].join(' ')}
                style={active ? { boxShadow: `inset 2px 0 0 ${tab.accent}` } : undefined}
              >
                <PlatformGlyph tab={tab} />
                {!collapsed ? (
                  <div className="ml-3 min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-[var(--text-primary)]">{tab.label}</div>
                    <div className="mt-0.5 truncate text-[13px] text-[var(--text-secondary)]">{counts[tab.key] ?? 0}</div>
                  </div>
                ) : null}
                {updatedPlatforms.has(tab.key) ? (
                  <span className="ml-auto h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: '#22c55e', animation: 'pulse-dot 2s ease-in-out infinite' }} />
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 border-t border-[var(--line-soft)] px-2 py-3">
        {!collapsed ? <div className="px-2 pb-2 text-[13px] font-medium text-[var(--text-secondary)]">{t('category')}</div> : null}
        <div className="skillhub-scroll space-y-1 overflow-y-auto pr-1" style={{ maxHeight: 'calc(100% - 28px)' }}>
          {categoryItems.map((category) => {
            const active = effectiveCategory === category.key
            return (
              <button
                key={category.key}
                type="button"
                onClick={() => onCategoryChange(category.key)}
                className={[
                  'flex w-full items-center rounded-[8px] px-2.5 py-2 text-left transition',
                  active
                    ? 'bg-[var(--panel-1)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--chrome-elevated)] hover:text-[var(--text-primary)]',
                ].join(' ')}
              >
                <CategoryIcon categoryKey={category.key} />
                {!collapsed ? (
                  <>
                    <span className="ml-3 min-w-0 flex-1 truncate text-[13px]">{category.label}</span>
                    <span className="rounded-full bg-[var(--chrome-elevated)] px-1.5 py-0.5 text-[12px] text-[var(--text-secondary)]">
                      {category.count}
                    </span>
                  </>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-auto border-t border-[var(--line-soft)] px-3 py-3 space-y-2">
        <button
          type="button"
          onClick={onOpenInstall}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-[8px] border border-[var(--accent)] bg-[var(--accent-soft)] px-3 text-[13px] font-medium text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-white"
        >
          <PackagePlus className="h-4 w-4" />
          {!collapsed ? t('installFromGithub') : null}
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-[8px] border border-[var(--line-soft)] bg-[var(--chrome-elevated)] px-3 text-[13px] font-medium text-[var(--text-secondary)] transition hover:border-[var(--line-strong)] hover:text-[var(--text-primary)]"
        >
          <Settings2 className="h-4 w-4" />
          {!collapsed ? t('settings') : null}
        </button>
        {debugMode ? (
          <button
            type="button"
            onClick={onToggleDebugLogs}
            className="flex h-9 w-full shrink-0 items-center justify-center gap-2 overflow-hidden rounded-[8px] border border-[var(--line-soft)] bg-[var(--chrome-elevated)] px-3 text-[13px] font-medium transition hover:border-[var(--line-strong)] hover:text-[var(--text-primary)]"
            style={{ color: debugLogsOpen ? 'var(--accent)' : 'var(--text-secondary)' }}
          >
            <Terminal className="h-4 w-4" />
            {!collapsed ? t('debugLogs') : null}
          </button>
        ) : null}
      </div>
    </aside>
  )
}
