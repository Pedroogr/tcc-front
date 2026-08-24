import { cn } from '@/lib/utils'

export type StatusKind = 'live' | 'scheduled' | 'approved' | 'finished' | 'blocked'

type StatusProps = {
  kind: StatusKind
  className?: string
}

const config: Record<StatusKind, { label: string; classes: string }> = {
  live: { label: 'AO VIVO', classes: 'bg-live text-primary-foreground' },
  scheduled: {
    label: 'AGENDADO',
    classes: 'border border-[#46381a] bg-[#241c0c] text-scheduled',
  },
  approved: {
    label: 'APROVADO',
    classes: 'border border-brand-line bg-brand-tint text-success',
  },
  finished: {
    label: 'ENCERRADO',
    classes: 'border border-input bg-muted text-muted-foreground',
  },
  blocked: {
    label: 'BLOQUEADO',
    classes: 'border border-[#5c2621] bg-[#2a1210] text-[#f0776c]',
  },
}

export function Status({ kind, className }: StatusProps) {
  const { label, classes } = config[kind]

  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-[6px] px-2.5',
        'text-[11px] font-semibold tracking-[0.06em]',
        classes,
        className,
      )}
    >
      {kind === 'live' && (
        <span className="size-1.5 rounded-full bg-current motion-safe:animate-pulse" />
      )}
      {label}
    </span>
  )
}
