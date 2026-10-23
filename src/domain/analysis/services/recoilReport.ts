/**
 * LLM-ready Markdown report for Recoil Control (SPEC-006). Pure: takes stored
 * recoil runs, returns a prompt with metric definitions + per-drill tables.
 */
import type { RecoilSessionRow } from '../../../common/lib/recoil'

const METRIC_GUIDE = `Metric definitions (angles in degrees, bullet direction minus the target's centre; vertical + = above, horizontal + = right):
- hit%: bullets on the target (a legend-sized pill, 1.9 m tall, 0.64 m wide) ÷ bullets fired. Main score.
- vComp / hComp: share of the weapon's recoil pattern cancelled by the player's pull. 100 = fully cancelled, 0 = no pull, <0 = made it worse, >100 = over-pulled. hComp is blank when the pattern has little sideways movement.
- err: mean angular distance from the target centre. vBias / hBias: mean signed error (vBias > 0 = not pulling down enough).
- early / mid / late err: mean error in the first / middle / last third of each spray.
- first: error of each spray's first bullet (aim before firing, not recoil).
- consist: how differently the sprays went, bullet for bullet (lower = the same pull every time).
- °/count: degrees per mouse count while aiming (after ADS multiplier and optic zoom).
- Each run is 5 full-magazine sprays. Patterns are Firing Range captures; "pattern" says how current the capture is (measured / outdated / estimate).`

const p = (v: number | null | undefined) => (v == null ? '-' : (v * 100).toFixed(0))
const f = (v: number | null | undefined, d = 2) => (v == null ? '-' : v.toFixed(d))

export function buildRecoilReport(sessions: RecoilSessionRow[], { perDrill = 15 } = {}): string {
  const runs = [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  const lines: string[] = [
    '# Recoil control training data (Apex Legends)',
    '',
    'You are an Apex Legends aim coach. Below is my recoil-control practice from a custom trainer: I spray full magazines at a static or strafing target and pull against each weapon\'s recoil pattern.',
    'Please: (1) say for each weapon whether I under-pull, over-pull or lose control late in the spray, with evidence from the numbers, (2) point out sideways drift,',
    '(3) say whether I am improving, and (4) give me a concrete practice plan (weapons, ranges, optics).',
    '',
  ]
  const last = runs.at(-1)
  if (!last) {
    lines.push('_No recoil runs recorded yet._')
    return lines.join('\n')
  }
  lines.push(
    '## Setup',
    `- Total runs: ${runs.length}, from ${runs[0].startedAt.slice(0, 10)} to ${last.startedAt.slice(0, 10)}`,
    `- Current hip-fire FOV ${last.settings.fov}, raw input ${last.environment.rawInput ? 'yes' : 'no'}, ~${last.environment.avgFps} fps`,
    '',
    METRIC_GUIDE,
    '',
  )

  const byDrill = new Map<string, RecoilSessionRow[]>()
  for (const r of runs) byDrill.set(r.drill.id, [...(byDrill.get(r.drill.id) ?? []), r])
  for (const group of byDrill.values()) {
    const d = group[0].drill
    const tipCounts = new Map<string, number>()
    for (const r of group) for (const t of r.tips) tipCounts.set(t, (tipCounts.get(t) ?? 0) + 1)
    const topTips = [...tipCounts].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `${k}×${n}`)
    lines.push(
      `## ${d.name}`,
      `${d.weapon.class.toUpperCase()}, ${d.weapon.rpm} rpm, ${d.magSize} rounds, barrel tier ${d.barrelTier}, ${d.zoom}x optic, ${d.target} target at ${d.rangeM} m. Pattern: ${d.weapon.confidence} (${d.weapon.source}).`,
    )
    if (topTips.length) lines.push(`Auto-detected issues (count of runs): ${topTips.join(', ')}`)
    lines.push(
      '',
      '| date | °/count | hit% | vComp | hComp | err | vBias | hBias | early/mid/late err | first | consist |',
      '|---|---|---|---|---|---|---|---|---|---|---|',
    )
    for (const r of group.slice(-perDrill)) {
      const s = r.summary
      lines.push(
        `| ${r.startedAt.slice(5, 16).replace('T', ' ')} | ${f(r.degPerCount, 4)} | ${p(s.hitRate)} | ${p(s.vertComp)} | ${p(s.horizComp)} | ${f(s.meanErrDeg)} | ${f(s.vertBiasDeg)} | ${f(s.horizBiasDeg)} | ${f(s.phases.early.meanErrDeg)}/${f(s.phases.mid.meanErrDeg)}/${f(s.phases.late.meanErrDeg)} | ${f(s.firstShotErrDeg)} | ${f(s.consistencyDeg)} |`,
      )
    }
    lines.push('')
  }
  return lines.join('\n')
}
