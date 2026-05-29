// ── GitHub 安装对话框 ─────────────────────────────────────────────
// 从 GitHub 安装 skill 的完整流程：输入 URL → 克隆 → 选择 → 安装 → 完成

import { LoaderCircle, PackagePlus } from 'lucide-react'
import type { GitHubSkillPreview, InstallFromGitHubResult } from '../types'
import type { Translate } from '../constants/i18n'
import { AppDialog } from './ui'
import { DialogActions, SecondaryButton } from './ui/buttons'
import { PlatformMiniBadge } from './ui/badges'

type InstallPhase = 'input' | 'cloning' | 'selecting' | 'installing-multi' | 'done' | 'error'

type InstallDialogProps = {
  open: boolean
  onClose: () => void
  installPhase: InstallPhase
  githubUrl: string
  onGithubUrlChange: (url: string) => void
  onInstall: () => void
  installError: string | null
  duplicateWarning: string | null
  installResult: InstallFromGitHubResult | null
  multiInstallResults: InstallFromGitHubResult[]
  githubSkillPreviews: GitHubSkillPreview[]
  selectedSkillIndices: Set<number>
  onToggleSkillIndex: (index: number) => void
  onToggleSelectAll: () => void
  onConfirmMultiInstall: () => void
  t: Translate
}

export function InstallDialog({
  open,
  onClose,
  installPhase,
  githubUrl,
  onGithubUrlChange,
  onInstall,
  installError,
  duplicateWarning,
  installResult,
  multiInstallResults,
  githubSkillPreviews,
  selectedSkillIndices,
  onToggleSkillIndex,
  onToggleSelectAll,
  onConfirmMultiInstall,
  t,
}: InstallDialogProps) {
  if (!open) return null

  return (
    <AppDialog
      open
      onOpenChange={(o) => { if (!o) onClose() }}
      title={t('installFromGithubTitle')}
      icon={<PackagePlus className="h-5 w-5" />}
    >
      {installPhase === 'cloning' ? (
        <div className="flex flex-col items-center gap-4 py-8">
          <LoaderCircle className="h-10 w-10 animate-spin text-[var(--accent)]" />
          <div className="space-y-1 text-center">
            <div className="text-[14px] font-medium text-[var(--text-primary)]">{t('cloningRepo')}</div>
            <div className="text-[12px] text-[var(--text-muted)]">{githubUrl}</div>
          </div>
        </div>
      ) : installPhase === 'installing-multi' ? (
        <div className="flex flex-col items-center gap-4 py-8">
          <LoaderCircle className="h-10 w-10 animate-spin text-[var(--accent)]" />
          <div className="space-y-1 text-center">
            <div className="text-[14px] font-medium text-[var(--text-primary)]">
              {t('installingMultiple').replace('{count}', String(selectedSkillIndices.size))}
            </div>
            <div className="text-[12px] text-[var(--text-muted)]">{githubUrl}</div>
          </div>
        </div>
      ) : installPhase === 'selecting' ? (
        <div className="space-y-3">
          <div className="text-[13px] text-[var(--text-secondary)]">
            {t('selectSkills')}
            <span className="ml-2 text-[12px] text-[var(--text-muted)]">
              ({t('skillCount').replace('{count}', String(githubSkillPreviews.length))})
            </span>
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-[8px] border border-[var(--line-soft)] bg-[var(--panel-0)] px-3 py-2 transition hover:bg-[var(--panel-1)]">
            <input
              type="checkbox"
              checked={selectedSkillIndices.size === githubSkillPreviews.length && githubSkillPreviews.length > 0}
              onChange={onToggleSelectAll}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            <span className="text-[13px] font-medium text-[var(--text-primary)]">{t('selectAll')}</span>
          </label>
          <div className="max-h-[300px] space-y-1 overflow-y-auto">
            {githubSkillPreviews.map((preview, i) => (
              <label
                key={preview.subpath}
                className="flex cursor-pointer items-start gap-2.5 rounded-[8px] border border-[var(--line-soft)] bg-[var(--panel-0)] px-3 py-2.5 transition hover:bg-[var(--panel-1)]"
              >
                <input
                  type="checkbox"
                  checked={selectedSkillIndices.has(i)}
                  onChange={() => onToggleSkillIndex(i)}
                  className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-[var(--text-primary)]">{preview.name}</div>
                  <div className="text-[12px] text-[var(--text-muted)] truncate">{preview.description || t('noDescription')}</div>
                  <div className="text-[11px] text-[var(--text-muted)] opacity-60">{preview.subpath}</div>
                </div>
              </label>
            ))}
          </div>
          <DialogActions>
            <SecondaryButton label={t('cancel')} onClick={onClose} />
            <button
              type="button"
              onClick={onConfirmMultiInstall}
              disabled={selectedSkillIndices.size === 0}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-[10px] border border-[var(--accent)] bg-[var(--accent)] px-4 text-[13px] font-medium text-white transition hover:opacity-90 active:scale-95 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('install')} ({selectedSkillIndices.size})
            </button>
          </DialogActions>
        </div>
      ) : installPhase === 'input' || installPhase === 'error' ? (
        <div className="space-y-3">
          <input
            type="text"
            value={githubUrl}
            onChange={(e) => onGithubUrlChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onInstall() }}
            placeholder="https://github.com/owner/repo"
            autoFocus
            className="w-full rounded-[10px] border border-[var(--line-soft)] bg-[var(--panel-0)] px-3.5 py-2.5 text-[14px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
          />
          {duplicateWarning ? (
            <div className="rounded-[8px] border border-[var(--warn-line)] bg-[var(--warn-soft)] px-3 py-2 text-[13px] text-[var(--warn-text)]">
              {t('duplicateSkillDesc').replace('{name}', duplicateWarning)}
            </div>
          ) : null}
          {installError ? (
            <div className="whitespace-pre-wrap rounded-[8px] border border-[var(--danger-line)] bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[var(--danger-text)]">
              {installError}
            </div>
          ) : null}
          <DialogActions>
            <SecondaryButton label={t('cancel')} onClick={onClose} />
            <button
              type="button"
              onClick={onInstall}
              disabled={!githubUrl.trim()}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-[10px] border border-[var(--accent)] bg-[var(--accent)] px-4 text-[13px] font-medium text-white transition hover:opacity-90 active:scale-95 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('install')}
            </button>
          </DialogActions>
        </div>
      ) : installPhase === 'done' && (installResult || multiInstallResults.length > 0) ? (
        <div className="space-y-3">
          <div className="rounded-[8px] border border-[var(--success-line)] bg-[var(--success-soft)] px-3 py-2 text-[13px] text-[var(--success-text)]">
            {t('installSuccess')}
          </div>
          {installResult ? (
            <div className="space-y-2">
              <div className="text-[14px] text-[var(--text-primary)]">{installResult.skill.name}</div>
              <div className="text-[13px] text-[var(--text-secondary)]">
                {installResult.skill.description || t('noDescription')}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {installResult.installedPlatforms.map((p) => (
                  <PlatformMiniBadge key={p} platform={p} />
                ))}
              </div>
            </div>
          ) : null}
          {multiInstallResults.length > 0 ? (
            <div className="max-h-[300px] space-y-2 overflow-y-auto">
              {multiInstallResults.map((r) => (
                <div key={r.skill.name} className="rounded-[8px] border border-[var(--line-soft)] bg-[var(--panel-0)] px-3 py-2">
                  <div className="text-[13px] font-medium text-[var(--text-primary)]">{r.skill.name}</div>
                  <div className="text-[12px] text-[var(--text-secondary)]">{r.skill.description || t('noDescription')}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {r.installedPlatforms.map((p) => (
                      <PlatformMiniBadge key={p} platform={p} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <DialogActions>
            <SecondaryButton label={t('done')} onClick={onClose} />
          </DialogActions>
        </div>
      ) : null}
    </AppDialog>
  )
}
