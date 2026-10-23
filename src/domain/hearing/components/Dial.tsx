import { useState, type MouseEvent } from 'react'

const DEG = Math.PI / 180
const R = 100

type Props = {
  /** Full circle (behind cue on) or the front half only. */
  full: boolean
  disabled?: boolean
  answer?: number
  truth?: number
  onPick: (angle: number) => void
}

const tip = (angle: number, r = R - 4) => ({ x: r * Math.sin(angle * DEG), y: -r * Math.cos(angle * DEG) })

/** Top-down dial around the listener: up = front, right = right. Click to answer. */
export function Dial({ full, disabled, answer, truth, onPick }: Props) {
  const [hover, setHover] = useState<number | null>(null)

  const angleAt = (e: MouseEvent<SVGSVGElement>): number => {
    const svg = e.currentTarget
    const ctm = svg.getScreenCTM()
    if (!ctm) return 0
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    const a = Math.atan2(p.x, -p.y) / DEG
    return full ? a : Math.max(-90, Math.min(90, a))
  }

  const ticks = full ? [0, 45, 90, 135, 180, -135, -90, -45] : [0, 45, 90, -45, -90]
  const line = (angle: number, cls: string, width = 3) => {
    const t = tip(angle)
    return <line x1={0} y1={0} x2={t.x} y2={t.y} className={cls} strokeWidth={width} strokeLinecap="round" />
  }

  return (
    <svg
      viewBox={full ? '-115 -115 230 230' : '-115 -115 230 130'}
      className={`w-full max-w-md select-none ${disabled ? 'opacity-60' : 'cursor-crosshair'}`}
      onPointerMove={(e) => setHover(disabled ? null : angleAt(e))}
      onPointerLeave={() => setHover(null)}
      onClick={(e) => !disabled && onPick(angleAt(e))}
    >
      {full
        ? <circle r={R} className="fill-surface stroke-line" strokeWidth={2} />
        : <path d={`M ${-R} 0 A ${R} ${R} 0 0 1 ${R} 0 Z`} className="fill-surface stroke-line" strokeWidth={2} />}
      {ticks.map((a) => {
        const o = tip(a, R), i = tip(a, R - 8)
        return <line key={a} x1={i.x} y1={i.y} x2={o.x} y2={o.y} className="stroke-muted" strokeWidth={1.5} />
      })}
      <text x={0} y={-R - 4} textAnchor="middle" className="fill-muted text-[9px]">front</text>
      <text x={-R - 4} y={full ? 3 : -4} textAnchor="end" className="fill-muted text-[9px]">L</text>
      <text x={R + 4} y={full ? 3 : -4} className="fill-muted text-[9px]">R</text>
      {full && <text x={0} y={R + 12} textAnchor="middle" className="fill-muted text-[9px]">back</text>}
      {hover !== null && answer === undefined && line(hover, 'stroke-ink-2/40', 2)}
      {truth !== undefined && line(truth, 'stroke-emerald-400')}
      {answer !== undefined && line(answer, 'stroke-accent')}
      <circle r={7} className="fill-surface-2 stroke-ink-2" strokeWidth={1.5} />
    </svg>
  )
}
