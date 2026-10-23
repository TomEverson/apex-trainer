/**
 * Recoil Control persistence (SPEC-006). One recoil_session row per drill +
 * its shot log in recoil_shots, written atomically in a single D1 batch.
 */
import { createServerFn } from '@tanstack/react-start'
import type { Selectable } from 'kysely'
import { ulid } from 'ulidx'
import { getDb } from '../../../server/db'
import { getCloudflareEnv } from '../../../server/env'
import { environmentSchema, settingsSchema } from '../../../common/lib/tracking'
import { recoilDrillSchema, recoilShotsSchema, recoilSummarySchema, type RecoilSessionRow, type RecoilShots } from '../../../common/lib/recoil'
import type { RecoilSession } from '../../../../kysely-types'
import { saveRecoilSessionSchema, sessionIdSchema, tipsSchema } from '../validators'

function rowToRecoilSession(r: Selectable<RecoilSession>): RecoilSessionRow | null {
  const json = (s: string): unknown => JSON.parse(s)
  const drill = recoilDrillSchema.safeParse(json(r.drillJson))
  const settings = settingsSchema.safeParse(json(r.settingsJson))
  const environment = environmentSchema.safeParse(json(r.environmentJson))
  const summary = recoilSummarySchema.safeParse(json(r.summaryJson))
  const tips = tipsSchema.safeParse(json(r.tipsJson))
  if (!r.id || !drill.success || !settings.success || !environment.success || !summary.success || !tips.success) {
    console.warn(`recoil session ${r.id}: stored JSON no longer matches schema, skipping`)
    return null
  }
  return {
    id: r.id,
    drill: drill.data,
    degPerCount: r.degPerCount,
    seed: r.seed,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    settings: settings.data,
    environment: environment.data,
    summary: summary.data,
    tips: tips.data,
  }
}

export const saveRecoilSessionFn = createServerFn({ method: 'POST' })
  .validator(saveRecoilSessionSchema)
  .handler(async ({ data }): Promise<{ id: string }> => {
    const id = ulid()
    const s = data.summary
    const db = getDb()
    const insertSession = db
      .insertInto('recoilSession')
      .values({
        id,
        drillId: data.drill.id,
        weaponId: data.drill.weapon.id,
        drillJson: JSON.stringify(data.drill),
        seed: data.seed,
        startedAt: data.startedAt,
        endedAt: data.endedAt,
        degPerCount: data.degPerCount,
        fov: data.fovDeg,
        settingsJson: JSON.stringify(data.settings),
        environmentJson: JSON.stringify(data.environment),
        sprays: s.sprays,
        shots: s.shots,
        hitRate: s.hitRate,
        meanErrDeg: s.meanErrDeg,
        vertBiasDeg: s.vertBiasDeg,
        horizBiasDeg: s.horizBiasDeg,
        vertComp: s.vertComp,
        horizComp: s.horizComp,
        summaryJson: JSON.stringify(s),
        tipsJson: JSON.stringify(data.tips),
        createdAt: new Date().toISOString(),
      })
      .compile()
    const insertShots = db
      .insertInto('recoilShots')
      .values({ sessionId: id, shotsJson: JSON.stringify(data.shots) })
      .compile()
    // Kysely's D1 dialect has no transactions; D1 batch() is atomic.
    const d1 = getCloudflareEnv().DB
    await d1.batch([insertSession, insertShots].map((q) => d1.prepare(q.sql).bind(...q.parameters)))
    return { id }
  })

export const listRecoilSessionsFn = createServerFn().handler(async (): Promise<RecoilSessionRow[]> => {
  const rows = await getDb().selectFrom('recoilSession').selectAll().orderBy('startedAt', 'asc').execute()
  return rows.map(rowToRecoilSession).filter((r): r is RecoilSessionRow => r !== null)
})

export const getRecoilShotsFn = createServerFn()
  .validator(sessionIdSchema)
  .handler(async ({ data }): Promise<RecoilShots> => {
    const row = await getDb()
      .selectFrom('recoilShots')
      .select('shotsJson')
      .where('sessionId', '=', data.id)
      .executeTakeFirst()
    if (!row) throw new Error(`shots for recoil session ${data.id} not found`)
    return recoilShotsSchema.parse(JSON.parse(row.shotsJson))
  })
