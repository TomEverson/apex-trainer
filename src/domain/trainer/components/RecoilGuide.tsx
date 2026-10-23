import type { RecoilDrill } from '../../../common/lib/recoil'
import { sprayGuide } from '../services/guide'

const HALF_W = 140, MAX_H = 200, PAD = 14

const CONFIDENCE = {
  measured: 'Measured pattern',
  outdated: 'Pattern may be outdated',
  estimate: 'Estimated pattern',
} as const

/**
 * Left-hand spray guide over the drill (SPEC-006): the spray if you don't
 * pull, the mouse path that cancels it, and step-by-step instructions.
 * Never takes clicks — the canvas underneath keeps pointer lock and firing.
 */
export function RecoilGuide({ drill }: { drill: RecoilDrill }) {
  const g = sprayGuide(drill)
  // One degree scale for both halves so the shapes are honest.
  const maxUp = Math.max(0.5, ...g.pattern.map(([, p]) => p))
  const maxSide = Math.max(0.3, ...g.pattern.map(([y]) => Math.abs(y)))
  const k = Math.min((MAX_H - 2 * PAD) / maxUp, (HALF_W / 2 - PAD) / maxSide)
  const H = maxUp * k + 2 * PAD
  // Spray: starts at the bottom and climbs. Pull: starts at the top and mirrors it.
  const spray = g.pattern.map(([y, p]) => [HALF_W / 2 + y * k, H - PAD - p * k])
  const pull = g.pattern.map(([y, p]) => [HALF_W + HALF_W / 2 - y * k, PAD + p * k])
  const path = (pts: number[][]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('')

  return (
    <aside className="pointer-events-none fixed top-1/2 left-4 z-10 max-h-[calc(100vh-2rem)] w-[360px] -translate-y-1/2 overflow-hidden rounded-xl border border-line/70 bg-bg/80 p-4 text-sm text-ink-2">
      <div className="flex items-baseline justify-between gap-2">
        <b className="text-base text-ink">{drill.weapon.name}</b>
        <span className="text-xs text-muted">Tab to hide</span>
      </div>
      <div className="text-xs text-muted">{drill.magSize} rounds · {CONFIDENCE[drill.weapon.confidence]}</div>

      <svg viewBox={`0 0 ${2 * HALF_W} ${H + 18}`} className="mt-2 block w-full" role="img"
        aria-label="Spray pattern without pulling, and the mouse path that cancels it">
        <line x1={HALF_W} x2={HALF_W} y1={0} y2={H} className="stroke-line" />
        <path d={path(spray)} fill="none" className="stroke-muted" strokeWidth={1.5} strokeDasharray="3 3" />
        {spray.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.6} className="fill-ink-2" opacity={0.6} />)}
        <path d={path(pull)} fill="none" className="stroke-series-1" strokeWidth={2.5} strokeLinejoin="round" />
        <circle cx={pull[0][0]} cy={pull[0][1]} r={3.5} className="fill-ink" />
        {g.marks.map((b, i) => (
          <g key={b}>
            <circle cx={pull[b][0]} cy={pull[b][1]} r={8} className="fill-series-1" />
            <text x={pull[b][0]} y={pull[b][1] + 4} textAnchor="middle" className="fill-white text-[11px] font-bold">{i + 1}</text>
          </g>
        ))}
        <text x={HALF_W / 2} y={H + 14} textAnchor="middle" className="fill-muted text-[13px]">Spray (no pull)</text>
        <text x={HALF_W * 1.5} y={H + 14} textAnchor="middle" className="fill-muted text-[13px]">Your mouse</text>
      </svg>

      <ol className="mt-3 space-y-2">
        {g.steps.map((s, i) => (
          <li key={s.from} className="flex gap-2 leading-snug">
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-series-1 text-xs font-bold text-white">{i + 1}</span>
            <span><span className="text-ink">Bullets {s.from}–{s.to}:</span> {s.text}</span>
          </li>
        ))}
      </ol>

      <ul className="mt-3 list-disc space-y-1.5 border-t border-line pt-3 pl-4 text-[13px] leading-snug text-ink-2">
        {g.tips.map((t) => <li key={t}>{t}</li>)}
      </ul>
    </aside>
  )
}
