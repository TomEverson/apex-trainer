/**
 * Session persistence (SPEC-002). One D1 row per run + its raw samples in
 * session_samples, written atomically in a single D1 batch.
 * JSON columns are parsed back through the shared Zod schemas — no casts.
 */
import { createServerFn } from '@tanstack/react-start'
import type { Selectable } from 'kysely'
import { ulid } from 'ulidx'
import { z } from 'zod'
import { getDb } from '../../../server/db'
import { getCloudflareEnv } from '../../../server/env'
import {
  clickSummarySchema,
  environmentSchema,
  isClicking,
  samplesSchema,
  scenarioSchema,
  settingsSchema,
  shotsSchema,
  summarySchema,
  type Samples,
  type SessionRow,
  type Shots,
} from '../../../common/lib/tracking'
import type { Session } from '../../../../kysely-types'
import { saveSessionSchema, sessionIdSchema, tipsSchema } from '../validators'

function rowToSession(r: Selectable<Session>): SessionRow | null {
  const json = (s: string): unknown => JSON.parse(s)
  const scenario = scenarioSchema.safeParse(json(r.scenarioJson))
  const settings = settingsSchema.safeParse(json(r.settingsJson))
  const environment = environmentSchema.safeParse(json(r.environmentJson))
  const tips = tipsSchema.safeParse(json(r.tipsJson))
  const skip = () => {
    console.warn(`session ${r.id}: stored JSON no longer matches schema, skipping`)
    return null
  }
  if (!r.id || !scenario.success || !settings.success || !environment.success || !tips.success) return skip()
  const base = {
    id: r.id,
    degPerCount: r.degPerCount,
    scenario: scenario.data,
    seed: r.seed,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    settings: settings.data,
    environment: environment.data,
    tips: tips.data,
  }
  // The scenario's mode decides which summary shape the row holds (SPEC-003).
  if (isClicking(scenario.data)) {
    const summary = clickSummarySchema.safeParse(json(r.summaryJson))
    return summary.success ? { ...base, kind: 'clicking', summary: summary.data } : skip()
  }
  const summary = summarySchema.safeParse(json(r.summaryJson))
  return summary.success ? { ...base, kind: 'tracking', summary: summary.data } : skip()
}

export const saveSessionFn = createServerFn({ method: 'POST' })
  .validator(saveSessionSchema)
  .handler(async ({ data }): Promise<{ id: string }> => {
    const id = ulid()
    const { run } = data
    // Tracking-only metric columns stay NULL for clicking runs.
    const t = run.kind === 'tracking' ? run.summary : null
    const db = getDb()
    const insertSession = db
      .insertInto('session')
      .values({
        id,
        scenarioId: data.scenario.id,
        scenarioName: data.scenario.name,
        scenarioJson: JSON.stringify(data.scenario),
        seed: data.seed,
        startedAt: data.startedAt,
        endedAt: data.endedAt,
        durationS: run.summary.durationS,
        degPerCount: data.degPerCount,
        fov: data.settings.fov,
        settingsJson: JSON.stringify(data.settings),
        environmentJson: JSON.stringify(data.environment),
        accuracy: run.summary.accuracy,
        steadyAccuracy: t?.steadyAccuracy ?? null,
        turnAccuracy: t?.turnAccuracy ?? null,
        lagDeg: t?.lagDeg ?? null,
        velocityMatch: t?.velocityMatch ?? null,
        reactionMs: t?.reaction.medianReactionMs ?? null,
        jitterDegS: t?.jitterDegS ?? null,
        summaryJson: JSON.stringify(run.summary),
        tipsJson: JSON.stringify(data.tips),
        createdAt: new Date().toISOString(),
      })
      .compile()
    const insertSamples = db
      .insertInto('sessionSamples')
      .values({ sessionId: id, samplesJson: JSON.stringify(run.kind === 'tracking' ? run.samples : run.shots) })
      .compile()
    // Kysely's D1 dialect has no transactions; D1 batch() is atomic.
    const d1 = getCloudflareEnv().DB
    await d1.batch([insertSession, insertSamples].map((q) => d1.prepare(q.sql).bind(...q.parameters)))
    return { id }
  })

export const listSessionsFn = createServerFn().handler(async (): Promise<SessionRow[]> => {
  const rows = await getDb().selectFrom('session').selectAll().orderBy('startedAt', 'asc').execute()
  return rows.map(rowToSession).filter((r): r is SessionRow => r !== null)
})

export const getSessionSamplesFn = createServerFn()
  .validator(sessionIdSchema)
  .handler(async ({ data }): Promise<Samples | Shots> => {
    const row = await getDb()
      .selectFrom('sessionSamples')
      .select('samplesJson')
      .where('sessionId', '=', data.id)
      .executeTakeFirst()
    if (!row) throw new Error(`samples for session ${data.id} not found`)
    return z.union([samplesSchema, shotsSchema]).parse(JSON.parse(row.samplesJson))
  })
