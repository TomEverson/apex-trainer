/**
 * LLM-ready Markdown report (SPEC-002). Pure: takes stored runs, returns a
 * prompt with metric definitions + compact per-scenario tables.
 */
import { sensLabel, type ClickingSessionRow, type SessionRow, type TrackingSessionRow } from '../../../common/lib/tracking'

const METRIC_GUIDE = `Metric definitions (angles in degrees, measured from the crosshair to the target centre):
- acc: fraction of time the crosshair was on the target (main score).
- steady / postTurn: accuracy while the target keeps its direction vs. in the 350ms after a sharp direction change.
- lag: mean error along the target's direction of travel. Positive = crosshair trails behind, negative = runs ahead. lagR = lag ÷ target angular radius.
- cross: mean error perpendicular to the target's motion.
- spd: crosshair speed ÷ target speed along its motion (1.00 = matched; <1 under-tracking, >1 over-tracking).
- react: median ms after a reversal until the crosshair moves the new way at ≥50% of target speed.
- reacq: median ms after a reversal until back on target for ≥100ms.
- over: mean overshoot (crosshair ahead of target) within 400ms after a reversal.
- hErr / vErr: mean absolute horizontal / vertical error.
- L/R, U/D: accuracy while the target moves left/right, up/down.
- slow/fast: accuracy in the slowest / fastest third of target angular speed.
- thirds: accuracy in the first / middle / last third of the run (fatigue / warm-up).
- jit: crosshair micro-correction noise in °/s (lower = smoother).
- °/count: degrees the camera turns per mouse count (game yaw × sens). Higher = faster sensitivity.
- Clicking scenarios (Tile Frenzy): kills, shots, hit% = kills ÷ shots, kills/s, ms/kill = median time between kills, flick° = median angle from the previous kill to the next target, ms short/long = median kill time for flicks shorter/longer than that median, misses over/under/side = where misses landed relative to the flick direction (past the target / short of it / beside it).
- acquire / settle (Reacquire scenario only): median ms after a sudden 5–12° target jump until first on target / until held ≥100ms. settle − acquire = time spent overshooting and correcting.`

const p = (v: number | null | undefined) => (v == null ? '-' : (v * 100).toFixed(0))
const f = (v: number | null | undefined, d = 2) => (v == null ? '-' : v.toFixed(d))

function avg(values: (number | null)[]): number | null {
  const vals = values.filter((v): v is number => v !== null)
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

export function buildReport(sessions: SessionRow[], { perScenario = 15 } = {}): string {
  const runs = [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  const lines: string[] = [
    '# Aim training data',
    '',
    "You are an aim coach for FPS games. Below is my practice data (mostly tracking, plus some clicking) from a custom trainer (similar to KovaaK's). My scores are not improving.",
    'Please: (1) identify my 2–3 biggest weaknesses with evidence from the numbers, (2) say whether I am improving and where I plateau,',
    '(3) check whether my sensitivity looks like a problem, and (4) give me a concrete weekly routine using the scenarios listed.',
    '',
  ]
  const last = runs.at(-1)
  if (!last) {
    lines.push('_No sessions recorded yet._')
    return lines.join('\n')
  }

  const sensSet = new Set(runs.map((s) => s.degPerCount.toFixed(4)))
  lines.push(
    '## Setup',
    `- Total runs: ${runs.length}, from ${runs[0].startedAt.slice(0, 10)} to ${last.startedAt.slice(0, 10)}`,
    `- Current: ${sensLabel(last.settings)} (${last.degPerCount.toFixed(4)}° per mouse count), FOV ${last.settings.fov}, ${last.settings.duration}s runs`,
    `- Distinct sensitivities used (°/count): ${sensSet.size} (${[...sensSet].join(', ')})`,
    `- Raw input: ${last.environment.rawInput ? 'yes' : 'no (OS acceleration may apply)'}, ~${last.environment.avgFps} fps`,
    '',
    METRIC_GUIDE,
    '',
  )

  const byScenario = new Map<string, SessionRow[]>()
  for (const s of runs) byScenario.set(s.scenario.id, [...(byScenario.get(s.scenario.id) ?? []), s])

  for (const group of byScenario.values()) {
    const sc = group[0].scenario
    const tipCounts = new Map<string, number>()
    for (const r of group) for (const t of r.tips) tipCounts.set(t, (tipCounts.get(t) ?? 0) + 1)
    const topTips = [...tipCounts].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `${k}×${n}`)
    const tracking = group.filter((r): r is TrackingSessionRow => r.kind === 'tracking')
    const clicking = group.filter((r): r is ClickingSessionRow => r.kind === 'clicking')

    lines.push(`## ${sc.name} — ${sc.focus}`)
    if (clicking.length) {
      const g = sc.tiles
      const kills = clicking.map((r) => r.summary.kills)
      lines.push(
        `${sc.description} (clicking; ${g ? `${g.cols}×${g.rows} tiles ${g.spacingDeg}° apart, ${g.count} live targets` : 'static targets'}, radius ${sc.radius}m at ${sc.dist}m)`,
        `Runs: ${clicking.length}. First-5 avg kills ${f(avg(kills.slice(0, 5)), 1)}, last-5 avg ${f(avg(kills.slice(-5)), 1)}, best ${Math.max(...kills)}.`,
      )
    } else {
      const accs = tracking.map((r) => r.summary.accuracy)
      lines.push(
        `${sc.description} (distance ${sc.dist}m, radius ${sc.radius}m, speed ${sc.speed.join('–')} m/s, direction change every ${sc.interval.join('–')}s)`,
        `Runs: ${tracking.length}. First-5 avg acc ${p(avg(accs.slice(0, 5)))}%, last-5 avg ${p(avg(accs.slice(-5)))}%, best ${p(Math.max(...accs.map((a) => a ?? 0)))}%.`,
      )
    }
    if (topTips.length) lines.push(`Auto-detected issues (count of runs): ${topTips.join(', ')}`)

    if (clicking.length) {
      lines.push(
        '',
        '| date | °/count | kills | shots | hit% | kills/s | ms/kill | flick° | ms short/long | misses over/under/side | thirds (kills) |',
        '|---|---|---|---|---|---|---|---|---|---|---|',
      )
      for (const r of clicking.slice(-perScenario)) {
        const s = r.summary
        lines.push(
          `| ${r.startedAt.slice(5, 16).replace('T', ' ')} | ${f(r.degPerCount, 4)} | ${s.kills} | ${s.shots} | ${p(s.accuracy)} | ${f(s.kps)} | ${f(s.medianKillMs, 0)} | ${f(s.medianFlickDeg, 1)} | ${f(s.killMsShort, 0)}/${f(s.killMsLong, 0)} | ${s.misses.over}/${s.misses.under}/${s.misses.side} | ${s.thirds.join('/')} |`,
        )
      }
      lines.push('')
      continue
    }

    lines.push(
      '',
      '| date | °/count | acc | steady | postTurn | lag | lagR | cross | spd | react | reacq | over | hErr | vErr | L/R | U/D | slow/fast | thirds | jit |',
      '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    )
    for (const r of tracking.slice(-perScenario)) {
      const s = r.summary
      lines.push(
        `| ${r.startedAt.slice(5, 16).replace('T', ' ')} | ${f(r.degPerCount, 4)} | ${p(s.accuracy)} | ${p(s.steadyAccuracy)} | ${p(s.turnAccuracy)} | ${f(s.lagDeg)} | ${f(s.lagRadii)} | ${f(s.crossTrackDeg)} | ${f(s.velocityMatch)} | ${f(s.reaction.medianReactionMs, 0)} | ${f(s.reaction.medianRecoveryMs, 0)} | ${f(s.reaction.meanOvershootDeg)} | ${f(s.horizErrDeg)} | ${f(s.vertErrDeg)} | ${p(s.dirAccuracy.left)}/${p(s.dirAccuracy.right)} | ${p(s.dirAccuracy.up)}/${p(s.dirAccuracy.down)} | ${p(s.speedAccuracy.slow)}/${p(s.speedAccuracy.fast)} | ${s.thirds.map(p).join('/')} | ${f(s.jitterDegS, 1)} |`,
      )
    }
    const rq = tracking.slice(-perScenario).filter((r) => r.summary.reacquire)
    if (rq.length) {
      lines.push('', `Reacquire per run (acquire/settle ms, missed jumps): ${rq.map((r) => `${f(r.summary.reacquire?.medianAcquireMs, 0)}/${f(r.summary.reacquire?.medianSettleMs, 0)} (${r.summary.reacquire?.missed ?? 0})`).join(', ')}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}
