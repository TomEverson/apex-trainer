import type { z } from 'zod'
import type { gaitSchema, hearingModeSchema, hearingSettingsSchema, mixSchema, renderSchema, saveTrialSchema, surfaceChoiceSchema, surfaceSchema } from '../validators'

export type HearingMode = z.infer<typeof hearingModeSchema>
export type Gait = z.infer<typeof gaitSchema>
export type Render = z.infer<typeof renderSchema>
export type Mix = z.infer<typeof mixSchema>
export type Surface = z.infer<typeof surfaceSchema>
export type SurfaceChoice = z.infer<typeof surfaceChoiceSchema>
export type HearingSettings = z.infer<typeof hearingSettingsSchema>
export type SaveTrialInput = z.infer<typeof saveTrialSchema>
