/** Weekly goals (SPEC-004). One row per scenario variant per week. */
import { createServerFn } from '@tanstack/react-start'
import { ulid } from 'ulidx'
import { getDb } from '../../../server/db'
import { deleteGoalSchema, listGoalsSchema, saveGoalSchema } from '../validators'
import type { Goal } from '../types'

export const listGoalsFn = createServerFn()
  .validator(listGoalsSchema)
  .handler(async ({ data }): Promise<Goal[]> => {
    let q = getDb().selectFrom('goal').select(['id', 'scenarioId', 'target', 'weekStart']).orderBy('scenarioId')
    if (data.weekStart) q = q.where('weekStart', '=', data.weekStart)
    const rows = await q.execute()
    return rows.flatMap((r) => (r.id ? [{ id: r.id, scenarioId: r.scenarioId, target: r.target, weekStart: r.weekStart }] : []))
  })

export const saveGoalFn = createServerFn({ method: 'POST' })
  .validator(saveGoalSchema)
  .handler(async ({ data }): Promise<void> => {
    const now = new Date().toISOString()
    await getDb()
      .insertInto('goal')
      .values({ id: ulid(), scenarioId: data.scenarioId, target: data.target, weekStart: data.weekStart, createdAt: now, updatedAt: now })
      .onConflict((oc) => oc.columns(['scenarioId', 'weekStart']).doUpdateSet({ target: data.target, updatedAt: now }))
      .execute()
  })

export const deleteGoalFn = createServerFn({ method: 'POST' })
  .validator(deleteGoalSchema)
  .handler(async ({ data }): Promise<void> => {
    await getDb().deleteFrom('goal').where('id', '=', data.id).execute()
  })
