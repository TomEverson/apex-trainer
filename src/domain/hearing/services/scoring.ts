/**
 * Scoring (SPEC-005), pure. Angles in degrees: 0 = front, +90 = right,
 * −90 = left, ±180 = behind.
 */

/** Signed shortest rotation from `from` to `to`, in (−180, 180]. */
export function angleDiff(from: number, to: number): number {
  const d = ((((to - from) % 360) + 540) % 360) - 180
  return d === -180 ? 180 : d
}

/** Absolute angular error, 0–180. */
export function angularError(truth: number, answer: number): number {
  return Math.abs(angleDiff(truth, answer))
}

export type Region = 'front' | 'right' | 'back' | 'left'

/** Quadrant for the confusion breakdown; boundaries at ±45° and ±135° go to front/back. */
export function region(angle: number): Region {
  const a = angleDiff(0, angle)
  if (Math.abs(a) <= 45) return 'front'
  if (Math.abs(a) >= 135) return 'back'
  return a > 0 ? 'right' : 'left'
}

export const DISTANCE_BUCKETS = ['near', 'mid', 'far'] as const
export type DistanceBucket = (typeof DISTANCE_BUCKETS)[number]

export function bucketCorrect(truth: DistanceBucket, answer: DistanceBucket): boolean {
  return truth === answer
}

export type TrackingSample = { truth: number; cursor: number; dt: number }

/** Time-weighted mean angular error over a moving-target run; 0 when there is no time. */
export function trackingError(samples: TrackingSample[]): number {
  let sum = 0, time = 0
  for (const s of samples) {
    if (s.dt <= 0) continue
    sum += angularError(s.truth, s.cursor) * s.dt
    time += s.dt
  }
  return time > 0 ? sum / time : 0
}
