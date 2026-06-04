// ── 自动更新对话框 ─────────────────────────────────────────────
// 检测到新版本时弹出，支持下载进度展示、安装后自动重启

import { useState, useCallback } from 'react'
import { Download, LoaderCircle, CheckCircle } from 'lucide-react'
import type { Update } from '@tauri-apps/plugin-updater'
import type { Translate } from '../constants/i18n'
import { AppDialog } from './ui'
import { DialogActions, SecondaryButton } from './ui/buttons'

type UpdatePhase = 'available' | 'downloading' | 'installing' | 'done' | 'error'

type UpdateDialogProps = {
  open: boolean
  onClose: () => void
  update: Update
  currentVersion: string
  t: Translate
}

/** 将字节数格式化为人类可读的大小 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function UpdateDialog({ open, onClose, update, currentVersion, t }: UpdateDialogProps) {
  const [phase, setPhase] = useState<UpdatePhase>('available')
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState({ downloaded: 0, total: 0 })

  const percent = progress.total > 0 ? Math.round((progress.downloaded / progress.total) * 100) : 0

  const handleUpdate = useCallback(async () => {
    setPhase('downloading')
    setError(null)
    try {
      let downloaded = 0
      let contentLength = 0

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength
            setProgress({ downloaded: 0, total: contentLength })
            break
          case 'Progress':
            downloaded += event.data.chunkLength
            setProgress({ downloaded, total: contentLength })
            break
          case 'Finished':
            break
        }
      })

      setPhase('installing')
      // 短暂延迟让用户看到"安装中"状态
      await new Promise((r) => setTimeout(r, 500))
      setPhase('done')

      // 重启应用
      const { relaunch } = await import('@tauri-apps/plugin-process')
      await relaunch()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setPhase('error')
    }
  }, [update])

  return (
    <AppDialog
      open={open}
      onOpenChange={(o) => { if (!o && phase === 'available') onClose() }}
      title={t('updateAvailable')}
      icon={<Download className="h-5 w-5" />}
      showCloseButton={phase === 'available' || phase === 'error'}
    >
      {phase === 'available' ? (
        <div className="space-y-3">
          <div className="text-[13px] leading-5 text-[var(--text-secondary)]">
            {t('updateDescription')
              .replace('{newVersion}', update.version)
              .replace('{currentVersion}', currentVersion)}
          </div>

          {update.body ? (
            <div className="space-y-1.5">
              <div className="text-[12px] font-medium text-[var(--text-muted)]">{t('updateReleaseNotes')}</div>
              <div className="max-h-[200px] overflow-y-auto rounded-[8px] border border-[var(--line-soft)] bg-[var(--panel-0)] px-3 py-2.5">
                <div className="whitespace-pre-wrap text-[13px] leading-5 text-[var(--text-secondary)]">
                  {update.body}
                </div>
              </div>
            </div>
          ) : null}

          <DialogActions>
            <SecondaryButton label={t('updateSkip')} onClick={onClose} />
            <button
              type="button"
              onClick={() => void handleUpdate()}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-[10px] border border-[var(--accent)] bg-[var(--accent)] px-4 text-[13px] font-medium text-white transition hover:opacity-90 active:scale-95 active:opacity-80"
            >
              {t('updateNow')}
            </button>
          </DialogActions>
        </div>
      ) : phase === 'downloading' ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <LoaderCircle className="h-10 w-10 animate-spin text-[var(--accent)]" />
          <div className="w-full space-y-2">
            <div className="text-center text-[14px] font-medium text-[var(--text-primary)]">{t('updateDownloading')}</div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--panel-1)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent)]/60 transition-all duration-300 ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="text-center text-[12px] text-[var(--text-muted)]">
              {progress.total > 0
                ? `${percent}% — ${t('updateProgress')
                    .replace('{downloaded}', formatBytes(progress.downloaded))
                    .replace('{total}', formatBytes(progress.total))}`
                : t('updateDownloading')}
            </div>
          </div>
        </div>
      ) : phase === 'installing' ? (
        <div className="flex flex-col items-center gap-4 py-8">
          <LoaderCircle className="h-10 w-10 animate-spin text-[var(--accent)]" />
          <div className="text-[14px] font-medium text-[var(--text-primary)]">{t('updateInstalling')}</div>
        </div>
      ) : phase === 'done' ? (
        <div className="flex flex-col items-center gap-4 py-8">
          <CheckCircle className="h-10 w-10 text-[var(--success-text)]" />
          <div className="text-[14px] font-medium text-[var(--text-primary)]">{t('updateInstalling')}</div>
        </div>
      ) : phase === 'error' ? (
        <div className="space-y-3">
          <div className="whitespace-pre-wrap rounded-[8px] border border-[var(--danger-line)] bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[var(--danger-text)]">
            {error ?? t('updateError')}
          </div>
          <DialogActions>
            <SecondaryButton label={t('updateSkip')} onClick={onClose} />
            <button
              type="button"
              onClick={() => void handleUpdate()}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-[10px] border border-[var(--accent)] bg-[var(--accent)] px-4 text-[13px] font-medium text-white transition hover:opacity-90 active:scale-95 active:opacity-80"
            >
              {t('updateNow')}
            </button>
          </DialogActions>
        </div>
      ) : null}
    </AppDialog>
  )
}
