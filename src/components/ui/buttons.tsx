import { LoaderCircle } from 'lucide-react'

export function DialogActions({ children }: { children: React.ReactNode }) {
  return <div className="mt-1 flex justify-end gap-2">{children}</div>
}

export function SecondaryButton({
  label,
  onClick,
  disabled,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 items-center justify-center rounded-[10px] border border-[var(--line-soft)] bg-[var(--panel-0)] px-4 text-[13px] font-medium text-[var(--text-primary)] transition hover:bg-[var(--panel-1)] hover:border-[var(--line-strong)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {label}
    </button>
  )
}

export function DangerActionButton({
  label,
  loading,
  onClick,
}: {
  label: string
  loading?: boolean
  onClick: () => void
}) {
  if (loading) {
    return (
      <div className="inline-flex h-9 min-w-[80px] items-center justify-center rounded-[10px] bg-[var(--chrome-elevated)]">
        <LoaderCircle className="h-4 w-4 animate-spin text-[var(--text-secondary)]" />
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 min-w-[80px] items-center justify-center gap-2 rounded-[10px] border border-[var(--danger-line)] bg-[var(--danger-soft)] px-4 text-[13px] font-medium text-[var(--danger-text)] transition hover:border-[rgba(143,77,77,0.28)] hover:bg-[rgba(143,77,77,0.12)]"
    >
      {label}
    </button>
  )
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex h-full items-center justify-center px-4 py-16">
      <div className="text-center">
        <div className="text-[19px] font-medium tracking-[-0.02em] text-[var(--text-primary)]">{title}</div>
        <div className="mt-2 text-[14px] text-[var(--text-secondary)]">{description}</div>
      </div>
    </div>
  )
}
