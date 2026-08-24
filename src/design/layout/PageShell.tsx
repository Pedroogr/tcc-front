import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type PageShellProps = {
  topbar?: ReactNode
  children: ReactNode
  className?: string
}

export function PageShell({ topbar, children, className }: PageShellProps) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      {topbar}
      <main
        className={cn(
          'mx-auto w-full max-w-[1360px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9',
          className,
        )}
      >
        {children}
      </main>
    </div>
  )
}
