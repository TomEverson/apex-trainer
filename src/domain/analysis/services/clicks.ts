/**
 * Clicking analysis (SPEC-003). Pure functions over the shot log.
 * Miss direction is judged relative to the flick: from the crosshair at the
 * previous kill (or the run start) toward the target the miss was nearest to.
 */
import type { ClickSummary, Shots, Tip } from '../../../common/lib/tracking'
import { wrapDeg } from './metrics'

const DEG = Math.PI / 180
const TIMELINE_STEP = 5

function median(arr: number[]): number | null {
  if (!arr.length) return null
  const s = [...arr].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const r3 = (x: number) => Math.round(x * 1000) / 1000
const r3n = (x: number | null) => (x === null ? null : r3(x))

/** Offset of (yaw, pitch) from (yaw0, pitch0) in screen-like degrees. */
const offset = (yaw: number, pitch: number, yaw0: number, pitch0: number) => ({
  x: wrapDeg(yaw - yaw0) * Math.cos(pitch0 * DEG),
  y: pitch - pitch0,
})

export function computeClickSummary(S: Shots, durationS: number): ClickSummary {
  const killTimes: number[] = []
  const killMs: number[] = []
  const flicks: number[] = []
  const misses = { over: 0, under: 0, side: 0 }
  let originYaw = S.startYaw, originPitch = S.startPitch, lastKillT = 0

  for (let i = 0; i < S.t.length; i++) {
    const flick = offset(S.tYaw[i], S.tPitch[i], originYaw, originPitch)
    const flickLen = Math.hypot(flick.x, flick.y)
    if (S.hit[i]) {
      killTimes.push(S.t[i])
      killMs.push((S.t[i] - lastKillT) * 1000)
      flicks.push(flickLen)
      lastKillT = S.t[i]
      originYaw = S.cYaw[i]
      originPitch = S.cPitch[i]
      continue
    }
    // Miss: where did the crosshair land relative to the target, along the flick?
    const m = offset(S.cYaw[i], S.cPitch[i], S.tYaw[i], S.tPitch[i])
    if (flickLen < 1e-6) {
      misses.side++
      continue
    }
    const ux = flick.x / flickLen, uy = flick.y / flickLen
    const along = m.x * ux + m.y * uy
    const perp = -m.x * uy + m.y * ux
    if (Math.abs(perp) > Math.abs(along)) misses.side++
    else if (along > 0) misses.over++
    else misses.under++
  }

  // Kill time vs flick distance: split at this run's median flick.
  const split = median(flicks)
  const short: number[] = [], long: number[] = []
  flicks.forEach((f, k) => (split !== null && f < split ? short : long).push(killMs[k]))

  const kills = killTimes.length
  const thirds = [0, 0, 0]
  const timeline = Array.from({ length: Math.ceil(durationS / TIMELINE_STEP) }, () => 0)
  for (const t of killTimes) {
    thirds[Math.min(2, Math.floor((t / durationS) * 3))]++
    timeline[Math.min(timeline.length - 1, Math.floor(t / TIMELINE_STEP))]++
  }

  return {
    durationS: r3(durationS),
    kills,
    shots: S.t.length,
    accuracy: S.t.length ? r3(kills / S.t.length) : null,
    kps: r3(kills / durationS),
    medianKillMs: r3n(median(killMs)),
    medianFlickDeg: r3n(split),
    killMsShort: r3n(median(short)),
    killMsLong: r3n(median(long)),
    misses,
    thirds,
    timeline,
  }
}

export function diagnoseClicks(s: ClickSummary): Tip[] {
  const tips: Tip[] = []
  const missed = s.misses.over + s.misses.under + s.misses.side
  if (s.accuracy !== null && s.accuracy < 0.8 && s.shots >= 10) {
    tips.push({ key: 'click-accuracy', text: `Hit rate ${(s.accuracy * 100).toFixed(0)}%. You're clicking before you're on the target — slow down slightly until you're above 85–90%, then speed back up.` })
  }
  if (missed >= 4 && s.misses.over >= 2 * Math.max(1, s.misses.under)) {
    tips.push({ key: 'flick-overshoot', text: `${s.misses.over} of ${missed} misses landed past the target. Same habit as the reversals in Sweep: you carry too much speed into the stop. Aim to decelerate onto the target, not through it.` })
  } else if (missed >= 4 && s.misses.under >= 2 * Math.max(1, s.misses.over)) {
    tips.push({ key: 'flick-undershoot', text: `${s.misses.under} of ${missed} misses fell short of the target. Commit to the full flick — you're stopping early and clicking before the correction.` })
  }
  if (s.killMsShort !== null && s.killMsLong !== null && s.killMsLong > s.killMsShort * 1.6) {
    tips.push({ key: 'flick-distance', text: `Long flicks cost ${s.killMsLong.toFixed(0)}ms vs ${s.killMsShort.toFixed(0)}ms for short ones. Distance hurts you a lot — practise moving the full distance in one motion.` })
  }
  if (s.thirds[0] >= 6 && s.thirds[2] < s.thirds[0] * 0.85) {
    tips.push({ key: 'fatigue', text: `Kills dropped from ${s.thirds[0]} in the first third to ${s.thirds[2]} in the last. Pace drops off — keep sets short and focused.` })
  }
  if (!tips.length) tips.push({ key: 'solid', text: 'Clean run — no clear weakness. Push your speed until accuracy just starts to drop.' })
  return tips
}
