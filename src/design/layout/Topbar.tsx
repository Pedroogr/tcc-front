import type { ReactNode } from 'react'

type TopbarProps = {
  brand: ReactNode
  nav?: ReactNode
  account?: ReactNode
}

export function Topbar({ brand, nav, account }: TopbarProps) {
  return (
    <header className="flex min-h-15 items-center justify-between gap-4 border-b border-border bg-card px-4 py-2 sm:px-6 lg:gap-8 lg:px-8">
      <div className="flex min-w-0 items-center gap-4 lg:gap-8">
        {brand}
        {nav && <nav className="flex min-w-0 items-center gap-1">{nav}</nav>}
      </div>
      {account}
    </header>
  )
}
