// Recoil Control weapons (SPEC-006): Apex Legends Season 30 ARs, SMGs and LMGs.
// Snipers, marksman rifles, pistols and shotguns are out of scope.
//
// Respawn publishes no recoil data. Patterns come from in-game captures
// (patterns.ts, from metaflow/apex-recoil) wherever one exists; each weapon
// says how far to trust it. Fire rates and magazines follow the patch notes up
// to S30 Split 2 (2026-09-15) and match the captures' shot timing. Runs store
// the pattern they used, so a recapture never rewrites history.
import { expandPattern, type RecoilDrill, type RecoilPrefs, type Weapon } from '../../../common/lib/recoil'
import * as P from './patterns'

const CAP_2021 = 'apex-recoil capture 2021 (S8–S11)'
const CAP_2024 = 'apex-recoil capture 2024-09 (S22)'
const ESTIMATE = 'estimate-s30'
const OLD = 'Captured in 2021 and marked out of date by its source; the gun may have been retuned since.'
const JITTER = 0.05

export const WEAPONS: Weapon[] = [
  // ── Assault rifles ──
  {
    id: 'r-301', name: 'R-301 Carbine', class: 'ar', ammo: 'light', carePackage: false,
    rpm: 810, mags: [18, 20, 25, 28], barrel: true, jitterDeg: JITTER,
    pattern: P.R301, source: CAP_2024, confidence: 'measured',
  },
  {
    id: 'flatline', name: 'VK-47 Flatline', class: 'ar', ammo: 'heavy', carePackage: false,
    rpm: 600, mags: [20, 25, 28, 30], barrel: true, jitterDeg: JITTER,
    pattern: P.FLATLINE, source: CAP_2024, confidence: 'measured',
  },
  {
    id: 'havoc', name: 'Havoc', class: 'ar', ammo: 'energy', carePackage: false,
    // Turbocharger removed in S22 Split 2, so the windup applies. Captured with it; the pattern is the same.
    rpm: 660, windupS: 0.27, mags: [25, 28, 30, 32], barrel: true, jitterDeg: JITTER,
    pattern: P.HAVOC, source: CAP_2021, confidence: 'outdated', patternNote: OLD,
  },
  {
    id: 'hemlok', name: 'Hemlok Breach AR', class: 'ar', ammo: 'heavy', carePackage: false,
    // S28 Breach rework: slow full-auto; S29 trimmed mags, S30 damage 22→21.
    rpm: 480, mags: [18, 20, 22, 25], barrel: true, jitterDeg: JITTER,
    pattern: [[0, 0, 0], [5, -0.2, 2], [12, -0.4, 3.4], [25, -0.1, 4.8]],
    source: ESTIMATE, confidence: 'estimate', patternNote: 'No capture exists for the S28 Breach version. Shape and size are guesses.',
  },
  {
    id: 'nemesis', name: 'Nemesis Burst AR', class: 'ar', ammo: 'energy', carePackage: false,
    rpm: 1100, burst: { size: 4, delayS: 0.3 }, mags: [20, 24, 27, 30], barrel: false, jitterDeg: JITTER,
    pattern: [[0, 0, 0], [8, 0.3, 1.6], [16, 0.5, 2.6], [30, 0.2, 3.6]],
    source: ESTIMATE, confidence: 'estimate', patternNote: 'No capture exists. Shape and size are guesses.',
  },
  // ── SMGs ──
  {
    id: 'r-99', name: 'R-99 SMG', class: 'smg', ammo: 'light', carePackage: false,
    rpm: 1080, mags: [17, 20, 24, 27], barrel: true, jitterDeg: JITTER,
    pattern: P.R99, source: CAP_2024, confidence: 'outdated',
    patternNote: 'Captured Sept 2024; floor R-99 recoil was increased on 2025-02-11 (S24), so the live gun kicks harder.',
  },
  {
    id: 'alternator', name: 'Alternator SMG', class: 'smg', ammo: 'light', carePackage: false,
    // S30: mags 20/24/26/30 → 18/20/22/26.
    rpm: 600, mags: [18, 20, 22, 26], barrel: true, jitterDeg: JITTER,
    pattern: P.ALTERNATOR, source: CAP_2021, confidence: 'outdated', patternNote: OLD,
  },
  {
    id: 'volt', name: 'Volt SMG', class: 'smg', ammo: 'energy', carePackage: false,
    rpm: 720, mags: [20, 22, 25, 27], barrel: true, jitterDeg: JITTER,
    // Pattern has 26 bullets; the purple-mag 27th continues the last step.
    pattern: P.VOLT, source: 'apex-recoil capture 2021, confirmed 2024-09 (S22)', confidence: 'measured',
  },
  {
    id: 'car', name: 'C.A.R. SMG', class: 'smg', ammo: 'heavy', carePackage: false,
    // S29: back on the floor, blue 25→26, purple 28→30.
    rpm: 930, mags: [20, 23, 26, 30], barrel: false, jitterDeg: JITTER,
    // Pattern has 27 bullets; purple-mag bullets 28–30 continue the last step.
    pattern: P.CAR, source: 'apex-recoil capture 2026-03 (S28)', confidence: 'measured',
  },
  {
    id: 'prowler', name: 'Prowler Burst PDW', class: 'smg', ammo: 'heavy', carePackage: false,
    rpm: 1200, burst: { size: 5, delayS: 0.24 }, mags: [20, 25, 28, 30], barrel: false, jitterDeg: JITTER,
    pattern: [[0, 0, 0], [10, 0.4, 2.4], [20, 0.2, 3.6], [30, -0.2, 4.4]],
    source: ESTIMATE, confidence: 'estimate', patternNote: 'No capture of burst mode. Shape and size are guesses.',
  },
  {
    // Selectfire Receiver: the same gun in full-auto. Separate id so its stats never mix with burst.
    id: 'prowler-auto', name: 'Prowler PDW (Full Auto)', class: 'smg', ammo: 'heavy', carePackage: false,
    rpm: 800, mags: [20, 25, 28, 30], barrel: false, jitterDeg: JITTER,
    pattern: P.PROWLER_AUTO, source: CAP_2021, confidence: 'outdated',
    patternNote: 'Captured in 2021; Prowler recoil was improved in the S28 mid-season patch, so the live gun kicks less.',
  },
  // ── LMGs ──
  {
    id: 'devotion', name: 'Devotion LMG', class: 'lmg', ammo: 'energy', carePackage: false,
    // Captured with Turbocharger (faster spin-up); the pattern per bullet is the same.
    rpm: 900, spinUp: { fromRpm: 300, seconds: 1.1 }, mags: [36, 40, 44, 48], barrel: true, jitterDeg: JITTER,
    pattern: P.DEVOTION, source: CAP_2021, confidence: 'outdated', patternNote: OLD,
  },
  {
    id: 'l-star', name: 'L-STAR EMG', class: 'lmg', ammo: 'energy', carePackage: true,
    // Care Package since S29; no magazine, so every tier is shots until overheat.
    rpm: 600, mags: [24, 24, 24, 24], barrel: false, jitterDeg: JITTER,
    pattern: P.LSTAR, source: CAP_2021, confidence: 'outdated', patternNote: OLD,
  },
  {
    id: 'spitfire', name: 'M600 Spitfire', class: 'lmg', ammo: 'light', carePackage: false,
    rpm: 540, mags: [35, 40, 45, 50], barrel: true, jitterDeg: JITTER,
    pattern: P.SPITFIRE, source: CAP_2021, confidence: 'outdated', patternNote: OLD,
  },
  {
    id: 'rampage', name: 'Rampage LMG', class: 'lmg', ammo: 'heavy', carePackage: false,
    rpm: 300, mags: [26, 30, 34, 38], barrel: true, jitterDeg: JITTER,
    pattern: P.RAMPAGE, source: CAP_2021, confidence: 'outdated', patternNote: OLD,
  },
]

export const CLASS_LABELS = { ar: 'Assault rifles', smg: 'SMGs', lmg: 'LMGs' } as const
export const TIER_LABELS = ['None', 'White', 'Blue', 'Purple'] as const
/** Pattern multiplier per Barrel Stabilizer tier (approximate). */
export const BARREL_SCALE = [1, 0.9, 0.85, 0.8] as const
export const RANGES_M = [10, 20, 40, 60, 100, 150, 200] as const
/** Optics an AR / SMG / LMG can mount: 1x (or iron sights), 2x Bruiser, 3x Ranger, 4x (2–4x AOG). */
export const OPTICS = [1, 2, 3, 4] as const
/** Every recoil run is this many full sprays. */
export const SPRAYS_PER_RUN = 5

export function getWeapon(id: string): Weapon | undefined {
  return WEAPONS.find((w) => w.id === id)
}

/** The drill a weapon is played with under the given prefs. */
export function buildDrill(weapon: Weapon, prefs: RecoilPrefs): RecoilDrill {
  const barrelTier = weapon.barrel ? prefs.barrelTier : 0
  // The L-STAR has one "magazine"; don't split its stats by mag tier.
  const magTier = new Set(weapon.mags).size === 1 ? 0 : prefs.magTier
  const strafe = prefs.target === 'strafe'
  return {
    ...prefs,
    sprays: SPRAYS_PER_RUN,
    barrelTier,
    magTier,
    id: `${weapon.id}@${prefs.rangeM}m-x${prefs.zoom}-m${magTier}-b${barrelTier}${strafe ? '-strafe' : ''}`,
    name: `${weapon.name} · ${prefs.rangeM} m · ${prefs.zoom}x${strafe ? ' · strafing' : ''}`,
    weapon,
    magSize: weapon.mags[magTier],
    kickScale: BARREL_SCALE[barrelTier],
  }
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

/** Time of each shot from the trigger press, seconds (for the spray guide). */
export function shotTimes(w: Weapon, n: number): number[] {
  const times: number[] = []
  let t = w.windupS ?? 0
  for (let i = 0; i < n; i++) {
    times.push(t)
    t += shotGap(w, i + 1, t)
  }
  return times
}

/**
 * Horizontal FOV through an optic. Magnification divides the tangent of the
 * half-angle, so a 2x shows half the width of the hip-fire view.
 */
export function zoomedFov(fovDeg: number, zoom: number): number {
  const half = (fovDeg / 2) * (Math.PI / 180)
  return (2 * Math.atan(Math.tan(half) / zoom) * 180) / Math.PI
}

/** Total uncompensated climb over a full magazine, degrees (for the weapon cards). */
export function patternClimb(d: RecoilDrill): number {
  const pts = expandPattern(d.weapon.pattern, d.magSize)
  return pts[pts.length - 1][1] * d.kickScale
}
