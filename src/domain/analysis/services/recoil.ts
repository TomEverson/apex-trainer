/**
 * Recoil Control analysis (SPEC-006). Pure functions over the shot log.
 *
 * Error = bullet direction − aim point (pill centre), screen-like degrees:
 * vert + = above it (not pulling down enough), horiz + = right.
 * Compensation compares each spray's drift since its first bullet with the
 * uncompensated pattern offset stored per shot.
 */
import type { RecoilShots, RecoilSummary } from '../../../common/lib/recoil'
import type { Tip } from '../../../common/lib/tracking'
import { wrapDeg } from './metrics'

const DEG = Math.PI / 180
/** Below this RMS sideways pattern offset there's nothing horizontal to compensate. */
const MIN_HORIZ_RMS_DEG = 0.15

const r3 = (x: number) => Math.round(x * 1000) / 1000
const r3n = (x: number | null) => (x === null ? null : r3(x))
const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null)
function median(arr: number[]): number | null {
  if (!arr.length) return null
  const s = [...arr].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
function std(a: number[]): number | null {
  const m = mean(a)
  if (m === null || a.length < 2) return null
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1))
}
const rate = (hits: number[]) => (hits.length ? r3(hits.filter((h) => h > 0).length / hits.length) : null)

export function computeRecoilSummary(S: RecoilShots): RecoilSummary {
  const n = S.t.length
  const ex: number[] = [], ey: number[] = []
  for (let i = 0; i < n; i++) {
    ex.push(wrapDeg(S.cYaw[i] - S.tYaw[i]) * Math.cos(S.tPitch[i] * DEG))
    ey.push(S.cPitch[i] - S.tPitch[i])
  }
  const err = ex.map((x, i) => Math.hypot(x, ey[i]))

  // Shots grouped by spray, in firing order.
  const sprays = new Map<number, number[]>()
  for (let i = 0; i < n; i++) sprays.set(S.spray[i], [...(sprays.get(S.spray[i]) ?? []), i])
  const groups = [...sprays.values()]

  // Phase by position within its own spray, so a released-early spray still has thirds.
  const phase: number[] = new Array(n)
  for (const g of groups) g.forEach((i, k) => (phase[i] = Math.min(2, Math.floor((k / g.length) * 3))))
  const phaseStats = (p: number) => {
    const idx = [...Array(n).keys()].filter((i) => phase[i] === p)
    return {
      hitRate: rate(idx.map((i) => S.hit[i])),
      meanErrDeg: r3n(mean(idx.map((i) => err[i]))),
      vertBiasDeg: r3n(mean(idx.map((i) => ey[i]))),
      horizBiasDeg: r3n(mean(idx.map((i) => ex[i]))),
    }
  }

  // Compensation per axis: 1 − Σ(drift·pattern) / Σ(pattern²).
  let numX = 0, denX = 0, numY = 0, denY = 0
  for (const g of groups) {
    const f = g[0]
    for (const i of g) {
      numX += (ex[i] - ex[f]) * S.oYaw[i]
      denX += S.oYaw[i] ** 2
      numY += (ey[i] - ey[f]) * S.oPitch[i]
      denY += S.oPitch[i] ** 2
    }
  }
  const vertComp = denY > 1e-9 ? r3(1 - numY / denY) : null
  const horizComp = n && Math.sqrt(denX / n) >= MIN_HORIZ_RMS_DEG ? r3(1 - numX / denX) : null

  // Average spray: mean error per bullet index, and its spread across sprays.
  const maxIdx = n ? Math.max(...S.idx) : -1
  const avgSpray: RecoilSummary['avgSpray'] = { n: [], horiz: [], vert: [] }
  const spreads: number[] = []
  for (let k = 0; k <= maxIdx; k++) {
    const at = [...Array(n).keys()].filter((i) => S.idx[i] === k)
    avgSpray.n.push(at.length)
    avgSpray.horiz.push(r3(mean(at.map((i) => ex[i])) ?? 0))
    avgSpray.vert.push(r3(mean(at.map((i) => ey[i])) ?? 0))
    const sx = std(at.map((i) => ex[i])), sy = std(at.map((i) => ey[i]))
    if (sx !== null && sy !== null) spreads.push(Math.hypot(sx, sy))
  }

  const sprayHitRates = groups.map((g) => rate(g.map((i) => S.hit[i])))
  const thirds = [0, 1, 2].map((p) => {
    const gs = groups.filter((_, k) => Math.min(2, Math.floor((k / groups.length) * 3)) === p)
    return rate(gs.flat().map((i) => S.hit[i]))
  })

  return {
    sprays: groups.length,
    shots: n,
    hitRate: rate(S.hit),
    meanErrDeg: r3n(mean(err)),
    medianErrDeg: r3n(median(err)),
    vertBiasDeg: r3n(mean(ey)),
    horizBiasDeg: r3n(mean(ex)),
    vertSpreadDeg: r3n(std(ey)),
    horizSpreadDeg: r3n(std(ex)),
    vertComp,
    horizComp,
    firstShotErrDeg: r3n(mean(groups.map((g) => err[g[0]]))),
    phases: { early: phaseStats(0), mid: phaseStats(1), late: phaseStats(2) },
    avgSpray,
    consistencyDeg: r3n(mean(spreads)),
    sprayHitRates,
    thirds,
  }
}

const pctOf = (v: number) => `${Math.round(v * 100)}%`
const side = (v: number) => (v > 0 ? 'right' : 'left')

export function diagnoseRecoil(s: RecoilSummary): Tip[] {
  const tips: Tip[] = []
  const { early, late } = s.phases
  if (s.shots < 10) return [{ key: 'solid', text: 'Too few shots to judge — hold the trigger through the full magazine.' }]

  if (s.vertComp !== null && s.vertComp < 0.7) {
    tips.push({ key: 'under-pull', text: `You cancel ${pctOf(s.vertComp)} of the vertical recoil — bullets end up ${late.vertBiasDeg?.toFixed(1) ?? '?'}° above the aim point late in the spray. Pull down harder and start pulling with the first bullet, not when you see the climb.` })
  } else if (s.vertComp !== null && s.vertComp > 1.25) {
    tips.push({ key: 'over-pull', text: `You pull down ${pctOf(s.vertComp - 1)} more than the recoil needs — late bullets land ${Math.abs(late.vertBiasDeg ?? 0).toFixed(1)}° low. Ease off; follow the pattern rather than dragging through it.` })
  }
  if (early.meanErrDeg !== null && late.meanErrDeg !== null && late.meanErrDeg > early.meanErrDeg * 1.8 && late.meanErrDeg > 0.6) {
    tips.push({ key: 'late-drift', text: `The first third of each spray averages ${early.meanErrDeg.toFixed(2)}° off, the last third ${late.meanErrDeg.toFixed(2)}°. You control the opening kick but lose the back half — keep the pull going to the last bullet.` })
  }
  if (s.horizComp !== null && s.horizComp < 0.5 && Math.abs(late.horizBiasDeg ?? 0) > 0.3) {
    const h = late.horizBiasDeg ?? 0
    tips.push({ key: 'horizontal', text: `The sideways part of the pattern pushes you ${side(h)} (${Math.abs(h).toFixed(1)}° late in the spray) and you cancel only ${pctOf(Math.max(0, s.horizComp))} of it. Add a small ${side(-h)} movement as the spray goes on.` })
  } else if (Math.abs(s.horizBiasDeg ?? 0) > 0.4) {
    const h = s.horizBiasDeg ?? 0
    tips.push({ key: 'horizontal', text: `Bullets sit ${Math.abs(h).toFixed(2)}° ${side(h)} of the aim point on average. On a strafing target that's lag or lead; on a static one you're drifting ${side(h)} while pulling down.` })
  }
  if (s.firstShotErrDeg !== null && s.firstShotErrDeg > 0.6) {
    tips.push({ key: 'first-shot', text: `The first bullet of each spray is already ${s.firstShotErrDeg.toFixed(2)}° from the centre. Settle on the target before you press — recoil control can't fix a bad start.` })
  }
  if (s.consistencyDeg !== null && s.consistencyDeg > 0.9) {
    tips.push({ key: 'inconsistent', text: `Your sprays differ by ${s.consistencyDeg.toFixed(2)}° bullet-for-bullet. Do the same pull every time first, then fix its shape — a repeatable wrong pull is easier to correct than a random one.` })
  }
  const [a, , c] = s.thirds
  if (a !== null && c !== null && c < a - 0.1) {
    tips.push({ key: 'fatigue', text: `Hit rate dropped from ${pctOf(a)} in the first sprays to ${pctOf(c)} in the last. Keep sets shorter or rest between them.` })
  }
  if (!tips.length) tips.push({ key: 'solid', text: 'Clean sprays — no clear weakness. Move the target further back, try a strafing target, or take the barrel off.' })
  return tips
}
