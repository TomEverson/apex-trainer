/**
 * Shared tracking types (SPEC-001/002). These cross domain boundaries —
 * trainer produces samples, analysis summarises them, sessions persists
 * them — so they live here instead of in any one domain. Zod schemas are the
 * source of truth so JSON read back from D1/R2 is parsed, never cast.
 */
import { z } from 'zod'
import { recoilPrefsSchema } from './recoil'

export const motionModeSchema = z.enum(['strafe', 'smooth', 'jump', 'strafe3d', 'sweep', 'reacquire', 'tiles'])
export type MotionMode = z.infer<typeof motionModeSchema>

const rangeSchema = z.tuple([z.number(), z.number()])

export const scenarioSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1),
  focus: z.string(),
  description: z.string(),
  mode: motionModeSchema,
  /** Distance from the eye to the target plane, meters. */
  dist: z.number().positive(),
  /** Target sphere radius, meters. */
  radius: z.number().positive(),
  /** Speed range, m/s. */
  speed: rangeSchema,
  /** Seconds between direction changes. */
  interval: rangeSchema,
  /** Movement bounds: ±x half-width, [yMin, yMax], ±z depth around dist. */
  box: z.object({ x: z.number(), y: rangeSchema, z: z.number() }),
  jump: z.object({ velocity: rangeSchema, gravity: z.number(), chance: z.number() }).optional(),
  /** sweep mode: total yaw arc covered, degrees, centred straight ahead. */
  arcDeg: z.number().positive().max(360).optional(),
  /** tiles mode (SPEC-003): grid of tile directions and how many targets are live at once. */
  tiles: z.object({ cols: z.number().int().positive(), rows: z.number().int().positive(), spacingDeg: z.number().positive(), count: z.number().int().positive() }).optional(),
  /** reacquire mode: seconds between teleport jumps, and jump size in degrees. */
  reacquire: z.object({
    jumpEvery: rangeSchema,
    jumpDeg: rangeSchema,
    /** Health mode: seconds of on-target time to empty the bar; the target jumps on kill instead of on a timer. */
    healthS: z.number().positive().optional(),
  }).optional(),
  /** sweep mode: starting yaw, degrees (0 = straight ahead). Defaults to the left edge. */
  sweepStartDeg: z.number().optional(),
})
export type Scenario = z.infer<typeof scenarioSchema>

export const gameSchema = z.enum(['valorant', 'cs2', 'apex', 'overwatch', 'fortnite', 'custom'])
export type Game = z.infer<typeof gameSchema>

// Fields added after launch carry defaults so runs stored before them still
// parse (otherwise history would silently drop them).
export const settingsSchema = z.object({
  game: gameSchema,
  sens: z.number().nonnegative(),
  /** Only used when game is 'custom' (cm/360 → counts needs the mouse DPI). */
  dpi: z.number().positive(),
  /** Only used when game is 'custom'. */
  cm360: z.number().positive(),
  /** Reported movement units per real mouse count, from the Mouse check (1 = raw input works). */
  inputScale: z.number().positive().default(1),
  /** Multiplies every scenario's target speed (1 = as designed). */
  targetSpeed: z.number().min(0.25).max(2).default(1),
  fov: z.number().min(60).max(130),
  duration: z.number().int().positive(),
  crosshairSize: z.number().min(2).max(20),
  showHud: z.boolean(),
  /** Enter fullscreen when a scenario starts. */
  autoFullscreen: z.boolean().default(true),
  /** Seconds of countdown between locking the mouse and the run going live. */
  countdownS: z.number().min(0).max(10).default(2),
  /** Recoil Control drill options (SPEC-006). */
  recoil: recoilPrefsSchema.default({ rangeM: 20, target: 'static', magTier: 2, barrelTier: 0, sprays: 5, adsScale: 1, zoom: 1, mode: 'pure', strafeAudio: true }),
})
export type Settings = z.infer<typeof settingsSchema>

/**
 * Per-frame samples, columnar. Angles in degrees.
 *   tYaw/tPitch: direction from eye to target. cYaw/cPitch: crosshair.
 *   angR: target angular radius. on: 1 when crosshair is on target.
 *   turn: 1 on a deliberate direction change, 2 on a teleport jump (reacquire mode).
 */
export const samplesSchema = z.object({
  t: z.array(z.number()),
  tYaw: z.array(z.number()),
  tPitch: z.array(z.number()),
  cYaw: z.array(z.number()),
  cPitch: z.array(z.number()),
  angR: z.array(z.number()),
  on: z.array(z.number().int().min(0).max(1)),
  turn: z.array(z.number().int().min(0).max(2)),
})
export type Samples = z.infer<typeof samplesSchema>
export const SAMPLE_KEYS = ['t', 'tYaw', 'tPitch', 'cYaw', 'cPitch', 'angR', 'on', 'turn'] as const

export function emptySamples(): Samples {
  return { t: [], tYaw: [], tPitch: [], cYaw: [], cPitch: [], angR: [], on: [], turn: [] }
}

export const environmentSchema = z.object({
  rawInput: z.boolean(),
  avgFps: z.number(),
  screen: z.string(),
  userAgent: z.string(),
})
export type Environment = z.infer<typeof environmentSchema>

const ratio = z.number().nullable()

export const summarySchema = z.object({
  durationS: z.number(),
  accuracy: ratio,
  meanErrDeg: z.number(),
  medianErrDeg: z.number().nullable(),
  meanErrRadii: z.number(),
  lagDeg: z.number(),
  lagRadii: z.number(),
  crossTrackDeg: z.number(),
  horizErrDeg: z.number(),
  vertErrDeg: z.number(),
  velocityMatch: z.number().nullable(),
  jitterDegS: z.number(),
  meanTargetSpeedDegS: z.number(),
  meanTargetRadiusDeg: z.number(),
  turnAccuracy: ratio,
  steadyAccuracy: ratio,
  reaction: z.object({
    events: z.number(),
    missed: z.number(),
    medianReactionMs: z.number().nullable(),
    meanReactionMs: z.number().nullable(),
    medianRecoveryMs: z.number().nullable(),
    /** Turns recovered (on target ≥100ms after reacting) before the next turn. Added 2026-10-21. */
    recovered: z.number().optional(),
    meanOvershootDeg: z.number().nullable(),
  }),
  dirAccuracy: z.object({ left: ratio, right: ratio, up: ratio, down: ratio }),
  speedAccuracy: z.object({ slow: ratio, mid: ratio, fast: ratio, splitsDegS: z.tuple([z.number(), z.number()]) }),
  /** Only present when the run had teleport jumps (reacquire mode). */
  reacquire: z.object({
    jumps: z.number(),
    missed: z.number(),
    medianAcquireMs: z.number().nullable(),
    medianSettleMs: z.number().nullable(),
  }).optional(),
  thirds: z.array(ratio),
  timeline: z.array(ratio),
})
export type Summary = z.infer<typeof summarySchema>

/**
 * Clicking runs (SPEC-003): one entry per click, columnar. Angles in degrees.
 * t*: the target hit, or the nearest live target for a miss.
 */
export const shotsSchema = z.object({
  startYaw: z.number(),
  startPitch: z.number(),
  t: z.array(z.number()),
  hit: z.array(z.number().int().min(0).max(1)),
  cYaw: z.array(z.number()),
  cPitch: z.array(z.number()),
  tYaw: z.array(z.number()),
  tPitch: z.array(z.number()),
  angR: z.array(z.number()),
})
export type Shots = z.infer<typeof shotsSchema>

export const clickSummarySchema = z.object({
  durationS: z.number(),
  kills: z.number(),
  shots: z.number(),
  accuracy: ratio,
  kps: z.number(),
  medianKillMs: z.number().nullable(),
  medianFlickDeg: z.number().nullable(),
  killMsShort: z.number().nullable(),
  killMsLong: z.number().nullable(),
  misses: z.object({ over: z.number(), under: z.number(), side: z.number() }),
  thirds: z.array(z.number()),
  timeline: z.array(z.number()),
})
export type ClickSummary = z.infer<typeof clickSummarySchema>

export const isClicking = (sc: Scenario) => sc.mode === 'tiles'

export type TipKey =
  | 'lag' | 'lead' | 'slow' | 'fast' | 'reactivity' | 'reaction' | 'overshoot'
  | 'asymmetry' | 'vertical' | 'jitter' | 'fatigue' | 'speed' | 'reacquire' | 'solid'
  | 'click-accuracy' | 'flick-overshoot' | 'flick-undershoot' | 'flick-distance'
  | 'under-pull' | 'over-pull' | 'late-drift' | 'horizontal' | 'first-shot' | 'inconsistent'
  | 'strafe-late' | 'strafe-early' | 'strafe-wrong' | 'strafe-missed'
export type Tip = { key: TipKey; text: string }

/** A stored run as returned to the client (no samples). */
type SessionBase = {
  id: string
  degPerCount: number
  scenario: Scenario
  seed: number
  startedAt: string
  endedAt: string
  settings: Settings
  environment: Environment
  tips: string[]
}
export type TrackingSessionRow = SessionBase & { kind: 'tracking'; summary: Summary }
export type ClickingSessionRow = SessionBase & { kind: 'clicking'; summary: ClickSummary }
export type SessionRow = TrackingSessionRow | ClickingSessionRow

/** The headline number per kind: on-target accuracy for tracking, kills for clicking. */
export function scoreOf(r: SessionRow): number {
  return r.kind === 'tracking' ? (r.summary.accuracy ?? 0) : r.summary.kills
}
export function formatScore(r: SessionRow, v = scoreOf(r)): string {
  return r.kind === 'tracking' ? `${(v * 100).toFixed(1)}%` : `${Math.round(v)} kills`
}

/** Human-readable sensitivity, e.g. "valorant 0.35" or "custom 34.6 cm/360 @ 800 DPI". */
export function sensLabel(s: Settings): string {
  return s.game === 'custom' ? `custom ${s.cm360} cm/360 @ ${s.dpi} DPI` : `${s.game} ${s.sens}`
}
