import { z } from 'zod'
import {
  clickSummarySchema,
  environmentSchema,
  samplesSchema,
  scenarioSchema,
  settingsSchema,
  shotsSchema,
  summarySchema,
} from '../../../common/lib/tracking'
import { recoilDrillSchema, recoilShotsSchema, recoilSummarySchema } from '../../../common/lib/recoil'

/** What the run produced: per-frame tracking samples, or a clicking shot log (SPEC-003). */
export const runPayloadSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('tracking'), summary: summarySchema, samples: samplesSchema }),
  z.object({ kind: z.literal('clicking'), summary: clickSummarySchema, shots: shotsSchema }),
])

export const saveSessionSchema = z.object({
  scenario: scenarioSchema,
  seed: z.number().int().nonnegative(),
  degPerCount: z.number().positive(),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime(),
  settings: settingsSchema,
  environment: environmentSchema,
  tips: z.array(z.string()),
  run: runPayloadSchema,
})
export type SaveSessionInput = z.infer<typeof saveSessionSchema>

export const sessionIdSchema = z.object({ id: z.string().min(1).max(32) })

export const tipsSchema = z.array(z.string())

export const saveRecoilSessionSchema = z.object({
  drill: recoilDrillSchema,
  /** Rendered FOV while aiming (zoomed by the optic). */
  fovDeg: z.number().positive(),
  seed: z.number().int().nonnegative(),
  degPerCount: z.number().positive(),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime(),
  settings: settingsSchema,
  environment: environmentSchema,
  tips: z.array(z.string()),
  summary: recoilSummarySchema,
  shots: recoilShotsSchema,
})
