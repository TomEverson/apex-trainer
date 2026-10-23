import { useState, type MouseEvent, type ReactNode } from 'react'

const W = 600, H = 160
const PAD = { l: 36, r: 8, t: 10, b: 20 }

type Props = {
  /** One value per run, oldest first. */
  values: number[]
  unit: string
  /** Clamp the y-axis to 100 (percentages). */
  capAt100: boolean
  ariaLabel: string
  /** Tooltip body for run i. */
  tooltip: (i: number) => ReactNode
}

/** Single-series value-per-run line with crosshair + tooltip on hover. */
export function RunChart({ values: vals, unit, capAt100, ariaLabel, tooltip }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const lo = Math.max(0, Math.floor((Math.min(...vals) - 5) / 10) * 10)
  const top = Math.ceil((Math.max(...vals) + 5) / 10) * 10
  const hi = capAt100 ? Math.min(100, top) : top
  const span = hi - lo || 10
  const x = (i: number) =>
    PAD.l + (vals.length === 1 ? (W - PAD.l - PAD.r) / 2 : (i / (vals.length - 1)) * (W - PAD.l - PAD.r))
  const y = (v: number) => PAD.t + (1 - (v - lo) / span) * (H - PAD.t - PAD.b)
  const ticks = [0, 1, 2, 3, 4].map((k) => lo + (span * k) / 4)
  const pts = vals.map((v, i) => ({ x: x(i), y: y(v) }))

  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const vx = ((e.clientX - rect.left) / rect.width) * W
    let idx = 0
    for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i].x - vx) < Math.abs(pts[idx].x - vx)) idx = i
    setHover(idx)
  }

  const h = hover === null ? null : { pt: pts[hover], i: hover }

  return (
    <div className="relative mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible" role="img"
        aria-label={ariaLabel} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="stroke-line" strokeWidth={1} />
            <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" className="fill-muted text-[11px]">{Math.round(v)}{unit}</text>
          </g>
        ))}
        <text x={PAD.l} y={H - 4} className="fill-muted text-[11px]">run 1</text>
        <text x={W - PAD.r} y={H - 4} textAnchor="end" className="fill-muted text-[11px]">run {vals.length}</text>
        {pts.length > 1 && (
          <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none"
            className="stroke-series-1" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {pts.length <= 30 && pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4} className="fill-series-1 stroke-surface" strokeWidth={2} />
        ))}
        {h && (
          <>
            <line x1={h.pt.x} x2={h.pt.x} y1={PAD.t} y2={H - PAD.b} className="stroke-muted" strokeDasharray="3 3" />
            <circle cx={h.pt.x} cy={h.pt.y} r={5} className="fill-series-1 stroke-ink" strokeWidth={2} />
          </>
        )}
      </svg>
      {h && (
        <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-[110%] rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-xs whitespace-nowrap text-ink-2"
          style={{ left: `${(h.pt.x / W) * 100}%`, top: `${(h.pt.y / H) * 100}%` }}>
          {tooltip(h.i)}
        </div>
      )}
    </div>
  )
}
