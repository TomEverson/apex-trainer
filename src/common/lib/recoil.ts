/**
 * Shared recoil-control types (SPEC-006). The trainer fires the drill and
 * logs shots, analysis summarises them, sessions persists them — so the
 * schemas live here. Angles are degrees: yaw + = right, pitch + = up.
 */
import { z } from 'zod'
import type { Environment, Settings } from './tracking'

/** Recoil target: an upright pill about a legend's size, meters. Aim point is its centre. */
export const PILL = { height: 1.9, radius: 0.32, centreY: 0.95 }

export const weaponClassSchema = z.enum(['ar', 'smg', 'lmg'])
export type WeaponClass = z.infer<typeof weaponClassSchema>

export const weaponSchema = z.object({
  id: z.string().min(1).max(32),
  name: z.string().min(1),
  class: weaponClassSchema,
  ammo: z.enum(['light', 'heavy', 'energy']),
  /** Care Package only this season. */
  carePackage: z.boolean(),
  /** Full-auto rate, or the rate inside a burst. */
  rpm: z.number().positive(),
  /** Devotion: fire rate ramps from fromRpm to rpm over `seconds` of holding. */
  spinUp: z.object({ fromRpm: z.number().positive(), seconds: z.number().positive() }).optional(),
  /** Havoc: delay between pressing the trigger and the first shot. */
  windupS: z.number().nonnegative().optional(),
  /** Burst weapons: rounds per burst and the pause between bursts while held. */
  burst: z.object({ size: z.number().int().positive(), delayS: z.number().positive() }).optional(),
  /** Magazine by tier: none, white, blue, purple. L-STAR: shots until overheat. */
  mags: z.tuple([z.number().int().positive(), z.number().int().positive(), z.number().int().positive(), z.number().int().positive()]),
  /** Accepts a Barrel Stabilizer. */
  barrel: z.boolean(),
  /**
   * Uncompensated spray as keypoints [bullet index, yaw°, pitch°]: where each
   * bullet lands relative to the first when the mouse doesn't move. Linear
   * between keypoints; the last segment's slope continues past the end.
   */
  pattern: z.array(z.tuple([z.number().int().nonnegative(), z.number(), z.number()])).min(2),
  /** Random per-shot kick on top of the pattern, ± degrees. */
  jitterDeg: z.number().nonnegative(),
  /** Where the pattern came from, so recalibrated patterns don't silently mix with guesses in history. */
  source: z.string(),
  /**
   * measured: in-game capture, no known recoil change since. outdated: a
   * capture the source itself marks old, or with a recoil patch after it.
   * estimate: no capture exists; shape and size are guesses.
   */
  confidence: z.enum(['measured', 'outdated', 'estimate']).default('estimate'),
  /** Why the pattern may differ from the live game. */
  patternNote: z.string().optional(),
  /** Recoil Strafe: which way to strafe, phase by phase. */
  strafe: z.object({
    /** [direction, milliseconds] from the trigger press; the last phase runs to the end of any longer magazine. */
    phases: z.array(z.tuple([z.enum(['left', 'right', 'none']), z.number().positive()])).min(1),
    source: z.string(),
  }).optional(),
})
export type Weapon = z.infer<typeof weaponSchema>
export type StrafePhase = NonNullable<Weapon['strafe']>['phases'][number]

/** Strafe direction as a number: -1 left (A), 0 none, 1 right (D). */
export const strafeDir = (d: StrafePhase[0]) => (d === 'left' ? -1 : d === 'right' ? 1 : 0)

export const recoilTargetSchema = z.enum(['static', 'strafe'])

/** Per-device drill preferences (part of Settings). */
export const recoilPrefsSchema = z.object({
  rangeM: z.number().positive(),
  target: recoilTargetSchema,
  /** 0 = no mag, 1 white, 2 blue, 3 purple. */
  magTier: z.number().int().min(0).max(3),
  /** 0 = no barrel, 1 white, 2 blue, 3 purple. */
  barrelTier: z.number().int().min(0).max(3),
  sprays: z.number().int().positive(),
  /** Apex's per-optic ADS sensitivity multiplier (1 = default). */
  adsScale: z.number().positive(),
  /** Optic magnification: 1 (iron sights / 1x) to 4. Zooms the view and slows turning by the same factor. */
  zoom: z.number().min(1).max(10).default(1),
  /** pure: mouse only. strafe: also follow the weapon's A/D strafe timing. */
  mode: z.enum(['pure', 'strafe']).default('pure'),
  /** Recoil Strafe: left/right beeps at each strafe switch. */
  strafeAudio: z.boolean().default(true),
})
export type RecoilPrefs = z.infer<typeof recoilPrefsSchema>

/** Everything a drill was played with, stored with the run. */
export const recoilDrillSchema = recoilPrefsSchema.extend({
  /** Variant id: weapon + range + optic + mag + barrel + target + mode. Stats never mix variants. */
  id: z.string().min(1).max(64),
  name: z.string().min(1),
  weapon: weaponSchema,
  magSize: z.number().int().positive(),
  /** Pattern multiplier from the barrel tier (1 = no barrel). */
  kickScale: z.number().positive(),
})
export type RecoilDrill = z.infer<typeof recoilDrillSchema>

/**
 * One entry per bullet, columnar. c*: crosshair (= bullet direction) at the
 * shot. t*: aim point (pill centre). o*: the uncompensated pattern
 * offset for this bullet, after barrel scaling and jitter. hit: 1 on the pill.
 */
export const recoilShotsSchema = z.object({
  t: z.array(z.number()),
  spray: z.array(z.number().int().nonnegative()),
  idx: z.array(z.number().int().nonnegative()),
  cYaw: z.array(z.number()),
  cPitch: z.array(z.number()),
  tYaw: z.array(z.number()),
  tPitch: z.array(z.number()),
  oYaw: z.array(z.number()),
  oPitch: z.array(z.number()),
  hit: z.array(z.number().int().min(0).max(1)),
  /**
   * Recoil Strafe: per spray, trigger press and end (run seconds); then every
   * change of A/D direction during a spray (dir -1 left, 0 none, 1 right).
   */
  strafe: z.object({
    pressT: z.array(z.number()),
    endT: z.array(z.number()),
    t: z.array(z.number()),
    spray: z.array(z.number().int().nonnegative()),
    dir: z.array(z.number().int().min(-1).max(1)),
  }).optional(),
})
export type RecoilShots = z.infer<typeof recoilShotsSchema>

export function emptyRecoilShots(): RecoilShots {
  return { t: [], spray: [], idx: [], cYaw: [], cPitch: [], tYaw: [], tPitch: [], oYaw: [], oPitch: [], hit: [] }
}

const ratio = z.number().nullable()
const phaseSchema = z.object({
  hitRate: ratio,
  meanErrDeg: z.number().nullable(),
  vertBiasDeg: z.number().nullable(),
  horizBiasDeg: z.number().nullable(),
})

export const recoilSummarySchema = z.object({
  sprays: z.number(),
  shots: z.number(),
  hitRate: ratio,
  meanErrDeg: z.number().nullable(),
  medianErrDeg: z.number().nullable(),
  /** Mean signed error from the aim point. vert + = above (under-pulled), horiz + = right. */
  vertBiasDeg: z.number().nullable(),
  horizBiasDeg: z.number().nullable(),
  /** Std dev of the error, per axis. */
  vertSpreadDeg: z.number().nullable(),
  horizSpreadDeg: z.number().nullable(),
  /** Share of the pattern cancelled: 1 perfect, 0 didn't pull, < 0 made it worse, > 1 over-pulled. */
  vertComp: ratio,
  /** null when the pattern has too little sideways movement to judge. */
  horizComp: ratio,
  /** Error of each spray's first bullet (aim before firing, not recoil). */
  firstShotErrDeg: z.number().nullable(),
  /** Each spray split into thirds by bullet index. */
  phases: z.object({ early: phaseSchema, mid: phaseSchema, late: phaseSchema }),
  /** Mean error per bullet index across sprays: what your average spray looks like. */
  avgSpray: z.object({ n: z.array(z.number()), horiz: z.array(z.number()), vert: z.array(z.number()) }),
  /** Mean per-bullet spread across sprays (lower = the same pull every time). */
  consistencyDeg: z.number().nullable(),
  sprayHitRates: z.array(ratio),
  /** Hit rate by first / middle / last third of the sprays. */
  thirds: z.array(ratio),
  /** Recoil Strafe only: how closely A/D followed the strafe pattern. */
  strafe: z.object({
    /** Share of scored time holding the expected direction (none = neither key). */
    timing: ratio,
    /** Share of time holding the opposite key / no key when one was expected. */
    wrongDir: ratio,
    idle: ratio,
    /** Switches between phases: how many, missed (not made within 400 ms), median / mean absolute lag (+ = late). */
    switches: z.number(),
    missed: z.number(),
    medianLagMs: z.number().nullable(),
    meanAbsLagMs: z.number().nullable(),
    /** Timing per pattern phase, averaged over sprays. */
    perPhase: z.array(ratio),
  }).optional(),
})
export type RecoilSummary = z.infer<typeof recoilSummarySchema>

/** A stored recoil run as returned to the client (no shots). */
export type RecoilSessionRow = {
  id: string
  drill: RecoilDrill
  degPerCount: number
  seed: number
  startedAt: string
  endedAt: string
  settings: Settings
  environment: Environment
  summary: RecoilSummary
  tips: string[]
}

/** Cumulative pattern offset [yaw, pitch] for bullets 0..n-1, unscaled. */
export function expandPattern(pattern: Weapon['pattern'], n: number): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i < n; i++) {
    let k = pattern.findIndex(([idx]) => idx >= i)
    if (k === 0) { out.push([pattern[0][1], pattern[0][2]]); continue }
    if (k === -1) k = pattern.length - 1
    const [i0, y0, p0] = pattern[k - 1]
    const [i1, y1, p1] = pattern[k]
    const f = (i - i0) / Math.max(1, i1 - i0)
    out.push([y0 + (y1 - y0) * f, p0 + (p1 - p0) * f])
  }
  return out
}

/**
 * Seconds until the next shot, after `fired` shots of the current spray with
 * the trigger held for `heldS`: the burst pause after a full burst, else the
 * fire rate (ramping up for spin-up weapons).
 */
export function shotGap(w: Weapon, fired: number, heldS: number): number {
  if (w.burst && fired % w.burst.size === 0) return w.burst.delayS
  const rpm = w.spinUp ? w.spinUp.fromRpm + (w.rpm - w.spinUp.fromRpm) * Math.min(1, heldS / w.spinUp.seconds) : w.rpm
  return 60 / rpm
}

/** Time of each shot from the trigger press, seconds. */
export function shotTimes(w: Weapon, n: number): number[] {
  const times: number[] = []
  let t = w.windupS ?? 0
  for (let i = 0; i < n; i++) {
    times.push(t)
    t += shotGap(w, i + 1, t)
  }
  return times
}

/** One strafe phase in time: dir -1 left, 0 none, 1 right; seconds from the trigger press; 1-based bullets fired in it (0 = none). */
export type StrafeSegment = { dir: number; start: number; end: number; from: number; to: number }

/**
 * A weapon's strafe pattern laid out for a magazine of n: phases run back to
 * back from the trigger press, cut off when the magazine is empty, and the
 * last one stretches to the final bullet of a longer magazine.
 */
export function strafeTimeline(w: Weapon, n: number): StrafeSegment[] {
  const phases = w.strafe?.phases ?? []
  if (!phases.length || n < 1) return []
  const times = shotTimes(w, n)
  const lastGap = n > 1 ? times[n - 1] - times[n - 2] : 0.1
  const sprayEnd = times[n - 1] + lastGap / 2
  const out: StrafeSegment[] = []
  let start = 0
  phases.forEach(([d, ms], i) => {
    if (start >= sprayEnd) return
    const end = i === phases.length - 1 ? sprayEnd : Math.min(sprayEnd, start + ms / 1000)
    const inside = times.map((t, k) => (t >= start && t < end ? k + 1 : 0)).filter((k) => k > 0)
    out.push({ dir: strafeDir(d), start, end, from: inside[0] ?? 0, to: inside.at(-1) ?? 0 })
    start = end
  })
  return out
}

/**
 * Strafe speed while aiming down sights, m/s. Apex walks at 173.5 hu/s with a
 * weapon out (1 hu ≈ 1 inch) and scales that by the weapon class's ADS move
 * multiplier: AR 0.5, SMG 0.75, LMG 0.4 (Apex Legends Wiki; matches the Apex
 * Movement wiki's measured 86.75 / 130.12 hu/s for AR / SMG).
 */
export const ADS_STRAFE_SPEED: Record<WeaponClass, number> = {
  ar: 173.5 * 0.5 * 0.0254,
  smg: 173.5 * 0.75 * 0.0254,
  lmg: 173.5 * 0.4 * 0.0254,
}

/**
 * Time from standing to full ADS strafe speed with a key held, seconds; the
 * same for every class, so acceleration scales with top speed (as in
 * Source-style movement). Measured in the Apex Firing Range with cl_showpos
 * (2026-10-23): AR (Flatline) 0 → 35.14 → 86.75 hu/s over ~0.04 s; SMG
 * (Prowler) 0 → 130.12 hu/s within one 0.038 s frame. A↔D reversals take
 * twice as long (AR measured 2,022 / 2,493 hu/s² ≈ 86.75 / 0.04 s; SMG
 * reversals read 2,446–2,967 hu/s², ~15% under 130.12 / 0.04 s, within the
 * 20 fps clip's error). LMG not measured.
 */
export const STRAFE_REACH_S = 0.04

/** Strafe acceleration while a key is held, m/s². */
export const STRAFE_ACCEL: Record<WeaponClass, number> = {
  ar: ADS_STRAFE_SPEED.ar / STRAFE_REACH_S,
  smg: ADS_STRAFE_SPEED.smg / STRAFE_REACH_S,
  lmg: ADS_STRAFE_SPEED.lmg / STRAFE_REACH_S,
}

/**
 * Deceleration with no strafe key held (or both), m/s²: a constant 1,260 hu/s²,
 * measured coasting to a stop (1,248 / 1,240 / 1,317 / 1,250 hu/s² over
 * successive frames).
 */
export const STRAFE_COAST_DECEL = 1260 * 0.0254
