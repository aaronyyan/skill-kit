import { PackageOpen } from 'lucide-react'
import type { PlatformSkillItem, SyncState } from '../types'
import type { LanguagePreference, Translate } from '../constants/i18n'
import { inferCategoryKey, categoryLabel, platformLabel } from '../lib/skills'
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

function InspectorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[var(--line-soft)] px-5 py-4 last:border-b-0">
      <div className="mb-3 text-[13px] font-medium text-[var(--text-secondary)]">{title}</div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function DetailRow({ label, value, link }: { label: string; value: React.ReactNode; link?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="shrink-0 text-[13px] text-[var(--text-secondary)]">{label}</span>
      {link ? (
        <button
          type="button"
          onClick={() => openExternalUrl(link)}
          className="min-w-0 truncate text-left text-[13px] text-[var(--text-primary)] underline decoration-[var(--line-strong)] underline-offset-4 transition hover:text-[var(--accent)]"
        >
          {value}
        </button>
      ) : (
        <span className="min-w-0 truncate text-right text-[13px] text-[var(--text-primary)]">
          {typeof value === 'string' ? value : value}
        </span>
      )}
    </div>
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
        <div className="flex flex-col items-center gap-3 text-[var(--text-tertiary)]">
          <PackageOpen className="h-10 w-10" />
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
      <div className="border-b border-[var(--line-soft)] px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mt-1 truncate text-[18px] font-medium tracking-[-0.02em] text-[var(--text-primary)]">{skill.name}</div>
          </div>
          <PlatformMiniBadge platform={skill.platform} />
        </div>
        <div
          className="mt-3 text-[14px] leading-7 text-[var(--text-secondary)]"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 8,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {skill.description || t('noDescription')}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <TagPill label={categoryLabel(inferCategoryKey(skill), language)} colorKey={inferCategoryKey(skill)} />
          {(skill.tags ?? []).slice(0, 5).map((tag) => (
            <TagPill key={tag} label={tag} />
          ))}
        </div>
      </div>

      <InspectorSection title={t('details')}>
        <div className="divide-y divide-[var(--line-soft)]">
          <DetailRow label={t('sourcePlatform')} value={platformLabel(skill.platform)} />
          <DetailRow label={t('statusHeader')} value={<SyncBadge state={currentStatus} t={t} />} />
          <DetailRow
            label={t('source')}
            value={showGithub ? skill.githubUrl!.replace(/^https?:\/\/github\.com\//, '') : t('localSource')}
            link={showGithub ? skill.githubUrl! : undefined}
          />
        </div>
      </InspectorSection>
    </div>
  )
}
