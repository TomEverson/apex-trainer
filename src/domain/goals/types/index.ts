export type Goal = {
  id: string
  scenarioId: string
  target: number
  weekStart: string
}

export type GoalProgress = {
  runs: number
  best: number | null
  last3Avg: number | null
  /** 3 consecutive runs this week at or above the target. */
  achieved: boolean
}

/** A scenario variant a goal can target (built by routes from the trainer's scenarios). */
export type GoalVariant = { id: string; name: string; clicking: boolean }
