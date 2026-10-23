import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useCallback } from 'react'
import { weekStartOf } from '../common/lib/week'
import { SCENARIOS, withSpeed } from '../domain/trainer'
import { listSessionsFn } from '../domain/sessions'
import { deleteGoalFn, GoalsPage, listGoalsFn, saveGoalFn, type GoalVariant } from '../domain/goals'
import { TARGET_SPEEDS } from '../domain/settings'

export const Route = createFileRoute('/_menu/goals')({
  // "This week" is the player's local week, so compute it in the browser.
  ssr: false,
  loader: async () => {
    const weekStart = weekStartOf(new Date())
    const [goals, sessions] = await Promise.all([listGoalsFn({ data: { weekStart } }), listSessionsFn()])
    return { weekStart, goals, sessions }
  },
  component: GoalsRoute,
})

// Every scenario at every speed (clicking scenarios have no speed variants).
const VARIANTS: GoalVariant[] = SCENARIOS.flatMap((base): GoalVariant[] =>
  base.mode === 'tiles'
    ? [{ id: base.id, name: base.name, clicking: true }]
    : TARGET_SPEEDS.map((m) => {
        const sc = withSpeed(base, m)
        return { id: sc.id, name: m === 1 ? `${sc.name} (1×)` : sc.name, clicking: false }
      }),
)

function GoalsRoute() {
  const { weekStart, goals, sessions } = Route.useLoaderData()
  const router = useRouter()
  const onSave = useCallback(async (scenarioId: string, target: number) => {
    await saveGoalFn({ data: { scenarioId, target, weekStart } })
    await router.invalidate()
  }, [router, weekStart])
  const onDelete = useCallback(async (id: string) => {
    await deleteGoalFn({ data: { id } })
    await router.invalidate()
  }, [router])

  return <GoalsPage goals={goals} sessions={sessions} weekStart={weekStart} variants={VARIANTS} onSave={onSave} onDelete={onDelete} />
}
