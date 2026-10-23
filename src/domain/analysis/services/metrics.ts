/**
 * Tracking analysis (SPEC-001). Pure functions over per-frame samples.
 *
 * Sign convention for "lag": positive = target is ahead of the crosshair
 * along its direction of travel (you are behind), negative = crosshair is
 * ahead (over-leading).
 */
import { SAMPLE_KEYS, emptySamples, type Samples, type Summary, type Tip } from '../../../common/lib/tracking'

const TURN_WINDOW_S = 0.35
const MIN_SPEED_DEG_S = 3
const REACTION_CAP_S = 0.6
const RECOVERY_CAP_S = 1.5
const RECOVERY_HOLD_S = 0.1
const DEG = Math.PI / 180

export const wrapDeg = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180

function median(arr: number[]): number | null {
  if (!arr.length) return null
  const s = [...arr].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null)
const quantile = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]

/** Time-weighted on-target accumulator. */
class Acc {
  on = 0
  time = 0
  add(on: boolean, dt: number) {
    this.time += dt
    if (on) this.on += dt
  }
  get value(): number | null {
    return this.time > 0.25 ? this.on / this.time : null
  }
}

const r3 = (x: number) => Math.round(x * 1000) / 1000
const r3n = (x: number | null) => (x === null || Number.isNaN(x) ? null : r3(x))

export function computeSummary(S: Samples): Summary | null {
  const n = S.t.length
  if (n < 10) return null

  // Per-frame derived signals.
  const ex = new Float64Array(n), ey = new Float64Array(n)
  const tvx = new Float64Array(n), tvy = new Float64Array(n) // target angular velocity, raw
  const cvx = new Float64Array(n), cvy = new Float64Array(n) // crosshair velocity, smoothed ~30ms
  const svx = new Float64Array(n), svy = new Float64Array(n) // crosshair velocity, smoothed ~120ms
  const rcx = new Float64Array(n), rcy = new Float64Array(n) // crosshair velocity, raw
  // Target velocity with the same smoothing, so comparisons don't pick up filter lag.
  const tfx = new Float64Array(n), tfy = new Float64Array(n)
  const tsx = new Float64Array(n), tsy = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const cosP = Math.cos(S.cPitch[i] * DEG)
    ex[i] = wrapDeg(S.tYaw[i] - S.cYaw[i]) * cosP
    ey[i] = S.tPitch[i] - S.cPitch[i]
    if (i === 0) continue
    const dt = Math.max(1e-4, S.t[i] - S.t[i - 1])
    if (S.turn[i] === 2) {
      // Teleport frame: the jump isn't motion, so carry the previous velocity.
      tvx[i] = tvx[i - 1]
      tvy[i] = tvy[i - 1]
    } else {
      tvx[i] = (wrapDeg(S.tYaw[i] - S.tYaw[i - 1]) * cosP) / dt
      tvy[i] = (S.tPitch[i] - S.tPitch[i - 1]) / dt
    }
    const rx = (wrapDeg(S.cYaw[i] - S.cYaw[i - 1]) * cosP) / dt
    const ry = (S.cPitch[i] - S.cPitch[i - 1]) / dt
    rcx[i] = rx
    rcy[i] = ry
    const kf = 1 - Math.exp(-dt / 0.03)
    const ks = 1 - Math.exp(-dt / 0.12)
    cvx[i] = cvx[i - 1] + (rx - cvx[i - 1]) * kf
    cvy[i] = cvy[i - 1] + (ry - cvy[i - 1]) * kf
    svx[i] = svx[i - 1] + (rx - svx[i - 1]) * ks
    svy[i] = svy[i - 1] + (ry - svy[i - 1]) * ks
    tfx[i] = tfx[i - 1] + (tvx[i] - tfx[i - 1]) * kf
    tfy[i] = tfy[i - 1] + (tvy[i] - tfy[i - 1]) * kf
    tsx[i] = tsx[i - 1] + (tvx[i] - tsx[i - 1]) * ks
    tsy[i] = tsy[i - 1] + (tvy[i] - tsy[i - 1]) * ks
  }
  tvx[0] = tvx[1]
  tvy[0] = tvy[1]

  const duration = S.t[n - 1] - S.t[0]
  const total = new Acc(), turnAcc = new Acc(), steadyAcc = new Acc()
  const dirAcc = { left: new Acc(), right: new Acc(), up: new Acc(), down: new Acc() }
  const thirds = [new Acc(), new Acc(), new Acc()]
  const timeline: Acc[] = []
  const TIMELINE_STEP = 5

  let wSum = 0, errSum = 0, errRadSum = 0, lagSum = 0, crossSum = 0, hSum = 0, vSum = 0
  let mvW = 0, velMatchSum = 0, jitterSq = 0, jitterW = 0, speedSum = 0, radSum = 0
  const errs: number[] = []
  const speeds: { s: number; on: boolean; dt: number }[] = []
  let lastTurn = -Infinity

  for (let i = 1; i < n; i++) {
    const dt = S.t[i] - S.t[i - 1]
    if (dt <= 0 || dt > 0.25) continue // skip hitches / tab switches
    const t = S.t[i] - S.t[0]
    const on = S.on[i] === 1
    if (S.turn[i]) lastTurn = t
    const err = Math.hypot(ex[i], ey[i])
    const tSpeed = Math.hypot(tvx[i], tvy[i])

    total.add(on, dt)
    ;(t - lastTurn < TURN_WINDOW_S ? turnAcc : steadyAcc).add(on, dt)
    thirds[Math.min(2, Math.floor((t / duration) * 3))].add(on, dt)
    const b = Math.floor(t / TIMELINE_STEP)
    if (!timeline[b]) timeline[b] = new Acc()
    timeline[b].add(on, dt)
    if (tvx[i] > MIN_SPEED_DEG_S) dirAcc.right.add(on, dt)
    else if (tvx[i] < -MIN_SPEED_DEG_S) dirAcc.left.add(on, dt)
    if (tvy[i] > MIN_SPEED_DEG_S) dirAcc.up.add(on, dt)
    else if (tvy[i] < -MIN_SPEED_DEG_S) dirAcc.down.add(on, dt)

    wSum += dt
    errSum += err * dt
    errRadSum += (err / S.angR[i]) * dt
    hSum += Math.abs(ex[i]) * dt
    vSum += Math.abs(ey[i]) * dt
    radSum += S.angR[i] * dt
    speedSum += tSpeed * dt
    errs.push(err)
    speeds.push({ s: tSpeed, on, dt })
    // High-frequency part of the velocity *error*, outside reversals (those are
    // reaction, not jitter). Perfect tracking scores 0.
    if (t - lastTurn >= TURN_WINDOW_S) {
      const jx = cvx[i] - tfx[i] - (svx[i] - tsx[i])
      const jy = cvy[i] - tfy[i] - (svy[i] - tsy[i])
      jitterSq += (jx ** 2 + jy ** 2) * dt
      jitterW += dt
    }

    if (tSpeed > MIN_SPEED_DEG_S) {
      const ux = tvx[i] / tSpeed, uy = tvy[i] / tSpeed
      lagSum += (ex[i] * ux + ey[i] * uy) * dt
      crossSum += Math.abs(-ex[i] * uy + ey[i] * ux) * dt
      velMatchSum += ((rcx[i] * ux + rcy[i] * uy) / tSpeed) * dt
      mvW += dt
    }
  }
  if (wSum === 0) return null

  // Accuracy by target angular speed (terciles of this run).
  const sortedSpeeds = speeds.map((x) => x.s).sort((a, b) => a - b)
  const q1 = quantile(sortedSpeeds, 1 / 3), q2 = quantile(sortedSpeeds, 2 / 3)
  const speedAcc = { slow: new Acc(), mid: new Acc(), fast: new Acc() }
  for (const x of speeds) (x.s < q1 ? speedAcc.slow : x.s < q2 ? speedAcc.mid : speedAcc.fast).add(x.on, x.dt)

  // Reaction to sharp direction changes (> 60°). Revised 2026-10-21 (SPEC-001):
  // reaction is measured along the target's velocity *change*, and recovery
  // only counts holds that begin after reacting.
  const reactions: number[] = [], recoveries: number[] = [], overshoots: number[] = []
  let missedReactions = 0, recovered = 0
  for (let k = 2; k < n - 2; k++) {
    if (S.turn[k] !== 1) continue
    const bx = tvx[k - 1], by = tvy[k - 1], ax = tvx[k + 1], ay = tvy[k + 1]
    const bm = Math.hypot(bx, by), am = Math.hypot(ax, ay)
    if (bm < MIN_SPEED_DEG_S || am < MIN_SPEED_DEG_S) continue
    if ((bx * ax + by * ay) / (bm * am) > 0.5) continue
    const ux = ax / am, uy = ay / am
    // Direction and size of the target's velocity change. For an ADAD reversal
    // this points the new way with |Δv| = 2v, so "changed by 75% of Δv" means
    // "moving the new way at ≥ 50% of target speed".
    const dvx = ax - bx, dvy = ay - by, dm = Math.hypot(dvx, dvy)
    const wx = dvx / dm, wy = dvy / dm
    const c0 = cvx[k] * wx + cvy[k] * wy, f0 = tfx[k] * wx + tfy[k] * wy
    const t0 = S.t[k]
    let reaction: number | null = null, recovery: number | null = null, holdStart: number | null = null
    let minAlong = 0
    for (let j = k + 1; j < n; j++) {
      const dtj = S.t[j] - t0
      if (dtj > RECOVERY_CAP_S) break
      if (j > k + 1 && S.turn[j]) break // next turn interrupts
      // Compare like with like: the target's filtered velocity change so far
      // (same 30ms smoothing as the crosshair), but at least half of Δv.
      const targetChange = Math.max((tfx[j] * wx + tfy[j] * wy) - f0, 0.5 * dm)
      if (reaction === null && dtj <= REACTION_CAP_S && (cvx[j] * wx + cvy[j] * wy) - c0 >= 0.75 * targetChange) reaction = dtj
      // Overshoot only counts once you've reacted; before that, being "ahead" is just reaction lag.
      if (reaction !== null && dtj <= 0.4) minAlong = Math.min(minAlong, ex[j] * ux + ey[j] * uy)
      // A lagging crosshair the reversing target passes back over isn't "back on target".
      if (S.on[j] && reaction !== null) {
        if (holdStart === null) holdStart = S.t[j]
        if (recovery === null && S.t[j] - holdStart >= RECOVERY_HOLD_S) recovery = holdStart - t0
      } else holdStart = null
      if (recovery !== null && dtj > 0.4) break
    }
    if (reaction === null) missedReactions++
    else reactions.push(reaction * 1000)
    if (recovery !== null) {
      recovered++
      recoveries.push(Math.max(0, recovery) * 1000)
    } else recoveries.push(Infinity) // unrecovered before the next turn / cap
    overshoots.push(-minAlong)
  }
  const medianRecovery = median(recoveries)

  // Reacquire after teleport jumps: first contact, then a ≥100ms hold.
  const acquires: number[] = [], settles: number[] = []
  let jumps = 0, missedJumps = 0
  for (let k = 1; k < n; k++) {
    if (S.turn[k] !== 2) continue
    jumps++
    let acquire: number | null = null, settle: number | null = null, holdStart: number | null = null
    for (let j = k; j < n; j++) {
      const dtj = S.t[j] - S.t[k]
      if (dtj > RECOVERY_CAP_S || (j > k && S.turn[j] === 2)) break
      if (S.on[j]) {
        if (acquire === null) acquire = dtj
        if (holdStart === null) holdStart = S.t[j]
        if (S.t[j] - holdStart >= RECOVERY_HOLD_S) {
          settle = holdStart - S.t[k]
          break
        }
      } else holdStart = null
    }
    if (acquire !== null) acquires.push(acquire * 1000)
    if (settle === null) missedJumps++
    else settles.push(settle * 1000)
  }

  const meanTargetRadiusDeg = radSum / wSum
  const lagDeg = mvW ? lagSum / mvW : 0

  return {
    durationS: r3(duration),
    accuracy: r3n(total.value),
    meanErrDeg: r3(errSum / wSum),
    medianErrDeg: r3n(median(errs)),
    meanErrRadii: r3(errRadSum / wSum),
    lagDeg: r3(lagDeg),
    lagRadii: r3(lagDeg / meanTargetRadiusDeg),
    crossTrackDeg: r3(mvW ? crossSum / mvW : 0),
    horizErrDeg: r3(hSum / wSum),
    vertErrDeg: r3(vSum / wSum),
    velocityMatch: mvW ? r3(velMatchSum / mvW) : null,
    jitterDegS: r3(jitterW ? Math.sqrt(jitterSq / jitterW) : 0),
    meanTargetSpeedDegS: r3(speedSum / wSum),
    meanTargetRadiusDeg: r3(meanTargetRadiusDeg),
    turnAccuracy: r3n(turnAcc.value),
    steadyAccuracy: r3n(steadyAcc.value),
    reaction: {
      events: reactions.length + missedReactions,
      missed: missedReactions,
      medianReactionMs: r3n(median(reactions)),
      meanReactionMs: r3n(mean(reactions)),
      medianRecoveryMs: medianRecovery === null || !Number.isFinite(medianRecovery) ? null : r3(medianRecovery),
      recovered,
      meanOvershootDeg: r3n(mean(overshoots)),
    },
    dirAccuracy: {
      left: r3n(dirAcc.left.value),
      right: r3n(dirAcc.right.value),
      up: r3n(dirAcc.up.value),
      down: r3n(dirAcc.down.value),
    },
    speedAccuracy: {
      slow: r3n(speedAcc.slow.value),
      mid: r3n(speedAcc.mid.value),
      fast: r3n(speedAcc.fast.value),
      splitsDegS: [r3(q1), r3(q2)],
    },
    ...(jumps > 0 && {
      reacquire: {
        jumps,
        missed: missedJumps,
        medianAcquireMs: r3n(median(acquires)),
        medianSettleMs: r3n(median(settles)),
      },
    }),
    thirds: thirds.map((a) => r3n(a.value)),
    timeline: Array.from(timeline, (a) => (a ? r3n(a.value) : null)),
  }
}

/** Downsample to `hz` for storage, always keeping turn frames. */
export function downsample(S: Samples, hz = 60): Samples {
  const out = emptySamples()
  let next = 0
  for (let i = 0; i < S.t.length; i++) {
    if (S.t[i] + 1e-9 < next && !S.turn[i]) continue
    next = S.t[i] + 1 / hz
    for (const k of SAMPLE_KEYS) {
      out[k].push(k === 'on' || k === 'turn' ? S[k][i] : r3(S[k][i]))
    }
  }
  return out
}

/** Rule-based instant feedback. The LLM report goes deeper. */
export function diagnose(s: Summary | null): Tip[] {
  if (!s) return []
  const tips: Tip[] = []
  const pts = (a: number | null, b: number | null) => (a !== null && b !== null ? (a - b) * 100 : 0)
  const pct0 = (v: number | null) => (v === null ? '—' : (v * 100).toFixed(0))
  const { reaction } = s

  if (s.lagRadii > 0.45) {
    tips.push({ key: 'lag', text: `You trail behind the target by ${s.lagDeg.toFixed(2)}° on average (${s.lagRadii.toFixed(2)}× its radius). Aim at the leading edge and push to match its speed instead of chasing where it was.` })
  } else if (s.lagRadii < -0.3) {
    tips.push({ key: 'lead', text: `You run ahead of the target (${Math.abs(s.lagDeg).toFixed(2)}° lead). Ease off — you are anticipating instead of tracking.` })
  }
  if (s.velocityMatch !== null && s.velocityMatch < 0.9) {
    tips.push({ key: 'slow', text: `Your crosshair moves at ${(s.velocityMatch * 100).toFixed(0)}% of target speed. You are under-tracking — commit to the movement; usually tension or too-low sensitivity.` })
  } else if (s.velocityMatch !== null && s.velocityMatch > 1.12) {
    tips.push({ key: 'fast', text: `Your crosshair moves at ${(s.velocityMatch * 100).toFixed(0)}% of target speed — you overshoot and correct. Slow your hand down.` })
  }
  const turnGap = pts(s.steadyAccuracy, s.turnAccuracy)
  if (turnGap > 15) {
    tips.push({ key: 'reactivity', text: `Accuracy drops ${turnGap.toFixed(0)} pts in the ${TURN_WINDOW_S * 1000}ms after a direction change (${pct0(s.turnAccuracy)}% vs ${pct0(s.steadyAccuracy)}% steady). Reactivity is your main leak — drill Strafe · Reactive.` })
  }
  if (reaction.medianReactionMs !== null && reaction.medianReactionMs > 230) {
    tips.push({ key: 'reaction', text: `Median reaction to direction changes is ${reaction.medianReactionMs.toFixed(0)}ms. Stay relaxed so you can reverse instantly; a death grip slows reversals.` })
  }
  if (reaction.meanOvershootDeg !== null && reaction.meanOvershootDeg > s.meanTargetRadiusDeg) {
    tips.push({ key: 'overshoot', text: `After a reversal you overshoot by ~${reaction.meanOvershootDeg.toFixed(2)}° (more than the target radius). You over-correct when re-acquiring.` })
  }
  const lr = pts(s.dirAccuracy.right, s.dirAccuracy.left)
  if (Math.abs(lr) > 8) {
    tips.push({ key: 'asymmetry', text: `You track ${Math.abs(lr).toFixed(0)} pts better when the target moves ${lr > 0 ? 'right' : 'left'}. Check arm/mousepad positioning and give the weaker side extra reps.` })
  }
  if (s.dirAccuracy.up !== null && s.vertErrDeg > s.horizErrDeg * 1.25 && s.vertErrDeg > s.meanTargetRadiusDeg * 0.6) {
    tips.push({ key: 'vertical', text: `Vertical error (${s.vertErrDeg.toFixed(2)}°) is much larger than horizontal (${s.horizErrDeg.toFixed(2)}°). Vertical control is a weakness — drill Air Strafe.` })
  }
  if (s.meanTargetSpeedDegS > 0 && s.jitterDegS / s.meanTargetSpeedDegS > 0.35) {
    tips.push({ key: 'jitter', text: `Lots of micro-corrections (jitter ${s.jitterDegS.toFixed(1)}°/s). Loosen your grip and move smoothly; consider slightly lower sensitivity.` })
  }
  const fatigue = pts(s.thirds[0] ?? null, s.thirds[2] ?? null)
  if (fatigue > 8) {
    tips.push({ key: 'fatigue', text: `Accuracy fell ${fatigue.toFixed(0)} pts from the first to the last third. Focus or endurance drops off — shorter, focused sets may help.` })
  }
  const sp = pts(s.speedAccuracy.slow, s.speedAccuracy.fast)
  if (sp > 15) {
    tips.push({ key: 'speed', text: `You lose ${sp.toFixed(0)} pts when the target is fast (> ${s.speedAccuracy.splitsDegS[1].toFixed(0)}°/s). Your speed ceiling is limiting you — try Close Rush.` })
  }
  const rq = s.reacquire
  if (rq && rq.medianSettleMs !== null && rq.medianAcquireMs !== null && (rq.medianSettleMs > 500 || rq.medianSettleMs - rq.medianAcquireMs > 200)) {
    const correcting = rq.medianSettleMs - rq.medianAcquireMs
    tips.push({
      key: 'reacquire',
      text: correcting > 200
        ? `After a jump you reach the target in ${rq.medianAcquireMs.toFixed(0)}ms but need ${correcting.toFixed(0)}ms more to hold it — you overshoot and correct. Aim to stop on it in one motion.`
        : `Getting back on target after a jump takes ${rq.medianSettleMs.toFixed(0)}ms. Move to the new spot in one decisive motion, then match its speed.`,
    })
  }
  if (!tips.length) tips.push({ key: 'solid', text: 'No major weakness detected in this run. Increase difficulty or keep building consistency.' })
  return tips
}
