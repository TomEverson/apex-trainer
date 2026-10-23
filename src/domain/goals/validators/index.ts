import { z } from 'zod'

const weekStartSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const listGoalsSchema = z.object({ weekStart: weekStartSchema.optional() })

export const saveGoalSchema = z.object({
  scenarioId: z.string().min(1).max(64),
  /** Tracking: accuracy 0–1. Clicking: kills. */
  target: z.number().positive().max(1000),
  weekStart: weekStartSchema,
})
export type SaveGoalInput = z.infer<typeof saveGoalSchema>

export const deleteGoalSchema = z.object({ id: z.string().min(1).max(32) })
