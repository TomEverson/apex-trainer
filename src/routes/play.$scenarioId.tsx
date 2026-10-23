import { createFileRoute, notFound, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ClickSummary, Summary, Tip } from '../common/lib/tracking'
import { exitFullscreen, toggleFullscreen } from '../common/lib/fullscreen'
import { getScenario, TrainerView, withSpeed, type Drill, type RunResult } from '../domain/trainer'
import {
  ClickResultsPanel,
  computeClickSummary,
  computeSummary,
  diagnose,
  diagnoseClicks,
  downsample,
  ResultsPanel,
} from '../domain/analysis'
import { saveSessionFn } from '../domain/sessions'
import { degPerCount, degPerUnit, useSettings } from '../domain/settings'

export const Route = createFileRoute('/play/$scenarioId')({
  loader: ({ params }) => {
    const scenario = getScenario(params.scenarioId)
    if (!scenario) throw notFound()
    return { scenario }
  },
  ssr: false, // canvas + pointer lock + localStorage settings are browser-only
  component: PlayRoute,
})

type Result =
  | { kind: 'tracking'; summary: Summary | null; tips: Tip[]; saveStatus: string }
  | { kind: 'clicking'; summary: ClickSummary; tips: Tip[]; saveStatus: string }

function PlayRoute() {
  const { scenario: base } = Route.useLoaderData()
  const navigate = useNavigate()
  const { settings, ready } = useSettings()
  const [runKey, setRunKey] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  // Stored: true degrees per count. Input: per reported unit (corrected by the Mouse check).
  const dpc = useMemo(() => degPerCount(settings), [settings])
  const dpu = useMemo(() => degPerUnit(settings), [settings])
  const scenario = useMemo(() => withSpeed(base, settings.targetSpeed), [base, settings.targetSpeed])
  const drill = useMemo((): Drill => ({ kind: 'scenario', scenario }), [scenario])

  const retry = useCallback(() => {
    setResult(null)
    setRunKey((k) => k + 1)
  }, [])
  const toMenu = useCallback(() => navigate({ to: '/' }), [navigate])

  const onFinish = useCallback(async (result: RunResult) => {
    const { run } = result
    if (run.kind === 'recoil') return
    const meta = {
      scenario, seed: result.seed, degPerCount: dpc, startedAt: result.startedAt, endedAt: result.endedAt,
      settings, environment: result.environment,
    }
    let data
    if (run.kind === 'clicking') {
      const summary = computeClickSummary(run.shots, settings.duration)
      const tips = diagnoseClicks(summary)
      setResult({ kind: 'clicking', summary, tips, saveStatus: 'Saving…' })
      data = { ...meta, tips: tips.map((t) => t.key), run: { kind: 'clicking' as const, summary, shots: run.shots } }
    } else {
      // Metrics on full-rate samples; storage gets the 60 Hz downsample.
      const summary = computeSummary(run.samples)
      const tips = diagnose(summary)
      setResult({ kind: 'tracking', summary, tips, saveStatus: summary ? 'Saving…' : 'Not saved (run too short).' })
      if (!summary) return
      data = { ...meta, tips: tips.map((t) => t.key), run: { kind: 'tracking' as const, summary, samples: downsample(run.samples) } }
    }
    try {
      const { id } = await saveSessionFn({ data })
      setResult((r) => r && { ...r, saveStatus: `Saved as session ${id}` })
    } catch (err) {
      setResult((r) => r && { ...r, saveStatus: `Could not save: ${err instanceof Error ? err.message : String(err)}` })
    }
  }, [scenario, settings, dpc])

  // Leaving the scenario (menu, back button) exits fullscreen.
  useEffect(() => () => void exitFullscreen(), [])

  useEffect(() => {
    if (!result) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') retry()
      if (e.key === 'm' || e.key === 'M') toMenu()
      if ((e.key === 'f' || e.key === 'F') && !e.repeat) void toggleFullscreen()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [result, retry, toMenu])

  if (!ready) return null
  if (result?.kind === 'clicking') {
    return (
      <ClickResultsPanel title={scenario.name} summary={result.summary} tips={result.tips}
        saveStatus={result.saveStatus} onRetry={retry} onMenu={toMenu} />
    )
  }
  if (result) {
    return (
      <ResultsPanel title={scenario.name} summary={result.summary} tips={result.tips}
        saveStatus={result.saveStatus} onRetry={retry} onMenu={toMenu} />
    )
  }
  return (
    <TrainerView key={runKey} drill={drill} settings={settings} degPerUnit={dpu}
      onFinish={onFinish} onAbort={toMenu} />
  )
}
