import type { RecoilDrill, RecoilShots, RecoilSummary } from '../../../common/lib/recoil'
import type { Tip } from '../../../common/lib/tracking'
import { sprayPlot } from '../services/sprayPlot'

const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toFixed(1)}%`)
const deg = (v: number | null) => (v === null ? '—' : `${v.toFixed(2)}°`)
const signed = (v: number | null, pos: string, neg: string) =>
  v === null ? '—' : `${Math.abs(v).toFixed(2)}° ${v >= 0 ? pos : neg}`

type Props = {
  drill: RecoilDrill
  summary: RecoilSummary
  shots: RecoilShots
  tips: Tip[]
  saveStatus: string
  onRetry: () => void
  onMenu: () => void
}

/** Results for Recoil Control drills (SPEC-006). */
export function RecoilResultsPanel({ drill, summary: s, shots, tips, saveStatus, onRetry, onMenu }: Props) {
  const { early, mid, late } = s.phases
  const stats: [string, string, string][] = [
    ['Vertical compensation', pct(s.vertComp), '100% = recoil fully cancelled · 0% = no pull'],
    ['Horizontal compensation', s.horizComp === null ? 'n/a' : pct(s.horizComp), s.horizComp === null ? 'Pattern has little sideways movement' : 'Sideways part of the pattern'],
    ['Mean error', deg(s.meanErrDeg), `Bullet to target centre · median ${deg(s.medianErrDeg)}`],
    ['Vertical bias', signed(s.vertBiasDeg, 'high', 'low'), 'High = not pulling down enough'],
    ['Horizontal bias', signed(s.horizBiasDeg, 'right', 'left'), 'Average sideways miss'],
    ['Early / mid / late error', [early, mid, late].map((p) => deg(p.meanErrDeg)).join(' · '), 'By third of each spray'],
    ['Early / mid / late hits', [early, mid, late].map((p) => pct(p.hitRate)).join(' · '), 'By third of each spray'],
    ['First bullet', deg(s.firstShotErrDeg), 'Aim before firing (not recoil)'],
    ['Consistency', deg(s.consistencyDeg), 'Spread between sprays, bullet for bullet'],
    ['Bullets', String(s.shots), `Over ${s.sprays} sprays`],
    ['Sprays by third', s.thirds.map(pct).join(' · '), 'First · middle · last sprays'],
  ]
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h2 className="text-xl font-semibold">{drill.name}</h2>
      <div className="my-2">
        <span className="text-6xl font-extrabold tabular-nums">{pct(s.hitRate)}</span>
        <span className="ml-2 text-muted">hits</span>
      </div>
      <p className="text-sm text-muted">{saveStatus}</p>

      <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,320px)_1fr]">
        <SprayPlot drill={drill} summary={s} shots={shots} />
        <div className="grid content-start grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2">
          {stats.map(([k, v, d]) => (
            <div key={k} className="rounded-xl border border-line bg-surface p-3">
              <div className="text-lg font-bold tabular-nums">{v}</div>
              <div className="mt-0.5 text-xs text-ink-2">{k}</div>
              <div className="mt-1 text-[11px] leading-snug text-muted">{d}</div>
            </div>
          ))}
        </div>
      </div>

      <h3 className="mt-7 mb-2.5 text-sm tracking-wider text-ink-2 uppercase">What to work on</h3>
      <ul className="list-disc space-y-2 pl-5 leading-relaxed text-ink-2">
        {tips.map((t) => <li key={t.key}>{t.text}</li>)}
      </ul>

      <div className="mt-7 flex gap-2">
        <button onClick={onRetry} className="rounded-lg bg-accent px-4 py-2.5 font-semibold text-white">Retry (R)</button>
        <button onClick={onMenu} className="rounded-lg border border-line bg-surface-2 px-4 py-2.5 font-semibold">Menu (M)</button>
      </div>
    </div>
  )
}

/**
 * Every bullet relative to the target centre, the average spray and the
 * uncompensated pattern it was fighting — in degrees, on the pill's outline.
 */
function SprayPlot({ drill, summary, shots }: { drill: RecoilDrill; summary: RecoilSummary; shots: RecoilShots }) {
  const p = sprayPlot(drill.rangeM, summary, shots)
  const line = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${p.sx(x).toFixed(1)},${p.sy(y).toFixed(1)}`).join('')
  const rx = p.sx(p.pill.radius) - p.sx(0)
  return (
    <figure className="rounded-xl border border-line bg-surface p-3">
      <svg viewBox={`0 0 ${p.size} ${p.size}`} className="block w-full" role="img"
        aria-label="Bullet impacts relative to the target centre, with the average spray and the no-pull pattern">
        <rect x={p.sx(-p.pill.radius)} y={p.sy(p.pill.halfH)} width={2 * rx} height={p.sy(-p.pill.halfH) - p.sy(p.pill.halfH)}
          rx={rx} className="fill-surface-2 stroke-line" />
        {p.bullets.map(([x, y], i) => (
          <circle key={i} cx={p.sx(x)} cy={p.sy(y)} r={1.6} className="fill-ink-2" opacity={0.35} />
        ))}
        <path d={line(p.pattern)} fill="none" className="stroke-muted" strokeWidth={2} strokeDasharray="4 4" />
        <path d={line(p.avg)} fill="none" className="stroke-series-1" strokeWidth={2} />
        {p.avg.map(([x, y], i) => (
          <circle key={i} cx={p.sx(x)} cy={p.sy(y)} r={6} fill="transparent">
            <title>{`Bullet ${i + 1}: ${Math.abs(y).toFixed(2)}° ${y >= 0 ? 'high' : 'low'}, ${Math.abs(x).toFixed(2)}° ${x >= 0 ? 'right' : 'left'}`}</title>
          </circle>
        ))}
        <circle cx={p.sx(0)} cy={p.sy(0)} r={2.5} className="fill-ink" />
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-2">
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 bg-series-1" />Your average spray</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-4 border-t-2 border-dashed border-muted" />No-pull pattern</span>
        <span className="flex items-center gap-1.5"><span className="inline-block size-1.5 rounded-full bg-ink-2/40" />Bullets</span>
      </figcaption>
    </figure>
  )
}
