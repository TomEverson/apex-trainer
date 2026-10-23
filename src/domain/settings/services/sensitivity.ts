import { settingsSchema, type Game, type Settings } from '../../../common/lib/tracking'

/**
 * Degrees of yaw per mouse count at sensitivity 1. Games turn the camera by
 * counts × yaw × sens, so presets need no DPI — the browser receives the same
 * raw counts the game would.
 */
export const YAW: Record<Exclude<Game, 'custom'>, number> = {
  valorant: 0.07,
  cs2: 0.022,
  apex: 0.022,
  overwatch: 0.0066,
  fortnite: 0.005555,
}

export const GAME_LABELS: Record<Game, string> = {
  valorant: 'Valorant',
  cs2: 'CS2 / TF2',
  apex: 'Apex Legends',
  overwatch: 'Overwatch 2',
  fortnite: 'Fortnite (X/Y %)',
  custom: 'Custom cm/360',
}

/** Degrees of camera rotation per real mouse count (what the game would do). */
export function degPerCount(s: Settings): number {
  if (s.game === 'custom') return 360 / ((s.cm360 / 2.54) * s.dpi)
  return YAW[s.game] * s.sens
}

/**
 * Degrees per unit the browser actually reports in movementX. Differs from
 * degPerCount when the OS scales/accelerates input (see the Mouse check).
 */
export function degPerUnit(s: Settings): number {
  return degPerCount(s) / s.inputScale
}

export const DEFAULT_SETTINGS: Settings = {
  game: 'valorant',
  sens: 0.35,
  dpi: 800,
  cm360: 35,
  inputScale: 1,
  targetSpeed: 1,
  fov: 103,
  duration: 60,
  crosshairSize: 4,
  showHud: true,
  autoFullscreen: true,
  countdownS: 2,
  recoil: { rangeM: 20, target: 'static', magTier: 2, barrelTier: 0, sprays: 5, adsScale: 1, zoom: 1 },
}

/** Target speed multipliers offered in Settings (and as goal variants). */
export const TARGET_SPEEDS = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.25, 1.5]

const STORAGE_KEY = 'aim-trainer:settings'

// Settings are per device (they depend on the mouse), so localStorage rather than D1.
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = settingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) })
    return parsed.success ? parsed.data : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    // Storage unavailable (private mode) — settings just won't persist.
  }
}
