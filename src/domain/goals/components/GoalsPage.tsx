import { useState } from 'react'
import type { SessionRow } from '../../../common/lib/tracking'
import { weekLabel } from '../../../common/lib/week'
import { goalProgress } from '../services/progress'
import type { Goal, GoalVariant } from '../types'

type Props = {
  goals: Goal[]
  sessions: SessionRow[]
  weekStart: string
  variants: GoalVariant[]
  onSave: (scenarioId: string, target: number) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const inputCls = 'rounded-md border border-line bg-surface-2 px-2 py-1.5 text-ink'

/** Targets are stored as 0–1 for tracking; the UI edits them as percentages. */
const toInput = (v: GoalVariant | undefined, target: number) => (v?.clicking ? target : Math.round(target * 1000) / 10)
const fromInput = (v: GoalVariant | undefined, value: number) => (v?.clicking ? value : value / 100)
const fmt = (v: GoalVariant | undefined, x: number | null) =>
  x === null ? '—' : v?.clicking ? `${Math.round(x)} kills` : `${(x * 100).toFixed(1)}%`

export function GoalsPage({ goals, sessions, weekStart, variants, onSave, onDelete }: Props) {
  const byId = new Map(variants.map((v) => [v.id, v]))
  const rows = goals.map((g) => ({ goal: g, variant: byId.get(g.scenarioId), progress: goalProgress(g, sessions) }))
  const achieved = rows.filter((r) => r.progress.achieved).length

  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-ink-2">
          This week · <b className="text-ink">{weekLabel(weekStart)}</b>
        </p>
        <p className="text-sm text-muted">
          {goals.length ? `${achieved} of ${goals.length} achieved · a goal is achieved after 3 runs in a row at or above it` : 'No goals for this week yet.'}
        </p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
        {rows.map(({ goal, variant, progress }) => (
          <GoalCard key={goal.id} goal={goal} variant={variant} progress={progress} onSave={onSave} onDelete={onDelete} />
        ))}
      </div>

      <AddGoal variants={variants} existing={new Set(goals.map((g) => g.scenarioId))} onSave={onSave} />
    </div>
  )
}

function GoalCard({ goal, variant, progress, onSave, onDelete }: {
  goal: Goal
  variant: GoalVariant | undefined
  progress: ReturnType<typeof goalProgress>
  onSave: Props['onSave']
  onDelete: Props['onDelete']
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(toInput(variant, goal.target))
  const ratio = progress.last3Avg === null ? 0 : Math.min(1, progress.last3Avg / goal.target)
  const status = progress.achieved ? 'Achieved' : progress.runs ? 'In progress' : 'Not started'

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <b>{variant?.name ?? goal.scenarioId}</b>
        <span className={`text-xs ${progress.achieved ? 'text-[#3fb67a]' : 'text-muted'}`}>
          {progress.achieved ? '✓ ' : ''}{status}
        </span>
      </div>

      {editing ? (
        <form className="flex items-center gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            await onSave(goal.scenarioId, fromInput(variant, value))
            setEditing(false)
          }}>
          <input type="number" step={variant?.clicking ? 1 : 0.5} min={1} max={variant?.clicking ? 1000 : 100} value={value}
            className={`${inputCls} w-24`} onChange={(e) => Number.isFinite(e.currentTarget.valueAsNumber) && setValue(e.currentTarget.valueAsNumber)} />
          <span className="text-sm text-muted">{variant?.clicking ? 'kills' : '%'}</span>
          <button className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white">Save</button>
          <button type="button" className="text-sm text-muted underline" onClick={() => setEditing(false)}>Cancel</button>
        </form>
      ) : (
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums">{fmt(variant, goal.target)}</span>
          <span className="text-xs text-muted">goal</span>
        </div>
      )}

      <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100}
        aria-label="Last-3 average as a share of the goal">
        <div className={`h-full rounded-full ${progress.achieved ? 'bg-[#3fb67a]' : 'bg-accent'}`} style={{ width: `${ratio * 100}%` }} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs text-muted tabular-nums">
        <div><div className="text-sm text-ink">{progress.runs}</div>runs this week</div>
        <div><div className="text-sm text-ink">{fmt(variant, progress.last3Avg)}</div>last-3 avg</div>
        <div><div className="text-sm text-ink">{fmt(variant, progress.best)}</div>best</div>
      </div>

      {!editing && (
        <div className="flex gap-3 text-xs text-muted">
          <button className="underline" onClick={() => { setValue(toInput(variant, goal.target)); setEditing(true) }}>Edit</button>
          <button className="underline" onClick={() => onDelete(goal.id)}>Remove</button>
        </div>
      )}
    </section>
  )
}

function AddGoal({ variants, existing, onSave }: { variants: GoalVariant[]; existing: Set<string>; onSave: Props['onSave'] }) {
  const options = variants.filter((v) => !existing.has(v.id))
  const [scenarioId, setScenarioId] = useState(options[0]?.id ?? '')
  const [value, setValue] = useState(70)
  const variant = variants.find((v) => v.id === scenarioId)
  if (!options.length) return null

  return (
    <form className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-line p-4"
      onSubmit={async (e) => {
        e.preventDefault()
        if (variant) await onSave(variant.id, fromInput(variant, value))
      }}>
      <span className="text-sm text-ink-2">Add a goal:</span>
      <select className={inputCls} value={scenarioId} onChange={(e) => setScenarioId(e.currentTarget.value)}>
        {options.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
      </select>
      <input type="number" step={variant?.clicking ? 1 : 0.5} min={1} max={variant?.clicking ? 1000 : 100} value={value}
        className={`${inputCls} w-24`} onChange={(e) => Number.isFinite(e.currentTarget.valueAsNumber) && setValue(e.currentTarget.valueAsNumber)} />
      <span className="text-sm text-muted">{variant?.clicking ? 'kills' : '%'}</span>
      <button className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white">Add</button>
    </form>
  )
}
