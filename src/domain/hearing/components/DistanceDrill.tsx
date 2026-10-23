import { useCallback, useState } from 'react'
import type { Gait, HearingSettings, SaveTrialInput, Surface } from '../types'
import type { AudioEngine, Playback } from '../services/engine'
import { bucketCorrect, DISTANCE_BUCKETS, type DistanceBucket } from '../services/scoring'
import type { Environment } from '../services/spatial'
import { distanceFor, pickEnvironment, pickGait, pickSurface } from '../services/trial'
import { mean, useDrill, useDrillKeys } from '../hooks/useDrill'
import { btnCls, DrillSidebar, Row } from './DrillParts'

type Props = {
  engine: AudioEngine
  settings: HearingSettings
  onTrial: (trial: SaveTrialInput) => Promise<void>
}

type Current = {
  bucket: DistanceBucket; distance: number; angle: number; surface: Surface; gait: Gait; env: Environment
  level: number; steps: number; distractor: number; playback: Playback
}
type Result = { truth: DistanceBucket; answer: DistanceBucket; ok: boolean; reactionMs: number; level: number; env: Environment; gait: Gait }

const bucketIndex = (b: DistanceBucket) => DISTANCE_BUCKETS.indexOf(b)

/** Distance drill (SPEC-005 mode 2): near / mid / far from gain, low-pass and room reverb. */
export function DistanceDrill({ engine, settings, onTrial }: Props) {
  const drill = useDrill(engine, settings, onTrial)
  const { params } = drill
  const [current, setCurrent] = useState<Current | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [results, setResults] = useState<Result[]>([])

  const next = useCallback(async () => {
    const bucket = DISTANCE_BUCKETS[Math.floor(Math.random() * DISTANCE_BUCKETS.length)]
    const distance = distanceFor(bucket, params.distanceCenters, Math.random)
    const span = settings.frontOnly ? 180 : 360
    const angle = Math.round(Math.random() * span - span / 2)
    const surface = pickSurface(settings.terrain, Math.random)
    const gait = pickGait(settings.gait, params.mixGait, Math.random)
    const env = pickEnvironment(Math.random)
    const playback = await drill.play({ angle, distance, gait, surface, behindCue: !settings.frontOnly, env })
    setCurrent({ bucket, distance, angle, surface, gait, env, level: drill.level, steps: params.steps, distractor: drill.distractor, playback })
    setResult(null)
  }, [drill, params.distanceCenters, params.mixGait, params.steps, settings.frontOnly, settings.terrain, settings.gait])

  const answer = (a: DistanceBucket) => {
    if (!current || result) return
    const now = performance.now()
    if (now < current.playback.onsetMs) return
    const ok = bucketCorrect(current.bucket, a)
    const r: Result = { truth: current.bucket, answer: a, ok, reactionMs: now - current.playback.onsetMs, level: current.level, env: current.env, gait: current.gait }
    setResult(r)
    setResults((rs) => [...rs, r])
    drill.record(ok)
    drill.save({
      mode: 'distance',
      level: current.level,
      locked: drill.locked,
      trueValue: current.bucket,
      answer: a,
      // Buckets apart: 0 right, 1 neighbour, 2 near↔far.
      error: Math.abs(bucketIndex(current.bucket) - bucketIndex(a)),
      correct: ok,
      reactionMs: Math.round(r.reactionMs),
      createdAt: new Date().toISOString(),
      detail: {
        ...drill.baseDetail(current),
        gait: current.gait,
        gaitSetting: settings.gait,
        mixGait: params.mixGait,
        distance: Number(current.distance.toFixed(3)),
        angle: current.angle,
        environment: current.env,
        behindCue: !settings.frontOnly,
      },
    })
  }

  useDrillKeys(
    () => { if (!current || result) void next() },
    (n) => { if (n >= 1 && n <= 3) answer(DISTANCE_BUCKETS[n - 1]) },
  )

  const last20 = results.slice(-20)
  const acc = last20.length ? `${Math.round((last20.filter((r) => r.ok).length / last20.length) * 100)}%` : '–'
  const meanRt = mean(results.slice(-10).map((r) => r.reactionMs))

  return (
    <div className="mt-4 grid gap-6 md:grid-cols-[1fr_16rem]">
      <div className="flex flex-col items-center gap-4 pt-6">
        <div className="flex gap-3">
          {DISTANCE_BUCKETS.map((b, i) => (
            <button key={b} disabled={!current || !!result}
              className={`${btnCls} w-28 py-4 text-base ${result?.truth === b ? '!border-emerald-500' : ''} ${result && result.answer === b && !result.ok ? '!border-red-500' : ''}`}
              onClick={() => answer(b)}>
              {b} ({i + 1})
            </button>
          ))}
        </div>
        <div className="flex min-h-10 flex-wrap items-center justify-center gap-3 text-sm">
          {!current && <button className={btnCls} onClick={() => void next()}>Play (Space)</button>}
          {current && !result && <span className="text-ink-2">How far away? Direction doesn&apos;t matter here.</span>}
          {result && current && (
            <>
              <span className={result.ok ? 'text-emerald-400' : 'text-red-400'}>
                {result.ok ? 'Right' : `It was ${result.truth}`} · {Math.round(result.reactionMs)} ms
              </span>
              <span className="text-muted">{current.env} · {current.gait} on {current.surface} · {current.angle}°</span>
              <button className={btnCls} onClick={() => void next()}>Next (Space)</button>
            </>
          )}
        </div>
        {drill.saveError && <p className="text-xs text-red-400">Could not save trial: {drill.saveError}</p>}
      </div>
      <DrillSidebar
        level={drill.level} locked={drill.locked} streak={drill.streak}
        outcomes={results.map((r) => ({ ok: r.ok, title: `L${r.level}: ${r.truth} → ${r.answer} (${r.env}, ${r.gait})` }))}
        session={(
          <>
            <Row label="Accuracy (last 20)" value={acc} />
            <Row label="Mean RT (last 10)" value={meanRt === null ? '–' : `${Math.round(meanRt)} ms`} />
          </>
        )}
      >
        <Row label="Bucket centres" value={params.distanceCenters.map((c) => c.toFixed(2)).join(' / ')} />
        <Row label="Gait" value={params.mixGait ? 'random' : settings.gait} />
        <Row label="Steps" value={String(params.steps)} />
        <Row label="Distractors" value={drill.distractor.toFixed(2)} />
      </DrillSidebar>
    </div>
  )
}
