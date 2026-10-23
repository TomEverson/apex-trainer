import { describe, expect, it } from 'vitest'
import { initialDifficulty, levelParams, MAX_LEVEL, MIN_LEVEL, nextDifficulty, STREAK_TO_LEVEL_UP, type Difficulty } from './difficulty'
import { candidateAngles, pickAngle } from './direction'

const run = (d: Difficulty, answers: boolean[], locked = false) => answers.reduce((s, a) => nextDifficulty(s, a, locked), d)

describe('nextDifficulty', () => {
  it('starts easy', () => {
    expect(initialDifficulty()).toEqual({ level: MIN_LEVEL, streak: 0 })
  })
  it('levels up after a streak of accurate answers', () => {
    const d = run(initialDifficulty(), Array(STREAK_TO_LEVEL_UP).fill(true))
    expect(d).toEqual({ level: 2, streak: 0 })
  })
  it('does not level up before the streak completes', () => {
    expect(run(initialDifficulty(), [true, true])).toEqual({ level: 1, streak: 2 })
  })
  it('eases off after a miss and resets the streak', () => {
    expect(run(initialDifficulty(5), [true, true, false])).toEqual({ level: 4, streak: 0 })
  })
  it('clamps at both ends', () => {
    expect(run(initialDifficulty(MIN_LEVEL), [false, false])).toEqual({ level: MIN_LEVEL, streak: 0 })
    expect(run(initialDifficulty(MAX_LEVEL), [true, true, true]).level).toBe(MAX_LEVEL)
  })
  it('never moves when locked', () => {
    expect(run(initialDifficulty(4), [true, true, true, true], true).level).toBe(4)
    expect(run(initialDifficulty(4), [false], true).level).toBe(4)
  })
  it('climbs across a good session', () => {
    expect(run(initialDifficulty(), Array(12).fill(true)).level).toBe(5)
  })
})

describe('levelParams', () => {
  it('gets harder with level', () => {
    const easy = levelParams(MIN_LEVEL), hard = levelParams(MAX_LEVEL)
    expect(hard.angleStepDeg).toBeLessThan(easy.angleStepDeg)
    expect(hard.toleranceDeg).toBeLessThan(easy.toleranceDeg)
    expect(hard.steps).toBeLessThan(easy.steps)
    expect(hard.distractor).toBeGreaterThan(easy.distractor)
  })
  it('is monotonic across levels', () => {
    for (let l = MIN_LEVEL; l < MAX_LEVEL; l++) {
      const a = levelParams(l), b = levelParams(l + 1)
      expect(b.angleStepDeg).toBeLessThanOrEqual(a.angleStepDeg)
      expect(b.toleranceDeg).toBeLessThanOrEqual(a.toleranceDeg)
      expect(b.steps).toBeLessThanOrEqual(a.steps)
      expect(b.distractor).toBeGreaterThan(a.distractor)
    }
  })
})

describe('direction angles', () => {
  it('front half covers -90..90 on the grid', () => {
    expect(candidateAngles(45, true).sort((a, b) => a - b)).toEqual([-90, -45, 0, 45, 90])
  })
  it('full circle has no duplicate at ±180', () => {
    expect(candidateAngles(90, false).sort((a, b) => a - b)).toEqual([-90, 0, 90, 180])
  })
  it('never repeats the previous angle', () => {
    for (let i = 0; i < 50; i++) expect(pickAngle(45, true, 0, Math.random)).not.toBe(0)
  })
})
