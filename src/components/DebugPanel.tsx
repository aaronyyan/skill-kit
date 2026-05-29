// ── 调试日志面板 ──────────────────────────────────────────────────
// 右下角浮动的调试日志窗口，支持复制和清空

import { motion } from 'framer-motion'
import { Copy, Terminal, Trash2, X } from 'lucide-react'
import type { Translate } from '../constants/i18n'
import { clearDebugLogs as clearDebugLogsBackend } from '../lib/tauri'

type DebugPanelProps = {
  entries: string[]
  endRef: React.RefObject<HTMLDivElement | null>
  onClose: () => void
  t: Translate
}

export function DebugPanel({ entries, endRef, onClose, t }: DebugPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.2 }}
      className="fixed bottom-4 right-4 z-40 flex h-[320px] w-[480px] flex-col rounded-[12px] border border-[var(--line-soft)] bg-[var(--chrome)] shadow-2xl"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--line-soft)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-[var(--accent)]" />
          <span className="text-[13px] font-medium text-[var(--text-primary)]">{t('debugLogs')}</span>
          <span className="rounded-full bg-[var(--chrome-elevated)] px-1.5 py-0.5 text-[11px] text-[var(--text-muted)]">
            {entries.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => { navigator.clipboard.writeText(entries.join('\n')) }}
            className="inline-flex h-7 items-center justify-center gap-1 rounded-[6px] px-2 text-[12px] text-[var(--text-muted)] transition hover:bg-[var(--chrome-elevated)] hover:text-[var(--text-primary)]"
          >
            <Copy className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => { clearDebugLogsBackend(); onClose() }}
            className="inline-flex h-7 items-center justify-center gap-1 rounded-[6px] px-2 text-[12px] text-[var(--text-muted)] transition hover:bg-[var(--chrome-elevated)] hover:text-[var(--text-primary)]"
          >
            <Trash2 className="h-3 w-3" />
            {t('clearLogs')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-[var(--text-muted)] transition hover:bg-[var(--chrome-elevated)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[11px] leading-5 text-[var(--text-secondary)]" ref={endRef}>
        {entries.length === 0 ? (
          <div className="text-[var(--text-muted)]">Waiting for debug events...</div>
        ) : (
          entries.map((entry, i) => (
            <div key={i} className="whitespace-pre-wrap break-all">{entry}</div>
          ))
        )}
      </div>
    </motion.div>
  )
}
