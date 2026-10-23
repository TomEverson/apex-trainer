import type { RecoilSessionRow } from '../../../common/lib/recoil'
import { RunChart } from './RunChart'

const pct = (v: number | null | undefined) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`)
const pct0 = (v: number | null | undefined) => (v == null ? '—' : `${(v * 100).toFixed(0)}%`)
const deg = (v: number | null | undefined) => (v == null ? '—' : `${v.toFixed(2)}°`)
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

const HEADERS = ['When', 'Hit', 'V comp', 'H comp', 'Error', 'V bias', 'H bias', 'Early/late err', 'First', 'Consist.', '°/count']

type Props = {
  sessions: RecoilSessionRow[]
  /** Weapon ids in display order (owned by the trainer domain). */
  order: string[]
}

/** Recoil Control history (SPEC-006): one section per drill variant. */
export function RecoilHistory({ sessions, order }: Props) {
  const groups = new Map<string, RecoilSessionRow[]>()
  for (const s of sessions) groups.set(s.drill.id, [...(groups.get(s.drill.id) ?? []), s])
  const rank = (id: string) => {
    const i = order.indexOf(groups.get(id)?.[0].drill.weapon.id ?? '')
    return i === -1 ? order.length : i
  }
  const ids = [...groups.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))

  if (!ids.length) {
    return <p className="py-6 text-muted">No recoil runs yet. Spray a weapon in Recoil Control and your results will show up here.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {ids.map((id) => {
        const runs = [...(groups.get(id) ?? [])].sort((a, b) => a.startedAt.localeCompare(b.startedAt))
        const hits = runs.map((r) => r.summary.hitRate ?? 0)
        const last5 = hits.slice(-5)
        const d = runs.at(-1)?.drill
        if (!d) return null
        const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
        return (
          <section key={id} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <b className="text-base">
                {d.name}
                <span className="ml-2 text-xs font-normal text-muted">
                  {d.magSize} rounds · barrel {['none', 'white', 'blue', 'purple'][d.barrelTier]}
                </span>
              </b>
              <span className="text-sm text-muted">
                {runs.length} run{runs.length === 1 ? '' : 's'} · avg {pct(mean(hits))} · best {pct(Math.max(...hits))} · last-5 avg {pct(mean(last5))}
              </span>
            </div>
            <RunChart values={hits.map((h) => h * 100)} unit="%" capAt100 ariaLabel="Hit rate per recoil run"
              tooltip={(i) => (
                <>
                  <b className="text-ink">{pct(hits[i])}</b> hits · run {i + 1}
                  <br />{fmtDate(runs[i].startedAt)}
                  <br />vertical comp {pct0(runs[i].summary.vertComp)} · error {deg(runs[i].summary.meanErrDeg)}
                </>
              )} />
            <div className="overflow-x-auto">
              <table className="mt-3 w-full border-collapse text-[13px] tabular-nums">
                <thead>
                  <tr className="text-muted">
                    {HEADERS.map((h, i) => (
                      <th key={h} className={`border-b border-line px-2 py-1.5 font-medium ${i ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-ink-2">
                  {runs.slice(-10).reverse().map((r) => {
                    const s = r.summary
                    const cells = [
                      pct(s.hitRate), pct0(s.vertComp), pct0(s.horizComp), deg(s.meanErrDeg), deg(s.vertBiasDeg), deg(s.horizBiasDeg),
                      `${deg(s.phases.early.meanErrDeg)} / ${deg(s.phases.late.meanErrDeg)}`, deg(s.firstShotErrDeg), deg(s.consistencyDeg),
                      r.degPerCount.toFixed(4),
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
