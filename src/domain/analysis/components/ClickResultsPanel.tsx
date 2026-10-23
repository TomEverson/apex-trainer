import type { ClickSummary, Tip } from '../../../common/lib/tracking'

const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toFixed(1)}%`)
const ms = (v: number | null) => (v === null ? '—' : `${Math.round(v)} ms`)

type Props = {
  title: string
  summary: ClickSummary
  tips: Tip[]
  saveStatus: string
  onRetry: () => void
  onMenu: () => void
}

/** Results for clicking scenarios (SPEC-003). */
export function ClickResultsPanel({ title, summary: s, tips, saveStatus, onRetry, onMenu }: Props) {
  const missed = s.misses.over + s.misses.under + s.misses.side
  const stats: [string, string, string][] = [
    ['Hit rate', pct(s.accuracy), `${s.kills} hits from ${s.shots} clicks`],
    ['Kills per second', s.kps.toFixed(2), `${s.durationS.toFixed(0)}s run`],
    ['Time per kill', ms(s.medianKillMs), 'Median between kills'],
    ['Short / long flicks', `${ms(s.killMsShort)} / ${ms(s.killMsLong)}`, `Split at the median flick of ${s.medianFlickDeg?.toFixed(1) ?? '—'}°`],
    ['Misses past / short / side', `${s.misses.over} / ${s.misses.under} / ${s.misses.side}`, missed ? 'Relative to the flick direction' : 'No misses'],
    ['Kills by third', s.thirds.join(' · '), 'Start · middle · end of run'],
  ]
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="my-2">
        <span className="text-6xl font-extrabold tabular-nums">{s.kills}</span>
        <span className="ml-2 text-muted">kills</span>
      </div>
      <p className="text-sm text-muted">{saveStatus}</p>

      <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
        {stats.map(([k, v, d]) => (
          <div key={k} className="rounded-xl border border-line bg-surface p-3">
            <div className="text-xl font-bold tabular-nums">{v}</div>
            <div className="mt-0.5 text-xs text-ink-2">{k}</div>
            <div className="mt-1 text-[11px] leading-snug text-muted">{d}</div>
          </div>
        ))}
      </div>

      <h3 className="mt-7 mb-2.5 text-sm tracking-wider text-ink-2 uppercase">What to work on</h3>
      <ul className="list-disc space-y-2 pl-5 leading-relaxed text-ink-2">
        {tips.map((t) => <li key={t.key}>{t.text}</li>)}
      </ul>

      <div className="mt-7 flex gap-2">
        <button onClick={onRetry} className="rounded-lg bg-accent px-4 py-2.5 font-semibold text-white">Retry (R)</button>
        <button onClick={onMenu} className="rounded-lg border border-line bg-surface-2 px-4 py-2.5 font-semibold">Menu (M)</button>
      </div>
    </div>
  )
}
