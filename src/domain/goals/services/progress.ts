import { scoreOf, type SessionRow } from '../../../common/lib/tracking'
import { weekStartOf } from '../../../common/lib/week'
import type { Goal, GoalProgress } from '../types'

/** Progress toward a goal from this week's runs of exactly that scenario variant. */
export function goalProgress(goal: Goal, sessions: SessionRow[]): GoalProgress {
  const scores = sessions
    .filter((s) => s.scenario.id === goal.scenarioId && weekStartOf(new Date(s.startedAt)) === goal.weekStart)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map(scoreOf)
  const last3 = scores.slice(-3)
  let streak = 0, achieved = false
  for (const v of scores) {
    streak = v >= goal.target ? streak + 1 : 0
    if (streak >= 3) achieved = true
  }
  return {
    runs: scores.length,
    best: scores.length ? Math.max(...scores) : null,
    last3Avg: last3.length ? last3.reduce((a, b) => a + b, 0) / last3.length : null,
    achieved,
  }
}
