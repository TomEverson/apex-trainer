import { describe, expect, it } from 'vitest'
import { hearingSettingsSchema } from '../validators'
import { levelParams, MAX_LEVEL, MIN_LEVEL } from './difficulty'
import { gaitSound } from './engine'
import { occlusionCues, OCCLUDERS, spatialCues, surroundPosition } from './spatial'
import { distanceFor, OTHER_FLOOR_CHANCE, pickFloor, pickGait, pickSurface } from './trial'

/** Deterministic sequence for rand(). */
const seq = (...xs: number[]) => {
  let i = 0
  return () => xs[i++ % xs.length]
}

describe('pickFloor', () => {
  it('is always the same floor when floors are off', () => {
    expect(pickFloor(false, seq(0))).toEqual({ floor: 'same', occluder: null })
  })
  it('goes above/below through a material below the chance threshold', () => {
    expect(pickFloor(true, seq(OTHER_FLOOR_CHANCE + 0.01))).toEqual({ floor: 'same', occluder: null })
    expect(pickFloor(true, seq(0, 0.2, 0))).toEqual({ floor: 'above', occluder: 'concrete' })
    expect(pickFloor(true, seq(0, 0.8, 0.99))).toEqual({ floor: 'below', occluder: 'metal' })
  })
})

describe('occlusion', () => {
  it('denser floors are darker and quieter', () => {
    const [concrete, wood, metal] = OCCLUDERS.map(occlusionCues)
    expect(concrete.cutoffHz).toBeLessThan(wood.cutoffHz)
    expect(wood.cutoffHz).toBeLessThan(metal.cutoffHz)
    expect(concrete.gainDb).toBeLessThan(metal.gainDb)
  })
})

describe('environment', () => {
  it('outdoors has less reverb than a room at the same distance', () => {
    expect(spatialCues(0, 0.8, false, 'exterior').wet).toBeLessThan(spatialCues(0, 0.8, false, 'interior').wet)
  })
})

describe('surroundPosition', () => {
  it('puts front at −Z and right at +X', () => {
    expect(surroundPosition(0).z).toBeCloseTo(-1)
    expect(surroundPosition(90).x).toBeCloseTo(1)
    expect(surroundPosition(180).z).toBeCloseTo(1)
  })
})

describe('distance buckets', () => {
  it('stay ordered and inside 0–1 at every level, and close in as level rises', () => {
    for (let l = MIN_LEVEL; l <= MAX_LEVEL; l++) {
      const [n, m, f] = levelParams(l).distanceCenters
      expect(n).toBeLessThan(m)
      expect(m).toBeLessThan(f)
      // Jitter is ±0.05, so neighbouring buckets never overlap.
      expect(m - n).toBeGreaterThan(0.1)
      expect(f - m).toBeGreaterThan(0.1)
    }
    const easy = levelParams(MIN_LEVEL).distanceCenters, hard = levelParams(MAX_LEVEL).distanceCenters
    expect(hard[2] - hard[0]).toBeLessThan(easy[2] - easy[0])
  })
  it('distanceFor stays near the bucket centre and clamps', () => {
    const centers: [number, number, number] = [0.02, 0.5, 0.98]
    expect(distanceFor('mid', centers, seq(0.5))).toBeCloseTo(0.5)
    expect(distanceFor('near', centers, seq(0))).toBe(0)
    expect(distanceFor('far', centers, seq(1))).toBe(1)
  })
})

describe('gait / terrain picking', () => {
  it('keeps the chosen gait unless mixing', () => {
    expect(pickGait('crouch', false, seq(0.99))).toBe('crouch')
    expect(pickGait('crouch', true, seq(0.99))).toBe('sprint')
  })
  it('mixed terrain picks any surface; a fixed one is kept', () => {
    expect(pickSurface('wood', seq(0))).toBe('wood')
    expect(pickSurface('mixed', seq(0))).toBe('concrete')
  })
  it('focused mix narrows the jog/sprint gap', () => {
    const gap = (mix: 'focused' | 'original') => gaitSound('sprint', mix).gain - gaitSound('jog', mix).gain
    expect(gap('focused')).toBeLessThan(gap('original'))
  })
})

describe('settings migration', () => {
  it('old stored gaits fall back instead of resetting everything', () => {
    const s = hearingSettingsSchema.parse({ gait: 'run', swapChannels: true })
    expect(s.gait).toBe('sprint')
    expect(s.swapChannels).toBe(true)
    expect(s.render).toBe('stereo')
    expect(s.floors).toBe(true)
  })
})
