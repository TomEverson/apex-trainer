// Tracking scenarios (SPEC-001). World units are meters; the eye sits at
// EYE looking down +Z. Each scenario drives one target via createMover.
import type { Scenario } from '../../../common/lib/tracking'

export const SCENARIOS: Scenario[] = [
  {
    id: 'strafe-steady',
    name: 'Strafe · Steady',
    focus: 'Speed matching & smoothness',
    description: 'Horizontal strafes with long, predictable intervals. Learn to match target speed without micro-corrections.',
    mode: 'strafe', dist: 12, radius: 0.45, speed: [4, 4], interval: [0.8, 1.6], box: { x: 6, y: [1.2, 1.2], z: 0 },
  },
  {
    id: 'strafe-reactive',
    name: 'Strafe · Reactive',
    focus: 'Reaction to direction changes',
    description: 'Fast, short ADAD strafes. Tests how quickly you react and re-sync after the target changes direction.',
    mode: 'strafe', dist: 12, radius: 0.45, speed: [5, 5.5], interval: [0.2, 0.7], box: { x: 6, y: [1.2, 1.2], z: 0 },
  },
  {
    id: 'sweep-180',
    name: 'Sweep 180',
    focus: 'Constant-speed arm tracking',
    description: 'Starts straight ahead: 90° right, back through centre, 90° left, back — circling you at a constant 60°/s. Pure speed matching over a long arc.',
    // 10.5 m/s on a 10 m radius ≈ 60°/s → 3 s per 180° sweep.
    mode: 'sweep', dist: 10, radius: 0.45, speed: [10.5, 10.5], interval: [1, 1], box: { x: 0, y: [1.4, 1.4], z: 0 }, arcDeg: 180, sweepStartDeg: 0,
  },
  {
    id: 'tile-frenzy',
    name: 'Tile Frenzy',
    focus: 'Fast flicks & clean stops (clicking)',
    description: 'Three targets on a 5×4 grid. Click one and a new one appears in a free tile. Warm-up for quick acquisition — and shows whether your flicks overshoot.',
    // 0.28 m at 12 m ≈ 1.3° radius; tiles 5° apart.
    mode: 'tiles', dist: 12, radius: 0.28, speed: [0, 0], interval: [1, 1], box: { x: 0, y: [1.4, 1.4], z: 0 },
    tiles: { cols: 5, rows: 4, spacingDeg: 5, count: 3 },
  },
  {
    // Replaced the timer-based 'reacquire' on 2026-10-21; old runs keep that id.
    id: 'reacquire-hp',
    name: 'Reacquire',
    focus: 'Switch fast after a kill',
    description: 'Target strafes with a health bar. Stay on it to drain the bar — when it empties the target jumps 5–12°. Land on the new spot and settle fast.',
    mode: 'reacquire', dist: 12, radius: 0.45, speed: [3, 5], interval: [0.6, 1.4], box: { x: 6, y: [0.4, 3.2], z: 0 },
    reacquire: { jumpEvery: [1.2, 2.2], jumpDeg: [5, 12], healthS: 1 },
  },
  {
    id: 'sweep-90',
    name: 'Sweep 90',
    focus: 'Constant-speed tracking through centre',
    description: 'Starts straight ahead: 45° right, back through centre, 45° left, back — at a constant 60°/s.',
    mode: 'sweep', dist: 10, radius: 0.45, speed: [10.5, 10.5], interval: [1, 1], box: { x: 0, y: [1.4, 1.4], z: 0 }, arcDeg: 90, sweepStartDeg: 0,
  },
  {
    id: 'smooth-bot',
    name: 'Smooth Bot',
    focus: 'Smoothness with changing speed',
    description: 'Target curves smoothly in 2D while accelerating and decelerating. Punishes jerky, stop-start tracking.',
    mode: 'smooth', dist: 12, radius: 0.45, speed: [1.5, 6.5], interval: [0.5, 1.3], box: { x: 6, y: [0.2, 3.5], z: 0 },
  },
  {
    id: 'air-strafe',
    name: 'Air Strafe',
    focus: 'Vertical control',
    description: 'Strafing target that jumps with gravity. Trains combined horizontal + vertical tracking.',
    mode: 'jump', dist: 11, radius: 0.45, speed: [4, 4.5], interval: [0.35, 1.0], box: { x: 5.5, y: [0.5, 5], z: 0 },
    jump: { velocity: [5.5, 8], gravity: 14, chance: 0.55 },
  },
  {
    id: 'close-rush',
    name: 'Close Rush',
    focus: 'High angular speed',
    description: 'Close target moving fast across your screen. Requires big, controlled arm movements.',
    mode: 'strafe3d', dist: 5, radius: 0.45, speed: [4, 5.5], interval: [0.3, 0.9], box: { x: 4, y: [0.4, 2.6], z: 1.5 },
  },
  {
    id: 'far-precision',
    name: 'Far Precision',
    focus: 'Fine control on small targets',
    description: 'Small, distant target with reactive strafes. Tests fingertip precision and low-speed stability.',
    mode: 'strafe3d', dist: 25, radius: 0.3, speed: [2.5, 3.5], interval: [0.4, 1.1], box: { x: 7, y: [0.6, 3], z: 2 },
  },
];

export function getScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id)
}

/**
 * Scale a scenario's horizontal target speed. Scaled runs get their own id so
 * history/report never mix speeds into one trend.
 */
export function withSpeed(sc: Scenario, mult: number): Scenario {
  if (mult === 1 || sc.mode === 'tiles') return sc
  const tag = Number(mult.toFixed(2))
  return {
    ...sc,
    id: `${sc.id}@${tag}x`,
    name: `${sc.name} (${tag}×)`,
    speed: [sc.speed[0] * mult, sc.speed[1] * mult],
  }
}

/** Approximate angular speed range in °/s (speed / distance). */
export function angularSpeed(sc: Scenario): [number, number] {
  const toDeg = (v: number) => (v / sc.dist) * (180 / Math.PI)
  return [toDeg(sc.speed[0]), toDeg(sc.speed[1])]
}
