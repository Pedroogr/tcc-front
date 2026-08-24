import { cn } from '@/lib/utils'

type MoneySize = 'sm' | 'md' | 'lg'

type MoneyProps = {
  value?: number | string | null
  size?: MoneySize
  muted?: boolean
  className?: string
}

const sizeClasses: Record<MoneySize, string> = {
  sm: 'text-sm font-medium',
  md: 'text-[1.3125rem] font-semibold -tracking-[0.015em]',
  lg: 'text-[2.125rem] font-semibold -tracking-[0.02em] leading-[1.05]',
}

// Intl.NumberFormat e caro para instanciar em cada render.
const formatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function Money({ value, size = 'md', muted = false, className }: MoneyProps) {
  const numeric = typeof value === 'string' ? Number(value) : value

  if (numeric === null || numeric === undefined || Number.isNaN(numeric)) {
    return (
      <span className={cn(sizeClasses[size], 'text-muted-foreground', className)}>
        &mdash;
      </span>
    )
  }

  return (
    <span
      className={cn(
        sizeClasses[size],
        muted ? 'text-muted-foreground' : 'text-price',
        'tabular-nums',
        className,
      )}
    >
      {formatter.format(numeric)}
    </span>
  )
}
