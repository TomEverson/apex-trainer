import { createFileRoute, notFound, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RecoilShots, RecoilSummary } from '../common/lib/recoil'
import type { Tip } from '../common/lib/tracking'
import { exitFullscreen, toggleFullscreen } from '../common/lib/fullscreen'
import { buildDrill, getWeapon, TrainerView, zoomedFov, type Drill, type RunResult } from '../domain/trainer'
import { computeRecoilSummary, diagnoseRecoil, RecoilResultsPanel } from '../domain/analysis'
import { saveRecoilSessionFn } from '../domain/sessions'
import { degPerCount, degPerUnit, useSettings } from '../domain/settings'

export const Route = createFileRoute('/recoil/$weaponId')({
  loader: ({ params }) => {
    const weapon = getWeapon(params.weaponId)
    if (!weapon) throw notFound()
    return { weapon }
  },
  ssr: false, // canvas + pointer lock + localStorage settings are browser-only
  component: RecoilPlayRoute,
})

type Result = { summary: RecoilSummary; shots: RecoilShots; tips: Tip[]; saveStatus: string }

function RecoilPlayRoute() {
  const { weapon } = Route.useLoaderData()
  const navigate = useNavigate()
  const { settings, ready } = useSettings()
  const [runKey, setRunKey] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const recoil = useMemo(() => buildDrill(weapon, settings.recoil), [weapon, settings.recoil])
  const drill = useMemo((): Drill => ({ kind: 'recoil', drill: recoil }), [recoil])
  // Aiming through an optic narrows the view and, as in Apex at ADS multiplier
  // 1.0, slows turning by the zoom. Stored deg/count is what the spray was played at.
  const { adsScale, zoom } = settings.recoil
  const fovDeg = useMemo(() => zoomedFov(settings.fov, zoom), [settings.fov, zoom])
  const dpc = useMemo(() => (degPerCount(settings) * adsScale) / zoom, [settings, adsScale, zoom])
  const dpu = useMemo(() => (degPerUnit(settings) * adsScale) / zoom, [settings, adsScale, zoom])

  const retry = useCallback(() => {
    setResult(null)
    setRunKey((k) => k + 1)
  }, [])
  const toMenu = useCallback(() => navigate({ to: '/recoil' }), [navigate])

  const onFinish = useCallback(async (result: RunResult) => {
    const { run } = result
    if (run.kind !== 'recoil') return
    const summary = computeRecoilSummary(run.shots)
    const tips = diagnoseRecoil(summary)
    const empty = summary.shots === 0
    setResult({ summary, shots: run.shots, tips, saveStatus: empty ? 'Not saved (no shots fired).' : 'Saving…' })
    if (empty) return
    try {
      const { id } = await saveRecoilSessionFn({
        data: {
          drill: recoil, fovDeg, seed: result.seed, degPerCount: dpc, startedAt: result.startedAt, endedAt: result.endedAt,
          settings, environment: result.environment, tips: tips.map((t) => t.key), summary, shots: run.shots,
        },
      })
      setResult((r) => r && { ...r, saveStatus: `Saved as recoil session ${id}` })
    } catch (err) {
      setResult((r) => r && { ...r, saveStatus: `Could not save: ${err instanceof Error ? err.message : String(err)}` })
    }
  }, [recoil, settings, dpc, fovDeg])

  // Leaving the drill (menu, back button) exits fullscreen.
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
  if (result) {
    return (
      <RecoilResultsPanel drill={recoil} summary={result.summary} shots={result.shots} tips={result.tips}
        saveStatus={result.saveStatus} onRetry={retry} onMenu={toMenu} />
    )
  }
  return (
    <TrainerView key={runKey} drill={drill} settings={settings} degPerUnit={dpu} fovDeg={fovDeg}
      onFinish={onFinish} onAbort={toMenu} />
  )
}
