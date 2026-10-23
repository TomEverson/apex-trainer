/** Geometry for the results spray plot (SPEC-006): degrees from the aim point, screen-up = +y. */
import { PILL, type RecoilShots, type RecoilSummary } from '../../../common/lib/recoil'
import { wrapDeg } from './metrics'

const DEG = Math.PI / 180
const SIZE = 300
const PAD_DEG = 0.4

const toDeg = (m: number, rangeM: number) => Math.atan2(m, rangeM) / DEG

/** Pill outline in degrees relative to its centre at this range. */
export const pillDeg = (rangeM: number) => ({
  halfH: toDeg(PILL.height / 2, rangeM),
  radius: toDeg(PILL.radius, rangeM),
})

export function sprayPlot(rangeM: number, s: RecoilSummary, S: RecoilShots) {
  const bullets: [number, number][] = S.t.map((_, i) => [
    wrapDeg(S.cYaw[i] - S.tYaw[i]) * Math.cos(S.tPitch[i] * DEG),
    S.cPitch[i] - S.tPitch[i],
  ])
  const avg: [number, number][] = s.avgSpray.horiz.map((x, k) => [x, s.avgSpray.vert[k]])
  // No-pull pattern: mean stored offset per bullet index, from the aim point.
  const sum = new Map<number, [number, number, number]>()
  S.idx.forEach((k, i) => {
    const [x, y, n] = sum.get(k) ?? [0, 0, 0]
    sum.set(k, [x + S.oYaw[i], y + S.oPitch[i], n + 1])
  })
  const pattern: [number, number][] = [...sum.entries()].sort(([a], [b]) => a - b).map(([, [x, y, n]]) => [x / n, y / n])

  // Frame the pattern, the average spray and the pill; stray bullets may clip.
  const pill = pillDeg(rangeM)
  const pts = [...pattern, ...avg]
  const xMax = Math.max(pill.radius * 1.5, ...pts.map(([x]) => Math.abs(x))) + PAD_DEG
  const yMax = Math.max(pill.halfH, ...pts.map(([, y]) => y)) + PAD_DEG
  const yMin = Math.min(-pill.halfH, ...pts.map(([, y]) => y)) - PAD_DEG
  const span = Math.max(2 * xMax, yMax - yMin)
  const yMid = (yMax + yMin) / 2
  const k = SIZE / span
  return {
    size: SIZE,
    pill,
    sx: (x: number) => SIZE / 2 + x * k,
    sy: (y: number) => SIZE / 2 - (y - yMid) * k,
    bullets,
    avg,
    pattern,
  }
}
