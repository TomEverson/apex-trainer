import { describe, expect, it } from 'vitest'
import { strafeTimeline, type RecoilShots, type Weapon } from '../../../common/lib/recoil'
import { computeStrafeSummary } from './recoil'

/** 600 rpm gun, strafe right 450 ms then left: one switch between bullets 5 and 6. */
const GUN: Weapon = {
  id: 'test', name: 'Test', class: 'ar', ammo: 'light', carePackage: false, rpm: 600,
  mags: [10, 10, 10, 10], barrel: false, jitterDeg: 0, source: 'test', confidence: 'measured',
  pattern: [[0, 0, 0], [9, 0, 1]],
  strafe: { phases: [['right', 450], ['left', 500]], source: 'test' },
}
const TIMELINE = strafeTimeline(GUN, 10)

/** One spray pressed at t=1: D from the press, then A at 1 + switchAt. */
function log(switchAt: number | null): NonNullable<RecoilShots['strafe']> {
  const t = [1], dir = [1]
  if (switchAt !== null) { t.push(1 + switchAt); dir.push(-1) }
  return { pressT: [1], endT: [1 + 0.95], t, spray: t.map(() => 0), dir }
}

describe('strafeTimeline', () => {
  it('lays phases out from the press and finds the bullets in each', () => {
    expect(TIMELINE.map((s) => s.dir)).toEqual([1, -1])
    expect(TIMELINE[1].start).toBeCloseTo(0.45)
    expect(TIMELINE[1].from).toBe(6)
  })
  it('keeps a wait phase, cuts phases off at a short mag and stretches the last over a long one', () => {
    const wait = strafeTimeline({ ...GUN, windupS: 0.35, strafe: { phases: [['none', 350], ['right', 450], ['left', 500]], source: 'test' } }, 10)
    expect(wait[0]).toMatchObject({ dir: 0, start: 0, from: 0, to: 0 })
    expect(wait[1].from).toBe(1)
    expect(strafeTimeline(GUN, 4)).toHaveLength(1)
    expect(strafeTimeline(GUN, 14).at(-1)?.to).toBe(14)
  })
})

describe('computeStrafeSummary', () => {
  it('scores a perfect follow', () => {
    const s = computeStrafeSummary(log(0.45), TIMELINE)
    expect(s.timing).toBeGreaterThan(0.98)
    expect(s.switches).toBe(1)
    expect(s.medianLagMs).toBeCloseTo(0)
  })
  it('measures a late switch', () => {
    const s = computeStrafeSummary(log(0.6), TIMELINE)
    expect(s.medianLagMs).toBeCloseTo(150)
    expect(s.wrongDir).toBeGreaterThan(0.1)
  })
  it('counts a switch that never comes as missed', () => {
    const s = computeStrafeSummary(log(null), TIMELINE)
    expect(s.missed).toBe(1)
    expect(s.timing).toBeLessThan(0.6)
  })
})
