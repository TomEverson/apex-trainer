import { z } from 'zod'

export const hearingModeSchema = z.enum(['direction', 'distance', 'moving', 'discrimination'])
/** Apex movement sounds: crouch-walk, jog (default move) and sprint. */
export const gaitSchema = z.enum(['crouch', 'jog', 'sprint'])
/** How sound reaches the ears: plain stereo panning, or 3D placement like a 7.1 virtualizer (Windows Sonic / Atmos / HeSuVi). */
export const renderSchema = z.enum(['stereo', 'surround'])
/** Apex's audio mix setting. Focused (default since Season 27) narrows the jog/sprint gap and ducks loud sounds around footsteps. */
export const mixSchema = z.enum(['focused', 'original'])
/** Apex-style terrain: concrete/metal (Olympus, World's Edge), wood (boardwalks), dirt/grass (Kings Canyon), sand (Storm Point). */
export const surfaceSchema = z.enum(['concrete', 'metal', 'wood', 'dirt', 'grass', 'sand'])
/** A surface, or 'mixed' = a random surface every trial, like moving around a map. */
export const surfaceChoiceSchema = z.union([surfaceSchema, z.literal('mixed')])

/** Per-device preferences (localStorage). Every field defaults so older stored values still parse. */
export const hearingSettingsSchema = z.object({
  /** Set by the headphone check when left/right came out reversed. */
  swapChannels: z.boolean().default(false),
  /** Last time the headphone check was confirmed (ISO). */
  checkedAt: z.string().nullable().default(null),
  // .catch: older stored values ('run', 'walk') fall back instead of failing the whole parse.
  gait: gaitSchema.catch('sprint'),
  render: renderSchema.catch('stereo'),
  mix: mixSchema.catch('focused'),
  /** Direction drill: some trials come through a floor (above/below). */
  floors: z.boolean().default(true),
  terrain: surfaceChoiceSchema.default('mixed'),
  /** Front half only, no behind cue. Off (default) = full 360° with the behind cue. */
  frontOnly: z.boolean().default(false),
  /** Scales the difficulty's distractor level (0 = off). */
  distractorGain: z.number().min(0).max(2).default(1),
  /** Manually locked difficulty, or null for adaptive. */
  lockedLevel: z.number().int().min(1).max(10).nullable().default(null),
  volume: z.number().min(0).max(1).default(0.8),
})

const detailValue = z.union([z.string(), z.number(), z.boolean()])

export const saveTrialSchema = z.object({
  mode: hearingModeSchema,
  level: z.number().int().min(1).max(10),
  locked: z.boolean(),
  trueValue: z.string().max(64),
  answer: z.string().max(64),
  error: z.number(),
  correct: z.boolean(),
  reactionMs: z.number().nonnegative().nullable(),
  createdAt: z.string(),
  detail: z.record(z.string(), detailValue),
})
