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
})
export type Weapon = z.infer<typeof weaponSchema>

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
})
export type RecoilPrefs = z.infer<typeof recoilPrefsSchema>

/** Everything a drill was played with, stored with the run. */
export const recoilDrillSchema = recoilPrefsSchema.extend({
  /** Variant id: weapon + range + optic + mag + barrel + target. Stats never mix variants. */
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
