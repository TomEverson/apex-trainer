import type { HearingSettings } from '../types'
import { hearingSettingsSchema } from '../validators'

const STORAGE_KEY = 'aim-trainer:hearing-settings'

export const DEFAULT_HEARING_SETTINGS: HearingSettings = hearingSettingsSchema.parse({})

// Per device (they depend on the headphones), so localStorage rather than D1.
export function loadHearingSettings(): HearingSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_HEARING_SETTINGS
    const parsed = hearingSettingsSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : DEFAULT_HEARING_SETTINGS
  } catch {
    return DEFAULT_HEARING_SETTINGS
  }
}

export function saveHearingSettings(s: HearingSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    // Storage unavailable (private mode) — settings just won't persist.
  }
}
