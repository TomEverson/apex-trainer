import type { Summary, Tip } from '../../../common/lib/tracking'

const pct = (v: number | null | undefined) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`)
const deg = (v: number | null | undefined) => (v == null ? '—' : `${v.toFixed(2)}°`)
const ms = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v)} ms`)

type Props = {
  title: string
  summary: Summary | null
  tips: Tip[]
  saveStatus: string
  onRetry: () => void
  onMenu: () => void
}

export function ResultsPanel({ title, summary: s, tips, saveStatus, onRetry, onMenu }: Props) {
  const rq = s?.reacquire
  const stats: [string, string, string][] = s
    ? [
        ...(rq
          ? ([
              ['Acquire after jump', ms(rq.medianAcquireMs), `Median until first on target · ${rq.jumps} jumps`],
              ['Settle after jump', ms(rq.medianSettleMs), `Until held ≥100ms · ${rq.missed} not settled in 1.5s`],
            ] satisfies [string, string, string][])
          : []),
        ['Steady accuracy', pct(s.steadyAccuracy), 'On target while the target keeps its direction'],
        ['After direction change', pct(s.turnAccuracy), 'On target in the 350ms after a reversal'],
        ['Lag behind target', deg(s.lagDeg), `+ = behind, − = ahead · ${s.lagRadii.toFixed(2)}× target radius`],
        ['Speed match', s.velocityMatch == null ? '—' : `${(s.velocityMatch * 100).toFixed(0)}%`, 'Crosshair speed ÷ target speed (100% ideal)'],
        ['Reaction time', ms(s.reaction.medianReactionMs), `Median over ${s.reaction.events} reversals`],
        ['Re-acquire time', ms(s.reaction.medianRecoveryMs), 'Until back on target ≥100ms'],
        ['Overshoot', deg(s.reaction.meanOvershootDeg), 'Crosshair ahead after a reversal'],
        ['Mean error', deg(s.meanErrDeg), `${s.meanErrRadii.toFixed(2)}× target radius`],
        ['Horizontal / vertical error', `${deg(s.horizErrDeg)} / ${deg(s.vertErrDeg)}`, 'Mean absolute'],
        ['Left / right moving', `${pct(s.dirAccuracy.left)} / ${pct(s.dirAccuracy.right)}`, 'Accuracy by target direction'],
        ['Slow / fast target', `${pct(s.speedAccuracy.slow)} / ${pct(s.speedAccuracy.fast)}`, 'By angular speed tercile'],
        ['Thirds', s.thirds.map(pct).join(' · '), 'Start · middle · end of run'],
        ['Jitter', `${s.jitterDegS.toFixed(1)}°/s`, 'Micro-correction noise (lower = smoother)'],
      ]
    : []

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="my-2">
        <span className="text-6xl font-extrabold tabular-nums">{pct(s?.accuracy)}</span>
        <span className="ml-2 text-muted">on target</span>
      </div>
      <p className="text-sm text-muted">{saveStatus}</p>

      {!s && <p className="mt-6 text-ink-2">The run was too short to analyse.</p>}

      <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
        {stats.map(([k, v, d]) => (
          <div key={k} className="rounded-xl border border-line bg-surface p-3">
            <div className="text-xl font-bold tabular-nums">{v}</div>
            <div className="mt-0.5 text-xs text-ink-2">{k}</div>
            <div className="mt-1 text-[11px] leading-snug text-muted">{d}</div>
          </div>
        ))}
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
