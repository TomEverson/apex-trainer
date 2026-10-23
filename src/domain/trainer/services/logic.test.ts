import { describe, expect, it } from 'vitest'
import { expandPattern } from '../../../common/lib/recoil'
import { createRunLogic } from './logic'
import { buildDrill, getWeapon, WEAPONS, zoomedFov } from './weapons'

const PREFS = { rangeM: 20, target: 'static' as const, magTier: 2, barrelTier: 0, sprays: 2, adsScale: 1, zoom: 1 }

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
    expect(shots.t[4] - shots.t[3]).toBeCloseTo(0.3, 6)
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
