/**
 * Spatial cues (SPEC-005), pure. Modelled on what Respawn describes for Apex:
 * frequency and gain change with distance, reverb says interior vs exterior,
 * and a surface between you and the source filters it by material density.
 */
const DEG = Math.PI / 180

export type Cues = { pan: number; gain: number; cutoffHz: number; wet: number }
export type Environment = 'interior' | 'exterior'

/**
 * angle: 0 front, +90 right. distance: 0 near … 1 far.
 * behindCue (stereo only): the further behind (−cos angle), the darker and up
 * to 3 dB quieter — a stand-in for the head/pinna shadow plain panning lacks.
 */
export function spatialCues(angleDeg: number, distance: number, behindCue: boolean, env: Environment = 'interior'): Cues {
  const d = Math.min(1, Math.max(0, distance))
  const behind = behindCue ? Math.max(0, -Math.cos(angleDeg * DEG)) : 0
  return {
    pan: Math.sin(angleDeg * DEG),
    gain: 10 ** ((-20 * d - 3 * behind) / 20),
    cutoffHz: 14000 * 0.1 ** d * (1 - 0.7 * behind),
    // Outdoors there is less reflected sound than in a room.
    wet: (0.04 + 0.45 * d) * (env === 'exterior' ? 0.6 : 1),
  }
}

/** Unit-circle position for a 3D panner (listener faces −Z, +X is right). */
export function surroundPosition(angleDeg: number): { x: number; z: number } {
  return { x: Math.sin(angleDeg * DEG), z: -Math.cos(angleDeg * DEG) }
}

/** What a floor/ceiling between you and the source is made of. Denser = darker and quieter. */
export type Occluder = 'concrete' | 'wood' | 'metal'
export const OCCLUDERS: Occluder[] = ['concrete', 'wood', 'metal']

export type Occlusion = { cutoffHz: number; gainDb: number; boomDb: number }

/** Through-floor filtering: low-pass by density, level drop, and a structure-borne low boom. */
export function occlusionCues(o: Occluder): Occlusion {
  switch (o) {
    case 'concrete': return { cutoffHz: 450, gainDb: -10, boomDb: 6 }
    case 'wood': return { cutoffHz: 900, gainDb: -7, boomDb: 5 }
    case 'metal': return { cutoffHz: 1600, gainDb: -6, boomDb: 4 }
  }
}
