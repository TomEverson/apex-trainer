import type { Scenario } from '../../../common/lib/tracking'

type Vec3 = { x: number; y: number; z: number }
type Axis = keyof Vec3

/** Deterministic RNG so a run can be replayed from its seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const range = (rand: () => number, [lo, hi]: [number, number]) => lo + (hi - lo) * rand()

export type Mover = {
  pos: Vec3
  /** Advance by dt seconds. Returns 0, 1 on a deliberate direction change, or 2 on a teleport jump. */
  step(dt: number): number
  /** Reacquire only: teleport now (health mode jumps on kill). */
  jump?: () => void
}

/**
 * Constant-speed arc around the eye: starts at sweepStartDeg (default the left edge) moving right,
 * reverses only at ±arcDeg/2. Distance never changes, so angular speed is
 * constant too (speed / dist rad/s).
 */
function createSweepMover(sc: Scenario): Mover {
  const half = ((sc.arcDeg ?? 180) / 2) * (Math.PI / 180)
  const omega = sc.speed[0] / sc.dist
  let theta = sc.sweepStartDeg === undefined ? -half : sc.sweepStartDeg * (Math.PI / 180)
  let dir = 1
  const pos: Vec3 = { x: 0, y: sc.box.y[0], z: 0 }
  const place = () => {
    pos.x = sc.dist * Math.sin(theta)
    pos.z = sc.dist * Math.cos(theta)
  }
  place()
  return {
    pos,
    step(dt) {
      theta += dir * omega * dt
      let turned = false
      if (theta <= -half || theta >= half) {
        // Reflect the overshoot so speed stays exactly constant through the turn.
        theta = theta > 0 ? 2 * half - theta : -2 * half - theta
        dir = -dir
        turned = true
      }
      place()
      return turned ? 1 : 0
    },
  }
}

/**
 * Smooth 2D strafing (strafe3d motion on a flat plane) plus a sudden teleport
 * of jumpDeg every jumpEvery seconds — trains getting back on target fast.
 */
function createReacquireMover(sc: Scenario, rand: () => number): Mover {
  const cfg = sc.reacquire ?? { jumpEvery: [1.2, 2.2], jumpDeg: [5, 12] }
  const base = createMover({ ...sc, mode: 'strafe3d', box: { ...sc.box, z: 0 } }, rand)
  const { pos } = base
  let jumpTimer = range(rand, cfg.jumpEvery)
  // Jump jumpDeg (as seen from the eye) in a random direction; if that leaves
  // the box, jump the opposite way instead.
  const jump = () => {
    const dist = range(rand, cfg.jumpDeg) * (Math.PI / 180) * sc.dist
    const a = rand() * Math.PI * 2
    const fits = (s: number) => {
      const x = pos.x + s * Math.cos(a) * dist, y = pos.y + s * Math.sin(a) * dist
      return x >= -sc.box.x && x <= sc.box.x && y >= sc.box.y[0] && y <= sc.box.y[1]
    }
    const sign = fits(1) || !fits(-1) ? 1 : -1
    pos.x = Math.max(-sc.box.x, Math.min(sc.box.x, pos.x + sign * Math.cos(a) * dist))
    pos.y = Math.max(sc.box.y[0], Math.min(sc.box.y[1], pos.y + sign * Math.sin(a) * dist))
  }
  return {
    pos,
    jump,
    step(dt) {
      const turned = base.step(dt)
      // Health mode jumps only when the tracking logic calls jump() on a kill.
      if (cfg.healthS) return turned
      jumpTimer -= dt
      if (jumpTimer > 0) return turned
      jumpTimer = range(rand, cfg.jumpEvery)
      jump()
      return 2
    },
  }
}

export function createMover(sc: Scenario, rand: () => number): Mover {
  if (sc.mode === 'sweep') return createSweepMover(sc)
  if (sc.mode === 'reacquire') return createReacquireMover(sc, rand)
  const { box } = sc
  const yMid = (box.y[0] + box.y[1]) / 2
  const pos: Vec3 = { x: (rand() - 0.5) * box.x, y: sc.mode === 'jump' ? box.y[0] : yMid, z: sc.dist }
  const vel: Vec3 = { x: 0, y: 0, z: 0 }
  const desired: Vec3 = { x: 0, y: 0, z: 0 }
  let timer = 0

  const randomDir2D = (): [number, number] => {
    const a = rand() * Math.PI * 2
    return [Math.cos(a), Math.sin(a)]
  }

  function pickNew() {
    timer = range(rand, sc.interval)
    const speed = range(rand, sc.speed)
    if (sc.mode === 'strafe' || sc.mode === 'jump') {
      // Bias toward reversing for an ADAD feel.
      const sign = vel.x === 0 ? (rand() < 0.5 ? -1 : 1) : rand() < 0.75 ? -Math.sign(vel.x) : Math.sign(vel.x)
      desired.x = sign * speed
      if (sc.jump && pos.y <= box.y[0] + 1e-3 && rand() < sc.jump.chance) {
        vel.y = range(rand, sc.jump.velocity)
      }
    } else if (sc.mode === 'smooth') {
      const [dx, dy] = randomDir2D()
      desired.x = dx * speed
      desired.y = dy * speed * 0.6
    } else {
      const [dx, dy] = randomDir2D()
      desired.x = dx * speed
      desired.y = dy * speed * 0.5
      desired.z = (rand() - 0.5) * speed * 0.6
    }
  }

  function bounce(): boolean {
    let turned = false
    const lim = (axis: Axis, lo: number, hi: number) => {
      if (pos[axis] < lo) {
        pos[axis] = lo
        if (vel[axis] < 0) { vel[axis] = -vel[axis]; desired[axis] = Math.abs(desired[axis]); turned = true }
      }
      if (pos[axis] > hi) {
        pos[axis] = hi
        if (vel[axis] > 0) { vel[axis] = -vel[axis]; desired[axis] = -Math.abs(desired[axis]); turned = true }
      }
    }
    lim('x', -box.x, box.x)
    if (sc.mode === 'smooth' || sc.mode === 'strafe3d') lim('y', box.y[0], box.y[1])
    if (box.z > 0) lim('z', sc.dist - box.z, sc.dist + box.z)
    else {
      // No depth range (e.g. reacquire): stay on the plane. Bouncing a zero-width
      // range would flag a "turn" on every physics step.
      pos.z = sc.dist
      vel.z = 0
      desired.z = 0
    }
    return turned
  }

  pickNew()
  if (sc.mode !== 'smooth') Object.assign(vel, desired)

  return {
    pos,
    step(dt) {
      let turned = false
      timer -= dt
      if (timer <= 0) {
        const prevX = vel.x
        pickNew()
        if (sc.mode === 'smooth') {
          turned = true
        } else {
          vel.x = desired.x
          if (sc.mode !== 'jump') { vel.y = desired.y; vel.z = desired.z }
          turned = Math.sign(prevX) !== Math.sign(vel.x) || sc.mode === 'strafe3d'
        }
      }
      if (sc.mode === 'smooth') {
        // Ease velocity toward the desired vector for curved, accelerating motion.
        const k = 1 - Math.exp(-dt * 3)
        vel.x += (desired.x - vel.x) * k
        vel.y += (desired.y - vel.y) * k
      }
      if (sc.jump) vel.y -= sc.jump.gravity * dt
      pos.x += vel.x * dt
      pos.y += vel.y * dt
      pos.z += vel.z * dt
      if (sc.jump && pos.y < box.y[0]) { pos.y = box.y[0]; vel.y = 0 }
      if (bounce()) turned = true
      return turned ? 1 : 0
    },
  }
}
