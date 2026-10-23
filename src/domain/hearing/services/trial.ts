/** Per-trial random choices shared by the drills (SPEC-005), pure. */
import type { Gait, SurfaceChoice, Surface } from '../types'
import { gaitSchema, surfaceSchema } from '../validators'
import { OCCLUDERS, type Environment, type Occluder } from './spatial'
import type { DistanceBucket } from './scoring'

const pickOf = <T>(xs: readonly T[], rand: () => number): T => xs[Math.floor(rand() * xs.length)]

export function pickSurface(choice: SurfaceChoice, rand: () => number): Surface {
  return choice === 'mixed' ? pickOf(surfaceSchema.options, rand) : choice
}

/** At higher levels the gait is random, so loudness alone stops telling distance. */
export function pickGait(chosen: Gait, mixGait: boolean, rand: () => number): Gait {
  return mixGait ? pickOf(gaitSchema.options, rand) : chosen
}

export function pickEnvironment(rand: () => number): Environment {
  return rand() < 0.5 ? 'interior' : 'exterior'
}

export type Floor = 'same' | 'above' | 'below'
export const OTHER_FLOOR_CHANCE = 0.35

/** Same floor, or above/below through a random floor material. */
export function pickFloor(enabled: boolean, rand: () => number): { floor: Floor; occluder: Occluder | null } {
  if (!enabled || rand() >= OTHER_FLOOR_CHANCE) return { floor: 'same', occluder: null }
  return { floor: rand() < 0.5 ? 'above' : 'below', occluder: pickOf(OCCLUDERS, rand) }
}

/** Distance 0–1 inside a bucket: the bucket's centre for this level, ± a little jitter. */
export function distanceFor(bucket: DistanceBucket, centers: [number, number, number], rand: () => number): number {
  const c = centers[bucket === 'near' ? 0 : bucket === 'mid' ? 1 : 2]
  return Math.min(1, Math.max(0, c + (rand() * 2 - 1) * 0.05))
}
