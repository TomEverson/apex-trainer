/** Direction drill (SPEC-005 mode 1), pure parts. */

/** Angles on the level's grid: the full circle, or the front half [−90, 90]. */
export function candidateAngles(stepDeg: number, frontOnly: boolean): number[] {
  const behind = !frontOnly
  const out: number[] = []
  const lo = behind ? -180 + stepDeg : -90
  const hi = behind ? 180 : 90
  for (let a = 0; a <= hi + 1e-9; a += stepDeg) out.push(a)
  for (let a = -stepDeg; a >= lo - 1e-9; a -= stepDeg) out.push(a)
  return out
}

/** Random grid angle, never the same as the previous trial's. */
export function pickAngle(stepDeg: number, frontOnly: boolean, prev: number | null, rand: () => number): number {
  const options = candidateAngles(stepDeg, frontOnly).filter((a) => a !== prev)
  return options[Math.floor(rand() * options.length)]
}
