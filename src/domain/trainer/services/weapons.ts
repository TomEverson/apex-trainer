// Recoil Control weapons (SPEC-006): Apex Legends Season 30 ARs, SMGs and LMGs.
// Snipers, marksman rifles, pistols and shotguns are out of scope.
//
// Respawn doesn't publish recoil data and no verified Season 30 pattern charts
// exist. Fire rates and magazines follow the patch notes up to S30 Split 2
// (2026-09-15); the spray shapes are approximations of each gun's known shape
// (how far it climbs, which way it drifts). Replace a pattern with Firing Range
// measurements and change its `source` — runs store the pattern they used.
import { expandPattern, type RecoilDrill, type RecoilPrefs, type Weapon } from '../../../common/lib/recoil'

const APPROX = 'approx-s30'
const JITTER = 0.05

export const WEAPONS: Weapon[] = [
  // ── Assault rifles ──
  {
    id: 'r-301', name: 'R-301 Carbine', class: 'ar', ammo: 'light', carePackage: false,
    rpm: 810, mags: [18, 20, 25, 28], barrel: true, jitterDeg: JITTER, source: APPROX,
    // Gentle climb, small right then left wobble.
    pattern: [[0, 0, 0], [5, 0.15, 1.5], [10, 0.45, 2.6], [15, 0.1, 3.3], [20, -0.35, 3.8], [28, -0.2, 4.5]],
  },
  {
    id: 'flatline', name: 'VK-47 Flatline', class: 'ar', ammo: 'heavy', carePackage: false,
    rpm: 600, mags: [20, 25, 28, 30], barrel: true, jitterDeg: JITTER, source: APPROX,
    // Up and left, then sweeps back right.
    pattern: [[0, 0, 0], [6, -0.6, 2.4], [12, -1.3, 3.3], [18, -0.2, 3.9], [24, 0.9, 4.5], [30, 0.6, 5]],
  },
  {
    id: 'havoc', name: 'Havoc', class: 'ar', ammo: 'energy', carePackage: false,
    rpm: 672, windupS: 0.27, mags: [25, 28, 30, 32], barrel: true, jitterDeg: JITTER, source: APPROX,
    // Hard vertical kick early, drifts right.
    pattern: [[0, 0, 0], [6, 0.2, 3], [12, 0.6, 4.6], [20, 0.9, 5.6], [32, 0.6, 6.6]],
  },
  {
    id: 'hemlok', name: 'Hemlok Breach AR', class: 'ar', ammo: 'heavy', carePackage: false,
    // S28 Breach rework: slow full-auto; S29 trimmed mags, S30 damage 22→21.
    rpm: 480, mags: [18, 20, 22, 25], barrel: true, jitterDeg: JITTER, source: APPROX,
    pattern: [[0, 0, 0], [5, -0.2, 2], [12, -0.4, 3.4], [25, -0.1, 4.8]],
  },
  {
    id: 'nemesis', name: 'Nemesis Burst AR', class: 'ar', ammo: 'energy', carePackage: false,
    rpm: 1100, burst: { size: 4, delayS: 0.3 }, mags: [20, 24, 27, 30], barrel: false, jitterDeg: JITTER, source: APPROX,
    pattern: [[0, 0, 0], [8, 0.3, 1.6], [16, 0.5, 2.6], [30, 0.2, 3.6]],
  },
  // ── SMGs ──
  {
    id: 'r-99', name: 'R-99 SMG', class: 'smg', ammo: 'light', carePackage: false,
    rpm: 1080, mags: [17, 20, 24, 27], barrel: true, jitterDeg: JITTER, source: APPROX,
    // Climbs fast, sways left then right.
    pattern: [[0, 0, 0], [5, -0.3, 2.2], [10, -0.8, 3.8], [15, 0.1, 5], [20, 0.7, 5.8], [27, 0.3, 6.6]],
  },
  {
    id: 'alternator', name: 'Alternator SMG', class: 'smg', ammo: 'light', carePackage: false,
    // S30: mags 20/24/26/30 → 18/20/22/26.
    rpm: 600, mags: [18, 20, 22, 26], barrel: true, jitterDeg: JITTER, source: APPROX,
    pattern: [[0, 0, 0], [8, 0.25, 1.4], [16, 0.4, 2.2], [26, 0.5, 3]],
  },
  {
    id: 'volt', name: 'Volt SMG', class: 'smg', ammo: 'energy', carePackage: false,
    rpm: 720, mags: [20, 22, 25, 27], barrel: true, jitterDeg: JITTER, source: APPROX,
    // Mostly straight up, slight right.
    pattern: [[0, 0, 0], [6, 0.1, 1.8], [13, 0.35, 3], [20, 0.45, 3.8], [27, 0.3, 4.4]],
  },
  {
    id: 'car', name: 'C.A.R. SMG', class: 'smg', ammo: 'heavy', carePackage: false,
    // S29: back on the floor, blue 25→26, purple 28→30.
    rpm: 930, mags: [20, 23, 26, 30], barrel: false, jitterDeg: JITTER, source: APPROX,
    pattern: [[0, 0, 0], [6, -0.2, 2], [12, -0.8, 3.3], [20, -0.4, 4.3], [30, 0.2, 5]],
  },
  {
    id: 'prowler', name: 'Prowler Burst PDW', class: 'smg', ammo: 'heavy', carePackage: false,
    rpm: 1200, burst: { size: 5, delayS: 0.24 }, mags: [20, 25, 28, 30], barrel: false, jitterDeg: JITTER, source: APPROX,
    pattern: [[0, 0, 0], [10, 0.4, 2.4], [20, 0.2, 3.6], [30, -0.2, 4.4]],
  },
  {
    // Selectfire Receiver: the same gun in full-auto. Separate id so its stats never mix with burst.
    id: 'prowler-auto', name: 'Prowler PDW (Full Auto)', class: 'smg', ammo: 'heavy', carePackage: false,
    rpm: 840, mags: [20, 25, 28, 30], barrel: false, jitterDeg: JITTER, source: APPROX,
    // Steady climb with a slight right then left drift.
    pattern: [[0, 0, 0], [6, 0.2, 2.2], [12, 0.45, 3.6], [20, 0.1, 4.6], [30, -0.3, 5.4]],
  },
  // ── LMGs ──
  {
    id: 'devotion', name: 'Devotion LMG', class: 'lmg', ammo: 'energy', carePackage: false,
    rpm: 900, spinUp: { fromRpm: 300, seconds: 1.1 }, mags: [36, 40, 44, 48], barrel: true, jitterDeg: JITTER, source: APPROX,
    pattern: [[0, 0, 0], [10, 0.3, 2.6], [20, 0.9, 3.8], [30, 0.6, 4.6], [48, 0.2, 5.8]],
  },
  {
    id: 'l-star', name: 'L-STAR EMG', class: 'lmg', ammo: 'energy', carePackage: true,
    // Care Package since S29; no magazine, so every tier is shots until overheat.
    rpm: 600, mags: [24, 24, 24, 24], barrel: false, jitterDeg: JITTER, source: APPROX,
    pattern: [[0, 0, 0], [8, 0.1, 1.8], [16, -0.2, 2.8], [24, -0.3, 3.4]],
  },
  {
    id: 'spitfire', name: 'M600 Spitfire', class: 'lmg', ammo: 'light', carePackage: false,
    rpm: 540, mags: [35, 40, 45, 50], barrel: true, jitterDeg: JITTER, source: APPROX,
    // Up and right, then sways back.
    pattern: [[0, 0, 0], [8, 0.4, 2.4], [16, 0.9, 3.6], [26, 0.3, 4.6], [38, -0.4, 5.4], [50, 0.1, 6]],
  },
  {
    id: 'rampage', name: 'Rampage LMG', class: 'lmg', ammo: 'heavy', carePackage: false,
    rpm: 300, mags: [26, 30, 34, 38], barrel: true, jitterDeg: JITTER, source: APPROX,
    pattern: [[0, 0, 0], [6, 0.2, 2], [14, 0.5, 3.6], [26, 0.2, 5], [38, 0, 5.8]],
  },
]

export const CLASS_LABELS = { ar: 'Assault rifles', smg: 'SMGs', lmg: 'LMGs' } as const
export const TIER_LABELS = ['None', 'White', 'Blue', 'Purple'] as const
/** Pattern multiplier per Barrel Stabilizer tier (approximate). */
export const BARREL_SCALE = [1, 0.9, 0.85, 0.8] as const
export const RANGES_M = [10, 20, 40, 60, 100, 150, 200] as const
/** Optics an AR / SMG / LMG can mount: 1x (or iron sights), 2x Bruiser, 3x Ranger, 4x (2–4x AOG). */
export const OPTICS = [1, 2, 3, 4] as const
export const SPRAY_COUNTS = [5, 10, 15] as const

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
