import * as Dialog from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

export function AppDialog({
  open,
  onOpenChange,
  title,
  hint,
  icon,
  variant = 'default',
  size = 'default',
  showCloseButton = true,
  minimal = false,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  hint?: string
  icon?: ReactNode
  variant?: 'default' | 'danger' | 'selection'
  size?: 'default' | 'compact'
  showCloseButton?: boolean
  minimal?: boolean
  children: ReactNode
}) {
  const surfaceClass =
    minimal
      ? ''
      : variant === 'danger'
      ? 'glass-danger-surface'
      : variant === 'selection'
        ? 'glass-elevated'
        : 'glass-surface'
  const widthClass = size === 'compact' ? 'max-w-[360px]' : 'max-w-[560px]'
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className={minimal ? 'fixed inset-0 z-40 bg-[rgba(12,18,28,0.08)]' : 'fixed inset-0 z-40 bg-[rgba(12,18,28,0.28)] backdrop-blur-[12px]'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 flex items-center justify-center px-6"
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.985 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className={`relative w-full ${widthClass} overflow-hidden rounded-[14px] border border-[var(--line-soft)] bg-[var(--chrome)] ${surfaceClass}`}>
                  <div className={`flex items-start justify-between gap-4 px-5 ${minimal ? 'pt-5' : 'pt-5'}`}>
                    <div className="flex min-w-0 items-start gap-3">
                      {icon ? (
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--panel-1)] text-[var(--accent)]">
                          {icon}
                        </div>
                      ) : null}
                      <div className="min-w-0">
                        <Dialog.Title className="text-[16px] font-medium tracking-[-0.01em] text-[var(--text-primary)]">
                          {title}
                        </Dialog.Title>
                        {hint ? <Dialog.Description className="mt-1 text-[13px] leading-5 text-[var(--text-secondary)]">{hint}</Dialog.Description> : null}
                      </div>
                    </div>
                    {showCloseButton ? (
                      <Dialog.Close asChild>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-[var(--line-soft)] bg-[var(--chrome-elevated)] text-[var(--text-muted)] transition hover:border-[var(--line-strong)] hover:text-[var(--text-primary)]"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </Dialog.Close>
                    ) : null}
                  </div>
                  <div className={`px-5 pb-5 ${minimal ? 'pt-3' : 'pt-3'}`}>{children}</div>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  )
}

export function MenuRoot({
  trigger,
  children,
}: {
  trigger: ReactNode
  children: ReactNode
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={8}
          align="end"
          className="z-50 min-w-[220px] overflow-hidden rounded-[16px] border border-[var(--line-soft)] bg-[var(--chrome)] p-1.5 shadow-[0_20px_48px_rgba(15,23,42,0.18)]"
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

export function MenuItem({
  children,
  onSelect,
  disabled,
}: {
  children: ReactNode
  onSelect?: () => void
  disabled?: boolean
}) {
  return (
    <DropdownMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className="flex cursor-default select-none items-center justify-between rounded-[12px] px-3 py-2.5 text-[13px] text-[var(--text-primary)] outline-none transition data-[highlighted]:bg-[var(--panel-1)] data-[disabled]:opacity-45"
    >
      {children}
    </DropdownMenu.Item>
  )
}

export function PanelCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`relative overflow-hidden rounded-[14px] border border-[var(--line-soft)] bg-[var(--glass-surface)] ${className}`}>{children}</div>
}
