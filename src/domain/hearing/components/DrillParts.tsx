import type { ReactNode } from 'react'

export const btnCls = 'rounded-md border border-line bg-surface-2 px-3.5 py-2 text-sm hover:border-ink-2 disabled:opacity-40'

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

/** Sidebar: level + level-specific rows, then session numbers and the last 20 outcomes. */
export function DrillSidebar({ level, locked, streak, children, session, outcomes }: {
  level: number
  locked: boolean
  streak: number
  children: ReactNode
  session: ReactNode
  outcomes: { ok: boolean; title: string }[]
}) {
  return (
    <aside className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 text-sm">
      <Row label="Level" value={`${level}${locked ? ' (locked)' : ''}`} />
      <Row label="Streak" value={`${streak} / 3 to level up`} />
      {children}
      <hr className="my-1 border-line" />
      <Row label="Trials" value={String(outcomes.length)} />
      {session}
      <div className="mt-1 flex flex-wrap gap-1">
        {outcomes.slice(-20).map((o, i) => (
          <span key={i} title={o.title} className={`size-2.5 rounded-sm ${o.ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
        ))}
      </div>
    </aside>
  )
}
