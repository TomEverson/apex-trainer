/** Hearing trial persistence (SPEC-005). One D1 row per trial. */
import { createServerFn } from '@tanstack/react-start'
import { ulid } from 'ulidx'
import { getDb } from '../../../server/db'
import { saveTrialSchema } from '../validators'

export const saveTrialFn = createServerFn({ method: 'POST' })
  .validator(saveTrialSchema)
  .handler(async ({ data }): Promise<{ id: string }> => {
    const id = ulid()
    await getDb()
      .insertInto('hearingTrial')
      .values({
        id,
        mode: data.mode,
        level: data.level,
        locked: data.locked ? 1 : 0,
        trueValue: data.trueValue,
        answer: data.answer,
        error: data.error,
        correct: data.correct ? 1 : 0,
        reactionMs: data.reactionMs,
        detailJson: JSON.stringify(data.detail),
        createdAt: data.createdAt,
      })
      .execute()
    return { id }
  })
