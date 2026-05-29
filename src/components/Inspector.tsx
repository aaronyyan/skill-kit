// ── Skill 详情面板 ────────────────────────────────────────────────
// 右侧 Inspector：展示选中 skill 的元数据、描述、安装路径、同步状态

import { ExternalLink, FolderOpen, PackageOpen } from 'lucide-react'
import type { PlatformSkillItem, SyncState } from '../types'
import type { LanguagePreference, Translate } from '../constants/i18n'
import { inferCategoryKey, categoryLabel, platformLabel, sourceLabel } from '../lib/skills'
import { PlatformMiniBadge, SyncBadge } from './ui/badges'
import { openExternalUrl } from '../lib/tauri'
import { TAG_COLOR_MAP } from '../constants/platforms'

function TagPill({ label, colorKey }: { label: string; colorKey?: string }) {
  const colors = colorKey ? TAG_COLOR_MAP[colorKey] : undefined
  return (
    <span
      className={[
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[12px] font-medium leading-none',
        colors ? '' : 'border-[var(--line-soft)] bg-[var(--panel-0)] text-[var(--text-secondary)]',
      ].join(' ')}
      style={colors ? { borderColor: colors.border, backgroundColor: colors.bg, color: colors.text } : undefined}
    >
      {label}
    </span>
  )
}

function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line-soft)] bg-[var(--chrome-elevated)] px-2.5 py-1 text-[12px] text-[var(--text-secondary)]">
      {children}
    </span>
  )
}

export function Inspector({
  skill,
  t,
  language,
}: {
  skill: PlatformSkillItem | null
  t: Translate
  language: LanguagePreference
}) {
  if (!skill) {
    return (
      <div className="flex h-full items-center justify-center px-8">
        <div className="flex flex-col items-center gap-3 text-center text-[var(--text-tertiary)]">
          <PackageOpen className="h-10 w-10" />
          <div className="text-[13px]">{t('emptyInspector')}</div>
        </div>
      </div>
    )
  }

  const showGithub = Boolean(skill.githubUrl)
  const currentStatus: SyncState =
    skill.platform === 'claude'
      ? 'synced'
      : (skill.syncTargets ?? []).find((target) => target.target === skill.platform || target.state !== 'unavailable')?.state ?? 'ready'

  return (
    <div className="skillhub-scroll flex h-full min-h-0 flex-col overflow-y-auto">
      {/* Header */}
      <div className="border-b border-[var(--line-soft)] px-5 py-4">
        <div className="flex items-center gap-2">
          <PlatformMiniBadge platform={skill.platform} />
          <div className="min-w-0 flex-1 truncate text-[16px] font-medium tracking-[-0.01em] text-[var(--text-primary)]">{skill.name}</div>
        </div>

        {/* Compact metadata row */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <MetaChip>
            <span className="text-[var(--text-muted)]">{t('sourcePlatform')}</span>
            <span className="font-medium text-[var(--text-primary)]">{platformLabel(skill.platform)}</span>
          </MetaChip>
          <MetaChip>
            <span className="text-[var(--text-muted)]">{t('source')}</span>
            {showGithub ? (
              <button
                type="button"
                onClick={() => openExternalUrl(skill.githubUrl!)}
                className="inline-flex items-center gap-1 font-medium text-[var(--accent)] hover:underline"
              >
                {skill.githubUrl!.replace(/^https?:\/\/github\.com\//, '')}
                <ExternalLink className="h-3 w-3" />
              </button>
            ) : (
              <span className="font-medium text-[var(--text-primary)]">{sourceLabel(skill.source, language)}</span>
            )}
          </MetaChip>
          <MetaChip>
            <SyncBadge state={currentStatus} t={t} />
          </MetaChip>
        </div>

        {/* Tags */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <TagPill label={categoryLabel(inferCategoryKey(skill), language)} colorKey={inferCategoryKey(skill)} />
          {(skill.tags ?? []).slice(0, 5).map((tag) => (
            <TagPill key={tag} label={tag} />
          ))}
        </div>
      </div>

      {/* Description */}
      <div className="border-b border-[var(--line-soft)] px-5 py-4">
        <div className="mb-2 text-[12px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{t('details')}</div>
        <div className="text-[13px] leading-6 text-[var(--text-secondary)]">
          {skill.description || t('noDescription')}
        </div>
      </div>

      {/* Install path */}
      <div className="border-b border-[var(--line-soft)] px-5 py-4">
        <div className="mb-2 text-[12px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{t('sourcePath')}</div>
        <button
          type="button"
          onClick={() => openExternalUrl(`file://${skill.installPath}`)}
          className="group flex items-start gap-2 text-left"
        >
          <FolderOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] group-hover:text-[var(--accent)]" />
          <span className="break-all text-[12px] leading-5 text-[var(--text-secondary)] group-hover:text-[var(--accent)]">
            {skill.installPath}
          </span>
        </button>
      </div>

      {/* Sync targets */}
      {(skill.syncTargets ?? []).length > 0 ? (
        <div className="px-5 py-4">
          <div className="mb-2 text-[12px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{t('syncTitle')}</div>
          <div className="space-y-1.5">
            {skill.syncTargets.map((target) => (
              <div key={target.target} className="flex items-center justify-between rounded-[8px] border border-[var(--line-soft)] bg-[var(--panel-0)] px-3 py-2">
                <div className="flex items-center gap-2">
                  <PlatformMiniBadge platform={target.target} />
                  <span className="text-[13px] text-[var(--text-primary)]">{platformLabel(target.target)}</span>
                </div>
                <SyncBadge state={target.state} t={t} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
