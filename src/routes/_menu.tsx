import { createFileRoute, Link, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_menu')({
  component: MenuLayout,
})

const tabCls = 'rounded-md px-3.5 py-2 text-ink-2 hover:text-ink'

function MenuLayout() {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[22px] font-semibold tracking-wide">Aim Trainer</h1>
        <nav className="flex gap-1 rounded-[10px] bg-surface p-1">
          {[
            { to: '/', label: 'Pure Aim' },
            { to: '/recoil', label: 'Recoil Control' },
            { to: '/goals', label: 'Goals' },
            { to: '/history', label: 'History' },
            { to: '/hearing', label: 'Hearing' },
            { to: '/settings', label: 'Settings' },
          ].map((t) => (
            <Link key={t.to} to={t.to} className={tabCls} activeOptions={{ exact: true }}
              activeProps={{ className: 'bg-surface-2 !text-ink' }}>
              {t.label}
            </Link>
          ))}
        </nav>
      </header>
      <Outlet />
    </div>
  )
}
