// ── Skill 列表行 ─────────────────────────────────────────────────
// 主界面左侧 skill 列表中的单行，展示名称、描述、同步状态和操作按钮

import { motion } from 'framer-motion'
import { ExternalLink, LoaderCircle, RefreshCw, Trash2 } from 'lucide-react'
import type { PlatformSkillItem } from '../types'
import type { Translate } from '../constants/i18n'
import type { PlatformTab } from '../constants/platforms'
import { TAG_COLOR_MAP } from '../constants/platforms'
import { inferCategoryKey } from '../lib/skills'
import { SyncBadge } from './ui/badges'

function CategoryDot({ categoryKey }: { categoryKey: string }) {
  const colors = TAG_COLOR_MAP[categoryKey]
  const bg = colors ? colors.text : '#6b7280'
  return (
    <span
      className="block h-[8px] w-[8px] shrink-0 rounded-full"
      style={{ backgroundColor: bg }}
      title={categoryKey}
    />
  )
}

export function SkillRow({
  skill,
  tab,
  selected,
  highlighted,
  workingAction,
  onSelect,
  onSync,
  onOpenGithub,
  onDelete,
  t,
}: {
  skill: PlatformSkillItem
  tab: PlatformTab
  selected: boolean
  highlighted?: boolean
  workingAction: string | null
  onSelect: () => void
  onSync: () => void
  onOpenGithub: () => void
  onDelete: () => void
  t: Translate
}) {
  const bestSyncState =
    skill.platform === 'claude'
      ? 'synced'
      : (skill.syncTargets ?? []).find((item) => item.target === skill.platform || item.state !== 'unavailable')?.state ?? null
  return (
    <motion.div
      className={[
        'group mb-1.5 grid grid-cols-[minmax(0,1fr)_104px_108px] items-center gap-4 rounded-[10px] border px-3 py-3 transition',
        highlighted
          ? 'border-[var(--accent)] bg-[rgba(94,106,210,0.1)]'
          : selected
            ? 'border-[var(--glass-brand-tint)] bg-[var(--panel-0)]'
            : 'border-transparent bg-transparent hover:border-[var(--line-soft)] hover:bg-[var(--panel-0)]',
      ].join(' ')}
      data-skill-id={skill.id}
      initial={false}
      whileHover={{ x: 1 }}
      transition={{ duration: 0.14, ease: 'easeOut' }}
      style={highlighted ? { boxShadow: `inset 2px 0 0 #22c55e` } : selected ? { boxShadow: `inset 2px 0 0 ${tab.accent}` } : undefined}
    >
      <button type="button" onClick={onSelect} className="min-w-0 text-left">
        <div className="flex min-w-0 items-center gap-2">
          <CategoryDot categoryKey={inferCategoryKey(skill)} />
          <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-[var(--text-primary)]">{skill.name}</span>
        </div>
        <div className="mt-1 truncate text-[14px] text-[var(--text-secondary)]">{skill.description || t('noDescription')}</div>
      </button>

      <div>{bestSyncState ? <SyncBadge state={bestSyncState} t={t} /> : null}</div>

      <div className="flex items-center justify-end gap-1 opacity-100 transition duration-150">
        <button
          type="button"
          onClick={onSync}
          aria-label={t('syncTitle')}
          className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-transparent bg-transparent text-[var(--text-secondary)] transition hover:border-[var(--line-soft)] hover:bg-[var(--chrome-elevated)] hover:text-[var(--text-primary)]"
          title={t('syncTitle')}
        >
          {workingAction?.startsWith(`sync-${skill.id}`) ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={onOpenGithub}
          disabled={!skill.githubUrl}
          aria-label={skill.githubUrl ? t('openGithub') : t('noGithub')}
          className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-transparent bg-transparent text-[var(--text-secondary)] transition hover:border-[var(--line-soft)] hover:bg-[var(--chrome-elevated)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-45"
          title={skill.githubUrl ? t('openGithub') : t('noGithub')}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={t('confirmDelete')}
          title={t('confirmDelete')}
          className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-transparent bg-transparent text-[var(--danger-text)] transition hover:border-[var(--danger-line)] hover:bg-[var(--danger-soft)]"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  )
}
