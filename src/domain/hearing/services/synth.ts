/**
 * Procedural footsteps (SPEC-005): a filtered-noise heel strike, a low body
 * thump and a toe scuff, all with fast decays. Each Apex-style terrain is a
 * recipe on top: metal rings, wood knocks hollow, dirt/sand/grass add a
 * crunch of tiny grains. Rendered once into AudioBuffers at start.
 */
import type { Surface } from '../types'

type Range = [number, number]

type Recipe = {
  lenS: number
  heel: { band: Range; decayS: Range; amp: number; attackS: number }
  scuff: { band: Range; decayS: Range; amp: number; attackS: number }
  /** Low body thump amplitude. */
  thump: number
  /** Crunch: many 1–2 ms clicks spread over `spreadS`. */
  grains: { count: number; band: Range; spreadS: number; amp: number } | null
  /** Damped partials [ratio, amp] over a random fundamental. */
  ring: { f0: Range; partials: [number, number][]; tau: Range } | null
}

const RECIPES: Record<Surface, Recipe> = {
  concrete: {
    lenS: 0.25, thump: 0.5, grains: null, ring: null,
    heel: { band: [180, 2400], decayS: [0.018, 0.03], amp: 1, attackS: 0.002 },
    scuff: { band: [900, 5000], decayS: [0.01, 0.016], amp: 0.45, attackS: 0.002 },
  },
  // Catwalks, ship hulls, containers: bright clank plus an inharmonic ring.
  metal: {
    lenS: 0.45, thump: 0.35, grains: null,
    heel: { band: [500, 6000], decayS: [0.015, 0.025], amp: 1, attackS: 0.001 },
    scuff: { band: [1500, 7000], decayS: [0.008, 0.012], amp: 0.4, attackS: 0.001 },
    ring: { f0: [550, 900], partials: [[1, 0.22], [2.32, 0.16], [3.67, 0.1], [5.1, 0.06]], tau: [0.08, 0.15] },
  },
  // Boardwalks, wooden floors: hollow low knock.
  wood: {
    lenS: 0.3, thump: 0.7, grains: null,
    heel: { band: [120, 1800], decayS: [0.02, 0.03], amp: 1, attackS: 0.002 },
    scuff: { band: [700, 3500], decayS: [0.008, 0.012], amp: 0.3, attackS: 0.002 },
    ring: { f0: [160, 240], partials: [[1, 0.35], [2.7, 0.12]], tau: [0.03, 0.05] },
  },
  // Packed dirt / rock: dull thud with a little crunch.
  dirt: {
    lenS: 0.3, thump: 0.6, ring: null,
    heel: { band: [90, 1100], decayS: [0.03, 0.045], amp: 1, attackS: 0.004 },
    scuff: { band: [400, 2500], decayS: [0.02, 0.03], amp: 0.35, attackS: 0.003 },
    grains: { count: 14, band: [600, 3000], spreadS: 0.09, amp: 0.25 },
  },
  // Soft swish, quiet thump.
  grass: {
    lenS: 0.32, thump: 0.25, ring: null,
    heel: { band: [150, 900], decayS: [0.025, 0.035], amp: 0.5, attackS: 0.006 },
    scuff: { band: [1200, 6000], decayS: [0.05, 0.08], amp: 0.6, attackS: 0.015 },
    grains: { count: 20, band: [2000, 7000], spreadS: 0.12, amp: 0.12 },
  },
  // Soft, dense crunch.
  sand: {
    lenS: 0.3, thump: 0.3, ring: null,
    heel: { band: [200, 1500], decayS: [0.03, 0.05], amp: 0.6, attackS: 0.008 },
    scuff: { band: [1000, 5000], decayS: [0.04, 0.06], amp: 0.45, attackS: 0.01 },
    grains: { count: 40, band: [1500, 6000], spreadS: 0.1, amp: 0.18 },
  },
}

const pick = (rand: () => number, [lo, hi]: Range) => lo + (hi - lo) * rand()

/** In-place one-pole low-pass; high-pass = signal minus its low-pass. */
function onePole(x: Float32Array, fc: number, sr: number, mode: 'low' | 'high') {
  const a = Math.exp((-2 * Math.PI * fc) / sr)
  let lp = 0
  for (let i = 0; i < x.length; i++) {
    lp = (1 - a) * x[i] + a * lp
    x[i] = mode === 'low' ? lp : x[i] - lp
  }
}

/** Band-limit to [lo, hi] with two passes each side. */
function band(x: Float32Array, [lo, hi]: Range, sr: number) {
  for (let k = 0; k < 2; k++) {
    onePole(x, lo, sr, 'high')
    onePole(x, hi, sr, 'low')
  }
}

/** Noise with a linear attack and exponential decay, band-limited. */
function noiseBurst(len: number, sr: number, startS: number, attackS: number, decayS: number, amp: number, range: Range, rand: () => number) {
  const x = new Float32Array(len)
  const start = Math.round(startS * sr), attack = Math.max(1, Math.round(attackS * sr))
  for (let i = start; i < len; i++) {
    const n = i - start
    const env = n < attack ? n / attack : Math.exp(-(n - attack) / sr / decayS)
    x[i] = (rand() * 2 - 1) * env * amp
  }
  band(x, range, sr)
  return x
}

export function synthFootstep(ctx: BaseAudioContext, surface: Surface, rand: () => number): AudioBuffer {
  const r = RECIPES[surface]
  const sr = ctx.sampleRate
  const len = Math.round(sr * r.lenS)
  const out = new Float32Array(len)
  const add = (part: Float32Array) => {
    for (let i = 0; i < len; i++) out[i] += part[i]
  }

  add(noiseBurst(len, sr, 0, r.heel.attackS, pick(rand, r.heel.decayS), r.heel.amp, r.heel.band, rand))
  add(noiseBurst(len, sr, 0.04 + rand() * 0.03, r.scuff.attackS, pick(rand, r.scuff.decayS), r.scuff.amp, r.scuff.band, rand))
  const f = 70 + rand() * 40
  for (let i = 0; i < len; i++) out[i] += r.thump * Math.sin((2 * Math.PI * f * i) / sr) * Math.exp(-i / sr / 0.025)

  if (r.grains) {
    const g = new Float32Array(len)
    const grainLen = Math.round(0.0015 * sr)
    for (let k = 0; k < r.grains.count; k++) {
      const t = rand() * r.grains.spreadS
      const start = Math.round(t * sr)
      const amp = r.grains.amp * (0.4 + 0.6 * rand()) * (1 - t / r.grains.spreadS)
      for (let n = 0; n < grainLen && start + n < len; n++) g[start + n] += (rand() * 2 - 1) * amp * (1 - n / grainLen)
    }
    band(g, r.grains.band, sr)
    // Band-limiting thins the clicks a lot; bring them back up.
    for (let i = 0; i < len; i++) out[i] += g[i] * 4
  }

  if (r.ring) {
    const f0 = pick(rand, r.ring.f0)
    for (const [ratio, amp] of r.ring.partials) {
      const tau = pick(rand, r.ring.tau)
      for (let i = 0; i < len; i++) out[i] += amp * Math.sin((2 * Math.PI * f0 * ratio * i) / sr) * Math.exp(-i / sr / tau)
    }
  }

  let peak = 0
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(out[i]))
  if (peak > 0) for (let i = 0; i < len; i++) out[i] *= 0.9 / peak
  const buf = ctx.createBuffer(1, len, sr)
  buf.copyToChannel(out, 0)
  return buf
}

/**
 * Mono reverb impulse. Interior: short, bright, dense early reflections (a
 * room). Exterior: sparse, darker, longer tail with a distant slap echo.
 */
export function synthRoom(ctx: BaseAudioContext, env: 'interior' | 'exterior', rand: () => number): AudioBuffer {
  const sr = ctx.sampleRate
  const interior = env === 'interior'
  const len = Math.round(sr * (interior ? 0.5 : 1.3))
  const tau = interior ? 0.09 : 0.35
  const x = new Float32Array(len)
  for (let i = 0; i < len; i++) x[i] = (rand() * 2 - 1) * Math.exp(-i / sr / tau) * (interior ? 1 : 0.5)
  // Early reflections: walls in a room, one far slap outdoors.
  const taps = interior ? [0.007, 0.013, 0.019, 0.026, 0.034] : [0.12]
  for (const t of taps) {
    const at = Math.round(t * sr)
    if (at < len) x[at] += interior ? 0.6 : 0.9
  }
  onePole(x, interior ? 5000 : 2000, sr, 'low')
  const buf = ctx.createBuffer(1, len, sr)
  buf.copyToChannel(x, 0)
  return buf
}

/** Gunshot-like crack for distractors: very short noise, darkened (distant). */
export function synthCrack(ctx: BaseAudioContext, rand: () => number): AudioBuffer {
  const sr = ctx.sampleRate
  const len = Math.round(sr * 0.25)
  const x = noiseBurst(len, sr, 0, 0.002, 0.035, 1, [80, 1400], rand)
  const buf = ctx.createBuffer(1, len, sr)
  buf.copyToChannel(x, 0)
  return buf
}

/** Looping brown noise for the ambient hum bed. */
export function synthBrownNoise(ctx: BaseAudioContext, seconds: number, rand: () => number): AudioBuffer {
  const sr = ctx.sampleRate
  const len = Math.round(sr * seconds)
  const x = new Float32Array(len)
  let v = 0
  for (let i = 0; i < len; i++) {
    v = (v + 0.02 * (rand() * 2 - 1)) * 0.998
    x[i] = v
  }
  let peak = 0
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(x[i]))
  if (peak > 0) for (let i = 0; i < len; i++) x[i] *= 0.8 / peak
  const buf = ctx.createBuffer(1, len, sr)
  buf.copyToChannel(x, 0)
  return buf
}
