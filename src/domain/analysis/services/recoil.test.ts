import { describe, expect, it } from 'vitest'
import { emptyRecoilShots, type RecoilShots } from '../../../common/lib/recoil'
import { computeRecoilSummary, diagnoseRecoil } from './recoil'

/** Synthetic sprays: the pattern climbs 0.2°/bullet and drifts 0.05° right; `pull` is how much of it the player cancels. */
function sprays(pull: number, count = 6, len = 20): RecoilShots {
  const S = emptyRecoilShots()
  for (let s = 0; s < count; s++) {
    for (let i = 0; i < len; i++) {
      const oYaw = 0.05 * i, oPitch = 0.2 * i
      S.t.push(s * 3 + i * 0.1)
      S.spray.push(s)
      S.idx.push(i)
      S.tYaw.push(0)
      S.tPitch.push(0)
      S.cYaw.push(oYaw * (1 - pull))
      S.cPitch.push(oPitch * (1 - pull))
      S.oYaw.push(oYaw)
      S.oPitch.push(oPitch)
      S.hit.push(Math.abs(oPitch * (1 - pull)) < 0.7 ? 1 : 0)
    }
  }
  return S
}

describe('computeRecoilSummary', () => {
  it('reads 0 compensation when the mouse never moves', () => {
    const s = computeRecoilSummary(sprays(0))
    expect(s.vertComp).toBeCloseTo(0)
    expect(s.horizComp).toBeCloseTo(0)
    expect(s.phases.late.vertBiasDeg).toBeGreaterThan(s.phases.early.vertBiasDeg ?? 0)
  })
  it('reads 1 for a perfect pull and 2 for double', () => {
    expect(computeRecoilSummary(sprays(1)).vertComp).toBeCloseTo(1)
    expect(computeRecoilSummary(sprays(2)).vertComp).toBeCloseTo(2)
  })
  it('ignores the first bullet aim offset when judging compensation', () => {
    const S = sprays(1)
    S.cPitch = S.cPitch.map((p) => p + 0.5)
    const s = computeRecoilSummary(S)
    expect(s.vertComp).toBeCloseTo(1)
    expect(s.firstShotErrDeg).toBeCloseTo(0.5)
  })
  it('builds the average spray per bullet index', () => {
    const s = computeRecoilSummary(sprays(0, 4, 10))
    expect(s.sprays).toBe(4)
    expect(s.avgSpray.n).toEqual(Array(10).fill(4))
    expect(s.avgSpray.vert[9]).toBeCloseTo(1.8)
    expect(s.consistencyDeg).toBeCloseTo(0)
  })
})

describe('diagnoseRecoil', () => {
  it('flags under- and over-pulling', () => {
    expect(diagnoseRecoil(computeRecoilSummary(sprays(0.3))).map((t) => t.key)).toContain('under-pull')
    expect(diagnoseRecoil(computeRecoilSummary(sprays(1.6))).map((t) => t.key)).toContain('over-pull')
  })
  it('says solid for a perfect run', () => {
    expect(diagnoseRecoil(computeRecoilSummary(sprays(1))).map((t) => t.key)).toEqual(['solid'])
  })
})
