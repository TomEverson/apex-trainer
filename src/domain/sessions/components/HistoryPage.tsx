import { formatScore, scoreOf, sensLabel, type SessionRow } from '../../../common/lib/tracking'
import { AccuracyChart } from './AccuracyChart'

const pct = (v: number | null | undefined) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`)
const num = (v: number | null | undefined, d = 2, unit = '') => (v == null ? '—' : `${v.toFixed(d)}${unit}`)
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

type Props = {
  sessions: SessionRow[]
  /** Scenario ids in display order (owned by the trainer domain). */
  order: string[]
}

export function HistoryPage({ sessions, order }: Props) {
  const groups = new Map<string, SessionRow[]>()
  for (const s of sessions) groups.set(s.scenario.id, [...(groups.get(s.scenario.id) ?? []), s])
  const ids = [...order.filter((id) => groups.has(id)), ...[...groups.keys()].filter((id) => !order.includes(id))]

  if (!ids.length) {
    return <p className="py-6 text-muted">No runs yet. Play a scenario and your results will show up here.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {ids.map((id) => {
        const runs = [...(groups.get(id) ?? [])].sort((a, b) => a.startedAt.localeCompare(b.startedAt))
        const scores = runs.map(scoreOf)
        const last5 = scores.slice(-5)
        const clicking = runs[0].kind === 'clicking'
        const headers = clicking
          ? ['When', 'Kills', 'Hit', 'Kills/s', 'ms/kill', 'Flick', 'Misses past/short/side', 'Sens']
          : ['When', 'Acc', 'Steady', 'Post-turn', 'Lag', 'Speed', 'React', 'Jitter', 'Sens']
        return (
          <section key={id} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <b className="text-base">
                {runs[0].scenario.name}
                {!order.includes(id.split('@')[0]) && <span className="ml-2 text-xs font-normal text-muted">retired version</span>}
              </b>
              <span className="text-sm text-muted">
                {runs.length} run{runs.length === 1 ? '' : 's'} · avg {formatScore(runs[0], scores.reduce((a, b) => a + b, 0) / scores.length)} · best {formatScore(runs[0], Math.max(...scores))} · last-5 avg {formatScore(runs[0], last5.reduce((a, b) => a + b, 0) / last5.length)}
              </span>
            </div>
            <AccuracyChart runs={runs} />
            <div className="overflow-x-auto">
              <table className="mt-3 w-full border-collapse text-[13px] tabular-nums">
                <thead>
                  <tr className="text-muted">
                    {headers.map((h, i) => (
                      <th key={h} className={`border-b border-line px-2 py-1.5 font-medium ${i ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-ink-2">
                  {runs.slice(-10).reverse().map((r) => {
                    const cells = r.kind === 'clicking'
                      ? [
                          String(r.summary.kills), pct(r.summary.accuracy), num(r.summary.kps), num(r.summary.medianKillMs, 0, 'ms'),
                          num(r.summary.medianFlickDeg, 1, '°'),
                          `${r.summary.misses.over}/${r.summary.misses.under}/${r.summary.misses.side}`, sensLabel(r.settings),
                        ]
                      : [
                          pct(r.summary.accuracy), pct(r.summary.steadyAccuracy), pct(r.summary.turnAccuracy), num(r.summary.lagDeg, 2, '°'),
                          r.summary.velocityMatch == null ? '—' : `${(r.summary.velocityMatch * 100).toFixed(0)}%`,
                          num(r.summary.reaction.medianReactionMs, 0, 'ms'), num(r.summary.jitterDegS, 1), sensLabel(r.settings),
                        ]
                    return (
                      <tr key={r.id}>
                        <td className="border-b border-line px-2 py-1.5">{fmtDate(r.startedAt)}</td>
                        {cells.map((c, i) => <td key={i} className="border-b border-line px-2 py-1.5 text-right">{c}</td>)}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
    </div>
  )
}
