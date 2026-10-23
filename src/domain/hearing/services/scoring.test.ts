import { describe, expect, it } from 'vitest'
import { angleDiff, angularError, bucketCorrect, region, trackingError } from './scoring'
import { spatialCues } from './spatial'

describe('angularError', () => {
  it('is the absolute difference for nearby angles', () => {
    expect(angularError(30, 45)).toBe(15)
    expect(angularError(45, 30)).toBe(15)
    expect(angularError(-20, 20)).toBe(40)
  })
  it('wraps around behind the listener', () => {
    expect(angularError(170, -170)).toBe(20)
    expect(angularError(-179, 179)).toBe(2)
    expect(angularError(0, 360)).toBe(0)
  })
  it('never exceeds 180', () => {
    expect(angularError(0, 180)).toBe(180)
    expect(angularError(90, -90)).toBe(180)
  })
  it('signed diff is in (-180, 180]', () => {
    expect(angleDiff(0, 180)).toBe(180)
    expect(angleDiff(0, -180)).toBe(180)
    expect(angleDiff(10, -10)).toBe(-20)
  })
})

describe('region', () => {
  it('classifies quadrants', () => {
    expect(region(0)).toBe('front')
    expect(region(45)).toBe('front')
    expect(region(90)).toBe('right')
    expect(region(-90)).toBe('left')
    expect(region(135)).toBe('back')
    expect(region(-180)).toBe('back')
  })
})

describe('bucketCorrect', () => {
  it('is true only for the same bucket', () => {
    expect(bucketCorrect('near', 'near')).toBe(true)
    expect(bucketCorrect('near', 'mid')).toBe(false)
    expect(bucketCorrect('far', 'mid')).toBe(false)
  })
})

describe('trackingError', () => {
  it('is the time-weighted mean error', () => {
    expect(trackingError([
      { truth: 0, cursor: 10, dt: 1 },
      { truth: 0, cursor: 40, dt: 3 },
    ])).toBe(32.5)
  })
  it('wraps angles and skips zero-length samples', () => {
    expect(trackingError([
      { truth: 175, cursor: -175, dt: 0.5 },
      { truth: 0, cursor: 90, dt: 0 },
    ])).toBe(10)
  })
  it('is 0 with no time', () => {
    expect(trackingError([])).toBe(0)
  })
})

describe('spatialCues', () => {
  it('pans by direction and darkens progressively behind', () => {
    expect(spatialCues(90, 0, true).pan).toBeCloseTo(1)
    expect(spatialCues(-90, 0, true).pan).toBeCloseTo(-1)
    const front = spatialCues(45, 0, true), side = spatialCues(135, 0, true), back = spatialCues(180, 0, true)
    expect(side.pan).toBeCloseTo(front.pan) // stereo can't separate these by pan…
    expect(side.cutoffHz).toBeLessThan(front.cutoffHz) // …only by the behind cue
    expect(back.cutoffHz).toBeLessThan(side.cutoffHz)
    expect(back.gain).toBeLessThan(front.gain)
    expect(spatialCues(180, 0, false).cutoffHz).toBe(spatialCues(0, 0, false).cutoffHz)
  })
})
