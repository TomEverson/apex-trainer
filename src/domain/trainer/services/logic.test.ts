import { describe, expect, it } from 'vitest'
import { ADS_STRAFE_SPEED, STRAFE_ACCEL, STRAFE_COAST_DECEL, expandPattern, strafeTimeline } from '../../../common/lib/recoil'
import { createRunLogic } from './logic'
import { buildDrill, getWeapon, WEAPONS, zoomedFov } from './weapons'

const PREFS = { rangeM: 20, target: 'static' as const, magTier: 2, barrelTier: 0, sprays: 2, adsScale: 1, zoom: 1, mode: 'pure' as const, strafeAudio: true }

/** Hold the trigger for whole sprays without touching the mouse, at 240 fps. */
function sprayUntouched(weaponId: string, jitter = 0, rangeM = PREFS.rangeM) {
  const base = getWeapon(weaponId)
  if (!base) throw new Error(weaponId)
  const drill = buildDrill({ ...base, jitterDeg: jitter }, { ...PREFS, rangeM })
  const logic = createRunLogic({ kind: 'recoil', drill }, 1, 60)
  const cam = { ...logic.start }
  const dt = 1 / 240
  let t = 0
  for (let s = 0; s < drill.sprays; s++) {
    logic.trigger(true, t)
    for (let k = 0; k < 2400 && !logic.done(t); k++) {
      t += dt
      logic.frame(t, dt, cam)
      if (logic.progress(t) === 'reload') break
    }
    while (logic.progress(t) === 'reload') { t += dt; logic.frame(t, dt, cam) }
    // Mouse never moved, but recoil did: put the crosshair back like a reset.
    Object.assign(cam, logic.start)
  }
  const data = logic.data()
  if (data.kind !== 'recoil') throw new Error('expected recoil data')
  return { drill, shots: data.shots }
}

describe('recoil logic', () => {
  it('traces the exact pattern when the mouse is still', () => {
    const { drill, shots } = sprayUntouched('r-301')
    const pattern = expandPattern(drill.weapon.pattern, drill.magSize)
    expect(shots.t.length).toBe(drill.magSize * drill.sprays)
    for (let i = 0; i < drill.magSize; i++) {
      expect(shots.cYaw[i] - shots.tYaw[0]).toBeCloseTo(pattern[i][0], 6)
      expect(shots.cPitch[i] - shots.tPitch[0]).toBeCloseTo(pattern[i][1], 6)
      expect(shots.oPitch[i]).toBeCloseTo(pattern[i][1], 6)
    }
  })
  it('fires at the weapon rate', () => {
    const { shots } = sprayUntouched('flatline')
    expect(shots.t[1] - shots.t[0]).toBeCloseTo(60 / 600, 6)
  })
  it('pauses between bursts', () => {
    const { shots } = sprayUntouched('nemesis')
    expect(shots.t[4] - shots.t[3]).toBeCloseTo(getWeapon('nemesis')?.burst?.delayS ?? NaN, 6)
    expect(shots.t[3] - shots.t[2]).toBeCloseTo(60 / 1100, 6)
  })
  it('scales the pattern with the barrel', () => {
    const w = WEAPONS.find((x) => x.barrel)
    if (!w) throw new Error('no barrel weapon')
    expect(buildDrill(w, { ...PREFS, barrelTier: 3 }).kickScale).toBeLessThan(1)
    expect(buildDrill({ ...w, barrel: false }, { ...PREFS, barrelTier: 3 }).kickScale).toBe(1)
  })
})

describe('pill target', () => {
  it('first bullet hits at 200 m, the climb walks off it', () => {
    const { shots } = sprayUntouched('r-99', 0, 200)
    expect(shots.hit[0]).toBe(1)
    expect(shots.hit.at(-1)).toBe(0)
  })
})

describe('zoomedFov', () => {
  it('is unchanged at 1x and narrows the tangent by the zoom', () => {
    expect(zoomedFov(103, 1)).toBeCloseTo(103)
    expect(Math.tan((zoomedFov(90, 2) / 2) * (Math.PI / 180))).toBeCloseTo(0.5)
  })
})

describe('weapon patterns', () => {
  it('start at the first bullet and cover nearly every magazine', () => {
    for (const w of WEAPONS) {
      expect(w.pattern[0]).toEqual([0, 0, 0])
      // Past the last keypoint the final step is extrapolated; never more than 3 bullets of it.
      if (w.confidence === 'measured') expect(Math.max(...w.mags) - w.pattern.length, w.id).toBeLessThanOrEqual(3)
    }
  })
  it('are in degrees (the R-301 capture climbs ~6.5° over 31 bullets)', () => {
    const r301 = getWeapon('r-301')
    expect(r301?.pattern.at(-1)?.[2]).toBeCloseTo(6.479, 3)
  })
})

describe('recoil strafe logging', () => {
  it('logs A/D changes during sprays only, starting at the press', () => {
    const base = getWeapon('r-301')
    if (!base) throw new Error('r-301')
    const drill = buildDrill(base, { ...PREFS, mode: 'strafe' })
    expect(drill.mode).toBe('strafe')
    const logic = createRunLogic({ kind: 'recoil', drill }, 1, 60)
    const cam = { ...logic.start }
    logic.key('KeyD', true, 0.1) // before firing: not logged, but held
    logic.trigger(true, 0.2)
    logic.frame(0.25, 0.05, cam)
    logic.key('KeyD', false, 0.9)
    logic.key('KeyA', true, 0.9)
    logic.key('KeyW', true, 1) // not a strafe key
    logic.trigger(false, 1.2)
    const data = logic.data()
    if (data.kind !== 'recoil') throw new Error('expected recoil data')
    expect(data.shots.strafe).toEqual({ pressT: [0.2], endT: [1.2], t: [0.2, 0.9, 0.9], spray: [0, 0, 0], dir: [1, 0, -1] })
  })
  it('every weapon has a strafe pattern', () => {
    for (const w of WEAPONS) expect(w.strafe, w.id).toBeDefined()
  })
})

describe('recoil strafe movement', () => {
  it('moves the player at AR ADS speed with A/D, so the target slides the other way', () => {
    const base = getWeapon('r-301')
    if (!base) throw new Error('r-301')
    const drill = buildDrill(base, { ...PREFS, mode: 'strafe' })
    const logic = createRunLogic({ kind: 'recoil', drill }, 1, 60)
    const cam = { ...logic.start }
    logic.key('KeyD', true, 0)
    for (let t = 1 / 240; t <= 1; t += 1 / 240) logic.frame(t, 1 / 240, cam)
    // 2.20 m/s at the measured AR acceleration: the ramp costs v²/2a of distance.
    const v = ADS_STRAFE_SPEED.ar
    expect(cam.x).toBeCloseTo(v - (v * v) / (2 * STRAFE_ACCEL.ar), 2)
    logic.trigger(true, 1)
    logic.frame(1 + 1 / 240, 1 / 240, cam)
    const data = logic.data()
    if (data.kind !== 'recoil') throw new Error('expected recoil data')
    // Standing ~2.1 m right of a target 20 m out puts it ~6° left of straight ahead.
    expect(data.shots.tYaw[0]).toBeLessThan(logic.start.yaw - 5)
  })
  it('leaves Recoil Pure standing still', () => {
    const base = getWeapon('r-301')
    if (!base) throw new Error('r-301')
    const logic = createRunLogic({ kind: 'recoil', drill: buildDrill(base, PREFS) }, 1, 60)
    const cam = { ...logic.start }
    logic.key('KeyD', true, 0)
    for (let t = 1 / 240; t <= 0.5; t += 1 / 240) logic.frame(t, 1 / 240, cam)
    expect(cam.x ?? 0).toBe(0)
  })
})

describe('recoil strafe cancels horizontal recoil', () => {
  /** Spray a full R-301 mag with the mouse still, holding the pattern's key (or none), at 240 fps. */
  function spray(follow: boolean) {
    const base = getWeapon('r-301')
    if (!base) throw new Error('r-301')
    const drill = buildDrill({ ...base, jitterDeg: 0 }, { ...PREFS, mode: 'strafe' })
    const timeline = strafeTimeline(drill.weapon, drill.magSize)
    const logic = createRunLogic({ kind: 'recoil', drill }, 1, 60)
    const cam = { ...logic.start }
    let held = 0
    logic.trigger(true, 0)
    for (let t = 1 / 240; t < 3; t += 1 / 240) {
      const want = follow ? (timeline.find((seg) => t < seg.end)?.dir ?? 0) : 0
      if (want !== held) {
        if (held) logic.key(held < 0 ? 'KeyA' : 'KeyD', false, t)
        if (want) logic.key(want < 0 ? 'KeyA' : 'KeyD', true, t)
        held = want
      }
      logic.frame(t, 1 / 240, cam)
      if (logic.progress(t) === 'reload') break
    }
    const data = logic.data()
    if (data.kind !== 'recoil') throw new Error('expected recoil data')
    // The camera's own yaw: what the recoil did (the target slides with the movement).
    return data.shots.cYaw.map((y) => y - data.shots.cYaw[0])
  }
  it('keeps the spray straight when the strafe follows the pattern', () => {
    const side = spray(true)
    // A switch can land a frame after a bullet, so allow one bullet's step of drift.
    expect(Math.max(...side.map(Math.abs))).toBeLessThan(0.35)
  })
  it('leaves the full sideways drift without strafing', () => {
    const side = spray(false)
    expect(Math.max(...side.map(Math.abs))).toBeGreaterThan(1.3)
  })
})

describe('measured strafe physics', () => {
  function moveFor(weaponId: string, steps: [string, boolean, number][], untilS: number) {
    const base = getWeapon(weaponId)
    if (!base) throw new Error(weaponId)
    const logic = createRunLogic({ kind: 'recoil', drill: buildDrill(base, { ...PREFS, mode: 'strafe' }) }, 1, 60)
    const cam = { ...logic.start }
    const xs: number[] = []
    for (let t = 1 / 480; t <= untilS; t += 1 / 480) {
      for (const [code, down, at] of steps) if (Math.abs(t - at) < 1 / 960) logic.key(code, down, t)
      logic.frame(t, 1 / 480, cam)
      xs.push(cam.x ?? 0)
    }
    return xs
  }
  it('reaches full ADS speed from standing in 0.04 s for every class', () => {
    const xs = moveFor('r-99', [['KeyD', true, 0.01]], 0.2)
    const speed = (xs[xs.length - 1] - xs[xs.length - 2]) * 480
    expect(speed).toBeCloseTo(130.12 * 0.0254, 2)
    for (const c of ['ar', 'smg', 'lmg'] as const) expect(ADS_STRAFE_SPEED[c] / STRAFE_ACCEL[c]).toBeCloseTo(0.04, 6)
  })
  it('coasts to a stop slower than it reverses', () => {
    const v = ADS_STRAFE_SPEED.smg
    expect(v / STRAFE_COAST_DECEL).toBeGreaterThan((2 * v) / STRAFE_ACCEL.smg)
    const xs = moveFor('r-99', [['KeyD', true, 0.01], ['KeyD', false, 0.3]], 0.5)
    // Stopped ~0.10 s after release, then no more movement.
    expect(xs[xs.length - 1] - xs[Math.round(0.45 * 480)]).toBeCloseTo(0, 6)
  })
})
