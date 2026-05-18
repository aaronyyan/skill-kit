import * as React from 'react'
import { cn } from '../../lib/utils'

function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'flex h-9 w-full rounded-[8px] border border-[var(--line-soft)] bg-[var(--chrome-elevated)] px-3 text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
