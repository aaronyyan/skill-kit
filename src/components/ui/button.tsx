// ── 按钮组件（基于 class-variance-authority）──────────────────────

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-[13px] font-medium transition outline-none disabled:pointer-events-none disabled:opacity-60',
  {
    variants: {
      variant: {
        default:
          'border border-[var(--line-soft)] bg-[var(--panel-0)] text-[var(--text-primary)] hover:border-[var(--line-strong)] hover:bg-[var(--panel-1)]',
        ghost:
          'border border-transparent bg-transparent text-[var(--text-secondary)] hover:border-[var(--line-soft)] hover:bg-[var(--chrome-elevated)] hover:text-[var(--text-primary)]',
        destructive:
          'border border-[var(--danger-line)] bg-[var(--danger-soft)] text-[var(--danger-text)] hover:border-[rgba(143,77,77,0.28)] hover:bg-[rgba(143,77,77,0.12)]',
      },
      size: {
        default: 'h-9 px-4',
        icon: 'h-8 w-8 px-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

export { Button, buttonVariants }
