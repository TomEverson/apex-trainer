import { scoreOf, type SessionRow } from '../../../common/lib/tracking'
import { RunChart } from './RunChart'

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

/** Score per run: on-target % for tracking, kills for clicking. */
export function AccuracyChart({ runs }: { runs: SessionRow[] }) {
  const clicking = runs[0]?.kind === 'clicking'
  const vals = runs.map((r) => (clicking ? scoreOf(r) : scoreOf(r) * 100))
  return (
    <RunChart values={vals} unit={clicking ? '' : '%'} capAt100={!clicking}
      ariaLabel={clicking ? 'Kills per run' : 'On-target accuracy per run'}
      tooltip={(i) => {
        const r = runs[i]
        return (
          <>
            <b className="text-ink">{clicking ? `${vals[i]} kills` : `${vals[i].toFixed(1)}%`}</b> · run {i + 1}
            <br />{fmtDate(r.startedAt)}
            <br />{r.kind === 'tracking'
              ? `lag ${r.summary.lagDeg.toFixed(2)}° · react ${r.summary.reaction.medianReactionMs?.toFixed(0) ?? '—'}ms`
              : `hit ${((r.summary.accuracy ?? 0) * 100).toFixed(0)}% · ${r.summary.medianKillMs?.toFixed(0) ?? '—'}ms/kill`}
          </>
        )
      }} />
  )
}
