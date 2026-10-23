/**
 * Adaptive difficulty (SPEC-005), pure. Streaks of accurate answers raise the
 * level; a miss lowers it. A locked level never moves.
 */
export const MIN_LEVEL = 1
export const MAX_LEVEL = 10
export const STREAK_TO_LEVEL_UP = 3

export type Difficulty = { level: number; streak: number }

export const initialDifficulty = (level = MIN_LEVEL): Difficulty => ({ level, streak: 0 })

export function nextDifficulty(d: Difficulty, accurate: boolean, locked: boolean): Difficulty {
  if (!accurate) return { level: locked ? d.level : Math.max(MIN_LEVEL, d.level - 1), streak: 0 }
  const streak = d.streak + 1
  if (!locked && streak >= STREAK_TO_LEVEL_UP && d.level < MAX_LEVEL) return { level: d.level + 1, streak: 0 }
  return { level: d.level, streak }
}

const ANGLE_STEP_DEG = [45, 45, 30, 30, 22.5, 15, 15, 10, 10, 5]
const TOLERANCE_DEG = [25, 22, 20, 18, 16, 15, 14, 12, 11, 10]

export type LevelParams = {
  /** Spacing of the angles a source can come from. */
  angleStepDeg: number
  /** Direction answers within this error count as accurate. */
  toleranceDeg: number
  /** Footsteps per sequence (shorter sound = harder). */
  steps: number
  /** Distractor level 0–1 before the user's distractor slider. */
  distractor: number
  /** Distance drill: near/mid/far centres (0–1); they close in as the level rises. */
  distanceCenters: [number, number, number]
  /** Distance drill: random gait per trial, so loudness alone stops working. */
  mixGait: boolean
}

export function levelParams(level: number): LevelParams {
  const l = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(level)))
  const t = (l - MIN_LEVEL) / (MAX_LEVEL - MIN_LEVEL)
  return {
    angleStepDeg: ANGLE_STEP_DEG[l - 1],
    toleranceDeg: TOLERANCE_DEG[l - 1],
    steps: Math.round(6 - 4 * t),
    distractor: 0.05 + 0.45 * t,
    distanceCenters: [0.1 + 0.15 * t, 0.5 - 0.05 * t, 0.9 - 0.25 * t],
    mixGait: l >= 5,
  }
}
