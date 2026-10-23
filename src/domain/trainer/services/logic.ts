/**
 * Per-mode run behaviour (SPEC-003, SPEC-006). TrainerView is the shell (lock,
 * countdown, keys, HUD, loop); a RunLogic owns targets, sampling and drawing
 * for one run.
 */
import { emptySamples, type Samples, type Scenario, type Shots } from '../../../common/lib/tracking'
import { PILL, emptyRecoilShots, expandPattern, type RecoilDrill, type RecoilShots } from '../../../common/lib/recoil'
import { EYE, Renderer, dirTo, isOnTarget, type Camera } from './engine'
import { createMover, mulberry32 } from './mover'

const PHYSICS_STEP = 1 / 480
const DEG = Math.PI / 180

/** What a run plays: a Pure Aim scenario or a Recoil Control drill. */
export type Drill = { kind: 'scenario'; scenario: Scenario } | { kind: 'recoil'; drill: RecoilDrill }

export type RunData =
  | { kind: 'tracking'; samples: Samples }
  | { kind: 'clicking'; shots: Shots }
  | { kind: 'recoil'; shots: RecoilShots }

export type RunLogic = {
  /** Where the camera points when the run starts. */
  start: Camera
  /** Advance one live frame (elapsed seconds since GO). */
  frame(elapsed: number, dt: number, cam: Camera): void
  /** Left click while live. */
  click(elapsed: number, cam: Camera): void
  /** Left button pressed / released while live (held-trigger weapons). */
  trigger(down: boolean, elapsed: number): void
  draw(r: Renderer, cam: Camera, live: boolean): void
  hud(): string
  /** HUD progress value: seconds left, or spray n of N. */
  progress(elapsed: number): string
  done(elapsed: number): boolean
  data(): RunData
}

/** HUD labels and the overlay name, known before the run starts. */
export function drillLabels(d: Drill) {
  if (d.kind === 'recoil') return { name: d.drill.name, score: 'hits', progress: 'spray' }
  return { name: d.scenario.name, score: d.scenario.mode === 'tiles' ? 'kills' : 'on target', progress: 'time' }
}

export function createRunLogic(d: Drill, seed: number, durationS: number): RunLogic {
  if (d.kind === 'recoil') return createRecoilLogic(d.drill, seed)
  const logic = d.scenario.mode === 'tiles' ? createTileLogic(d.scenario, seed) : createTrackingLogic(d.scenario, seed)
  return {
    ...logic,
    trigger() {},
    progress: (elapsed) => Math.max(0, durationS - elapsed).toFixed(1),
    done: (elapsed) => elapsed >= durationS,
  }
}

type TimedLogic = Omit<RunLogic, 'trigger' | 'progress' | 'done'>

const angRadius = (radius: number, dist: number) => Math.asin(Math.min(1, radius / dist)) / DEG

function createTrackingLogic(sc: Scenario, seed: number): TimedLogic {
  const mover = createMover(sc, mulberry32(seed))
  const samples = emptySamples()
  const start = dirTo(mover.pos)
  let physicsAcc = 0, pendingTurn = 0, onTime = 0, liveTime = 0, on = false
  // Reacquire health mode: the bar drains while on target; empty = jump + refill.
  const healthS = sc.reacquire?.healthS
  let health = 1
  // Sweep: ghost markers where the target reverses, so the turn can be anticipated.
  const half = ((sc.arcDeg ?? 180) / 2) * DEG
  const turnPoints = sc.mode === 'sweep'
    ? [-half, half].map((a) => ({ x: EYE.x + sc.dist * Math.sin(a), y: sc.box.y[0], z: EYE.z + sc.dist * Math.cos(a) }))
    : []

  return {
    start: { yaw: start.yaw, pitch: start.pitch },
    frame(elapsed, dt, cam) {
      // Fixed-step physics keeps motion identical regardless of frame rate.
      physicsAcc += dt
      while (physicsAcc >= PHYSICS_STEP) {
        pendingTurn = Math.max(pendingTurn, mover.step(PHYSICS_STEP))
        physicsAcc -= PHYSICS_STEP
      }
      on = isOnTarget(cam, mover.pos, sc.radius)
      const d = dirTo(mover.pos)
      samples.t.push(elapsed)
      samples.tYaw.push(d.yaw)
      samples.tPitch.push(d.pitch)
      samples.cYaw.push(cam.yaw)
      samples.cPitch.push(cam.pitch)
      samples.angR.push(angRadius(sc.radius, d.dist))
      samples.on.push(on ? 1 : 0)
      samples.turn.push(pendingTurn)
      pendingTurn = 0
      if (samples.t.length > 1) {
        liveTime += dt
        if (on) onTime += dt
      }
      if (healthS && mover.jump && on) {
        health -= dt / healthS
        if (health <= 0) {
          mover.jump()
          health = 1
          pendingTurn = 2 // the next sample is the first one at the new spot
        }
      }
    },
    click() {},
    draw(r, cam, live) {
      for (const p of turnPoints) r.drawTurnMarker(cam, p, sc.radius)
      r.drawTarget(cam, mover.pos, sc.radius, live && on)
      if (healthS) r.drawHealthBar(cam, mover.pos, sc.radius, health)
    },
    hud: () => `${liveTime ? ((onTime / liveTime) * 100).toFixed(1) : '0.0'}%`,
    data: () => ({ kind: 'tracking', samples }),
  }
}

/** Tile Frenzy: static grid targets, click to destroy, respawn in a free tile. */
function createTileLogic(sc: Scenario, seed: number): TimedLogic {
  const rand = mulberry32(seed)
  const grid = sc.tiles ?? { cols: 5, rows: 4, spacingDeg: 5, count: 3 }
  // Tile directions centred straight ahead, all at distance `dist` from the eye.
  const tiles = Array.from({ length: grid.cols * grid.rows }, (_, i) => {
    const yaw = ((i % grid.cols) - (grid.cols - 1) / 2) * grid.spacingDeg
    const pitch = ((grid.rows - 1) / 2 - Math.floor(i / grid.cols)) * grid.spacingDeg
    return {
      yaw,
      pitch,
      pos: {
        x: EYE.x + sc.dist * Math.cos(pitch * DEG) * Math.sin(yaw * DEG),
        y: EYE.y + sc.dist * Math.sin(pitch * DEG),
        z: EYE.z + sc.dist * Math.cos(pitch * DEG) * Math.cos(yaw * DEG),
      },
    }
  })
  const angR = angRadius(sc.radius, sc.dist)
  const live: number[] = []
  const spawn = (exclude: number) => {
    const free = tiles.map((_, i) => i).filter((i) => i !== exclude && !live.includes(i))
    live.push(free[Math.floor(rand() * free.length)])
  }
  for (let k = 0; k < Math.min(grid.count, tiles.length - 1); k++) spawn(-1)

  // The run starts aimed at the grid centre (0, 0); that's the first flick's origin.
  const shots: Shots = { startYaw: 0, startPitch: 0, t: [], hit: [], cYaw: [], cPitch: [], tYaw: [], tPitch: [], angR: [] }
  let kills = 0

  return {
    start: { yaw: 0, pitch: 0 },
    frame() {},
    click(elapsed, cam) {
      // Hit = the live target under the crosshair; miss = record the nearest one.
      let best = live[0], bestAng = Infinity
      for (const i of live) {
        const ang = Math.hypot((tiles[i].yaw - cam.yaw) * Math.cos(cam.pitch * DEG), tiles[i].pitch - cam.pitch)
        if (ang < bestAng) { bestAng = ang; best = i }
      }
      const hitIdx = live.find((i) => isOnTarget(cam, tiles[i].pos, sc.radius))
      const target = tiles[hitIdx ?? best]
      shots.t.push(elapsed)
      shots.hit.push(hitIdx === undefined ? 0 : 1)
      shots.cYaw.push(cam.yaw)
      shots.cPitch.push(cam.pitch)
      shots.tYaw.push(target.yaw)
      shots.tPitch.push(target.pitch)
      shots.angR.push(angR)
      if (hitIdx !== undefined) {
        kills++
        live.splice(live.indexOf(hitIdx), 1)
        spawn(hitIdx)
      }
    },
    draw(r, cam) {
      // No hover highlight: clicking shouldn't get a free "you're on it" cue.
      for (const i of live) r.drawTarget(cam, tiles[i].pos, sc.radius, false, false)
    },
    hud: () => String(kills),
    data: () => ({ kind: 'clicking', shots }),
  }
}

/** Pause after a spray (stands in for the reload) before the next one can start. */
const RELOAD_S = 1
/** Keep the last spray's impacts on screen briefly before the results. */
const END_HOLD_S = 0.6
/** A shot's kick is eased in over this long (capped below the shot gap). */
const KICK_S = 0.035

type Vec3 = { x: number; y: number; z: number }

/** 1 if the bullet hits the pill standing at base, plus the impact on its plane. */
function hitPill(cam: Camera, base: Vec3): { hit: number; p: Vec3 | null } {
  const cp = Math.cos(cam.pitch * DEG)
  const dir = { x: Math.sin(cam.yaw * DEG) * cp, y: Math.sin(cam.pitch * DEG), z: Math.cos(cam.yaw * DEG) * cp }
  if (dir.z <= 1e-6) return { hit: 0, p: null }
  const s = (base.z - EYE.z) / dir.z
  const p = { x: EYE.x + dir.x * s, y: EYE.y + dir.y * s, z: base.z }
  // Distance to the pill's spine (the segment between its two cap centres).
  const spineY = Math.max(PILL.radius, Math.min(PILL.height - PILL.radius, p.y))
  return { hit: Math.hypot(p.x - base.x, p.y - spineY) <= PILL.radius ? 1 : 0, p }
}

/**
 * Recoil Control (SPEC-006): hold the trigger to spray a full magazine at a
 * legend-sized pill. Each shot kicks the camera toward the next bullet's pattern offset,
 * so with no mouse input the bullets trace the weapon's pattern exactly.
 * Releasing or emptying the magazine ends the spray.
 */
function createRecoilLogic(d: RecoilDrill, seed: number): RunLogic {
  const w = d.weapon
  const pattern = expandPattern(w.pattern, d.magSize).map(([y, p]) => [y * d.kickScale, p * d.kickScale])
  const jitterRand = mulberry32(seed ^ 0x9e3779b9)
  const jitter = () => (jitterRand() * 2 - 1) * w.jitterDeg
  const mover = d.target === 'strafe'
    ? createMover({
        id: 'recoil-strafe', name: '', focus: '', description: '', mode: 'strafe', dist: d.rangeM, radius: PILL.radius,
        speed: [2.5, 3.5], interval: [0.4, 1.1], box: { x: 3, y: [PILL.centreY, PILL.centreY], z: 0 },
      }, mulberry32(seed))
    : null
  // Aim point: the pill's centre.
  const centre = mover ? mover.pos : { x: 0, y: PILL.centreY, z: EYE.z + d.rangeM }
  const start = dirTo(centre)
  const shots = emptyRecoilShots()

  let physicsAcc = 0
  let ammo = d.magSize, idx = 0, spray = 0, hits = 0
  let held = false, reloading = false, reloadUntil = 0
  let sprayStart = 0, nextShotT = 0, finishedAt = Infinity
  let off = [0, 0]
  const kick = { yaw: 0, pitch: 0, left: 0 }
  let holes: { p: Vec3; hit: number }[] = []

  const applyKick = (cam: Camera, frac: number) => {
    const dy = kick.yaw * frac, dp = kick.pitch * frac
    cam.yaw = ((cam.yaw + dy + 540) % 360) - 180
    cam.pitch = Math.max(-89, Math.min(89, cam.pitch + dp))
    kick.yaw -= dy
    kick.pitch -= dp
  }

  const endSpray = (t: number) => {
    held = false
    spray++
    reloading = true
    reloadUntil = t + RELOAD_S
    if (spray >= d.sprays) finishedAt = t
  }

  const gapAfterShot = (t: number) => {
    if (w.burst && idx % w.burst.size === 0) return w.burst.delayS
    let rpm = w.rpm
    if (w.spinUp) rpm = w.spinUp.fromRpm + (w.rpm - w.spinUp.fromRpm) * Math.min(1, (t - sprayStart) / w.spinUp.seconds)
    return 60 / rpm
  }

  const fire = (t: number, cam: Camera) => {
    // The previous kick always lands before the next bullet, so an untouched
    // mouse reproduces the pattern exactly.
    applyKick(cam, 1)
    kick.left = 0
    const aim = dirTo(centre)
    const { hit, p } = hitPill(cam, { x: centre.x, y: 0, z: centre.z })
    shots.t.push(t)
    shots.spray.push(spray)
    shots.idx.push(idx)
    shots.cYaw.push(cam.yaw)
    shots.cPitch.push(cam.pitch)
    shots.tYaw.push(aim.yaw)
    shots.tPitch.push(aim.pitch)
    shots.oYaw.push(off[0])
    shots.oPitch.push(off[1])
    shots.hit.push(hit)
    if (hit) hits++
    if (p) holes.push({ p, hit })
    ammo--
    idx++
    if (ammo === 0) return endSpray(t)
    const gap = gapAfterShot(t)
    const next = [pattern[idx][0] + jitter(), pattern[idx][1] + jitter()]
    kick.yaw += next[0] - off[0]
    kick.pitch += next[1] - off[1]
    kick.left = Math.min(KICK_S, gap * 0.6)
    off = next
    nextShotT = t + gap
  }

  return {
    start: { yaw: start.yaw, pitch: start.pitch },
    frame(elapsed, dt, cam) {
      if (mover) {
        physicsAcc += dt
        while (physicsAcc >= PHYSICS_STEP) {
          mover.step(PHYSICS_STEP)
          physicsAcc -= PHYSICS_STEP
        }
      }
      if (kick.left > 0) {
        applyKick(cam, Math.min(1, dt / kick.left))
        kick.left -= dt
      }
      if (reloading && elapsed >= reloadUntil && spray < d.sprays) {
        reloading = false
        ammo = d.magSize
        idx = 0
        off = [0, 0]
        holes = []
      }
      while (held && ammo > 0 && nextShotT <= elapsed) fire(nextShotT, cam)
    },
    click() {},
    trigger(down, elapsed) {
      if (down) {
        if (held || reloading || spray >= d.sprays) return
        held = true
        sprayStart = elapsed
        nextShotT = elapsed + (w.windupS ?? 0)
      } else if (held) {
        held = false
        // Letting go mid-magazine ends the spray; the next press starts a fresh pattern.
        if (idx > 0) endSpray(elapsed)
      }
    },
    draw(r, cam) {
      r.drawPill(cam, { x: centre.x, y: 0, z: centre.z })
      for (const h of holes) r.drawImpact(cam, h.p, h.hit)
      if (d.zoom > 1) r.drawScope()
    },
    hud: () => `${shots.t.length ? ((hits / shots.t.length) * 100).toFixed(1) : '0.0'}%`,
    progress: () => (reloading && spray < d.sprays ? 'reload' : `${Math.min(spray + 1, d.sprays)}/${d.sprays}`),
    done: (elapsed) => elapsed >= finishedAt + END_HOLD_S,
    data: () => ({ kind: 'recoil', shots }),
  }
}
