import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { SCENARIOS, angularSpeed, withSpeed } from '../domain/trainer'
import { useSettings } from '../domain/settings'
import { formatScore, scoreOf, type SessionRow } from '../common/lib/tracking'
import { enterFullscreen } from '../common/lib/fullscreen'
import { weekStartOf } from '../common/lib/week'
import { listSessionsFn } from '../domain/sessions'
import { goalProgress, listGoalsFn } from '../domain/goals'

export const Route = createFileRoute('/_menu/')({
  loader: async () => {
    const [sessions, goals] = await Promise.all([listSessionsFn(), listGoalsFn({ data: {} })])
    return { sessions, goals }
  },
  component: PlayRoute,
})

type Stats = { runs: SessionRow[]; avg: number; best: SessionRow }

function PlayRoute() {
  const { sessions, goals } = Route.useLoaderData()
  const { settings } = useSettings()
  const mult = settings.targetSpeed
  // "This week" is the player's local week; the server renders before we know it.
  const [week, setWeek] = useState<string | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the browser's local date
    setWeek(weekStartOf(new Date()))
  }, [])

  const stats = new Map<string, Stats>()
  for (const s of sessions) {
    const runs = [...(stats.get(s.scenario.id)?.runs ?? []), s]
    const best = runs.reduce((a, b) => (scoreOf(b) > scoreOf(a) ? b : a))
    stats.set(s.scenario.id, { runs, best, avg: runs.reduce((a, r) => a + scoreOf(r), 0) / runs.length })
  }

  return (
    <>
      <p className="mt-6 mb-4 text-ink-2">
        Pick a scenario. Click to lock the mouse and keep the crosshair on the target. <kbd className="rounded bg-surface-2 px-1.5">R</kbd> restarts, <kbd className="rounded bg-surface-2 px-1.5">F</kbd> fullscreen, <kbd className="rounded bg-surface-2 px-1.5">Esc</kbd> aborts.
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
        {SCENARIOS.map((base) => {
          const sc = withSpeed(base, mult)
          const st = stats.get(sc.id)
          const goal = week ? goals.find((g) => g.scenarioId === sc.id && g.weekStart === week) : undefined
          const progress = goal ? goalProgress(goal, sessions) : null
          const [lo, hi] = angularSpeed(sc).map(Math.round)
          return (
            <Link key={base.id} to="/play/$scenarioId" params={{ scenarioId: base.id }}
              onClick={() => { if (settings.autoFullscreen) void enterFullscreen() }}
              className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface p-4 transition hover:-translate-y-px hover:border-accent">
              <span className="text-base font-semibold">{sc.name}</span>
              <span className="text-[13px] text-accent">{sc.focus}</span>
              <span className="text-[13px] leading-normal text-ink-2">{sc.description}</span>
              <span className="mt-1 flex justify-between gap-2 text-xs text-muted tabular-nums">
                <span>
                  {st
                    ? `Avg ${formatScore(st.best, st.avg)} · Best ${formatScore(st.best)} · ${st.runs.length} run${st.runs.length === 1 ? '' : 's'}`
                    : 'Not played yet'}
                  {mult !== 1 && sc.mode !== 'tiles' ? ` at ${mult}×` : ''}
                </span>
                <span>{sc.mode === 'tiles' ? 'static · clicking' : `~${lo === hi ? lo : `${lo}–${hi}`}°/s`}</span>
              </span>
              {goal && progress && (
                <span className={`text-xs ${progress.achieved ? 'text-[#3fb67a]' : 'text-ink-2'}`}>
                  {progress.achieved ? '✓ Goal reached' : 'Goal this week'}: {sc.mode === 'tiles' ? `${goal.target} kills` : `${(goal.target * 100).toFixed(0)}%`}
                  {!progress.achieved && progress.last3Avg !== null && ` · last-3 avg ${sc.mode === 'tiles' ? Math.round(progress.last3Avg) : `${(progress.last3Avg * 100).toFixed(1)}%`}`}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </>
  )
}
