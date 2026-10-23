import { useCallback, useRef, useState } from 'react'
import type { HearingSettings, SaveTrialInput, Surface } from '../types'
import type { AudioEngine, Playback } from '../services/engine'
import { levelParams } from '../services/difficulty'
import { pickAngle } from '../services/direction'
import { angularError, region } from '../services/scoring'
import type { Occluder } from '../services/spatial'
import { pickFloor, pickSurface, type Floor } from '../services/trial'
import { mean, useDrill, useDrillKeys } from '../hooks/useDrill'
import { Dial } from './Dial'
import { btnCls, DrillSidebar, Row } from './DrillParts'

/** Direction drill keeps the source close so only direction (and floor) varies. */
const DISTANCE = 0.2

type Props = {
  engine: AudioEngine
  settings: HearingSettings
  onTrial: (trial: SaveTrialInput) => Promise<void>
}

type Current = {
  angle: number; surface: Surface; floor: Floor; occluder: Occluder | null
  level: number; steps: number; distractor: number; playback: Playback
}
/** Dial clicked; waiting for the floor answer (only when floors are on). */
type Pending = { answer: number; reactionMs: number }
type Result = {
  truth: number; answer: number; error: number; reactionMs: number; level: number
  directionOk: boolean; floor: Floor; occluder: Occluder | null; floorAnswer: 'same' | 'other'; floorOk: boolean
}

export function DirectionDrill({ engine, settings, onTrial }: Props) {
  const drill = useDrill(engine, settings, onTrial)
  const { params } = drill
  const [current, setCurrent] = useState<Current | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [results, setResults] = useState<Result[]>([])
  const prevAngle = useRef<number | null>(null)

  const next = useCallback(async () => {
    const angle = pickAngle(params.angleStepDeg, settings.frontOnly, prevAngle.current, Math.random)
    prevAngle.current = angle
    const surface = pickSurface(settings.terrain, Math.random)
    const { floor, occluder } = pickFloor(settings.floors, Math.random)
    const playback = await drill.play({
      angle, distance: DISTANCE, gait: settings.gait, surface, behindCue: !settings.frontOnly, occluder,
    })
    setCurrent({ angle, surface, floor, occluder, level: drill.level, steps: params.steps, distractor: drill.distractor, playback })
    setPending(null)
    setResult(null)
  }, [drill, params.angleStepDeg, params.steps, settings.frontOnly, settings.terrain, settings.floors, settings.gait])

  const finish = (c: Current, p: Pending, floorAnswer: 'same' | 'other') => {
    const error = angularError(c.angle, p.answer)
    const directionOk = error <= levelParams(c.level).toleranceDeg
    const floorOk = (c.floor === 'same') === (floorAnswer === 'same')
    const r: Result = {
      truth: c.angle, answer: p.answer, error, reactionMs: p.reactionMs, level: c.level,
      directionOk, floor: c.floor, occluder: c.occluder, floorAnswer, floorOk,
    }
    setResult(r)
    setResults((rs) => [...rs, r])
    drill.record(directionOk && floorOk)
    drill.save({
      mode: 'direction',
      level: c.level,
      locked: drill.locked,
      trueValue: String(c.angle),
      answer: String(p.answer),
      error,
      correct: directionOk && floorOk,
      reactionMs: Math.round(p.reactionMs),
      createdAt: new Date().toISOString(),
      detail: {
        ...drill.baseDetail(c),
        gait: settings.gait,
        behindCue: !settings.frontOnly,
        distance: DISTANCE,
        trueRegion: region(c.angle),
        answerRegion: region(p.answer),
        directionOk,
        floorsOn: settings.floors,
        floor: c.floor,
        occluder: c.occluder ?? 'none',
        floorAnswer,
        floorOk,
      },
    })
  }

  const pickDirection = (picked: number) => {
    if (!current || pending || result) return
    const now = performance.now()
    if (now < current.playback.onsetMs) return // no answering before the sound starts
    const p = { answer: Math.round(picked), reactionMs: now - current.playback.onsetMs }
    if (settings.floors) setPending(p)
    else finish(current, p, 'same')
  }

  const pickFloorAnswer = (a: 'same' | 'other') => {
    if (current && pending && !result) finish(current, pending, a)
  }

  useDrillKeys(
    () => { if (!current || result) void next() },
    (n) => {
      if (n === 1) pickFloorAnswer('same')
      if (n === 2) pickFloorAnswer('other')
    },
  )

  const last10 = results.slice(-10)
  const meanErr = mean(last10.map((r) => r.error))
  const meanRt = mean(last10.map((r) => r.reactionMs))
  const floorText = (r: Result) => (r.floor === 'same' ? 'same floor' : `${r.floor} (${r.occluder} floor)`)

  return (
    <div className="mt-4 grid gap-6 md:grid-cols-[1fr_16rem]">
      <div className="flex flex-col items-center gap-3">
        <Dial full={!settings.frontOnly} disabled={!current || !!pending || !!result}
          answer={result?.answer ?? pending?.answer} truth={result?.truth} onPick={pickDirection} />
        <div className="flex min-h-10 flex-wrap items-center justify-center gap-3 text-sm">
          {!current && <button className={btnCls} onClick={() => void next()}>Play (Space)</button>}
          {current && !pending && !result && <span className="text-ink-2">Listen, then click where it came from.</span>}
          {pending && !result && (
            <>
              <span className="text-ink-2">Which floor?</span>
              <button className={btnCls} onClick={() => pickFloorAnswer('same')}>Same floor (1)</button>
              <button className={btnCls} onClick={() => pickFloorAnswer('other')}>Above / below (2)</button>
            </>
          )}
          {result && (
            <>
              <span className={result.directionOk ? 'text-emerald-400' : 'text-red-400'}>
                {result.error}° off · {Math.round(result.reactionMs)} ms
              </span>
              {settings.floors && (
                <span className={result.floorOk ? 'text-emerald-400' : 'text-red-400'}>
                  {floorText(result)}{result.floorOk ? ' ✓' : ` — you said ${result.floorAnswer}`}
                </span>
              )}
              <span className="text-muted">true {result.truth}°, you {result.answer}° · {current?.surface}</span>
              <button className={btnCls} onClick={() => void next()}>Next (Space)</button>
            </>
          )}
        </div>
        {drill.saveError && <p className="text-xs text-red-400">Could not save trial: {drill.saveError}</p>}
      </div>
      <DrillSidebar
        level={drill.level} locked={drill.locked} streak={drill.streak}
        outcomes={results.map((r) => ({ ok: r.directionOk && r.floorOk, title: `L${r.level}: ${r.error}°, ${floorText(r)}` }))}
        session={(
          <>
            <Row label="Mean error (last 10)" value={meanErr === null ? '–' : `${meanErr.toFixed(1)}°`} />
            <Row label="Mean RT (last 10)" value={meanRt === null ? '–' : `${Math.round(meanRt)} ms`} />
            {settings.floors && (
              <Row label="Floor calls right" value={results.length ? `${results.filter((r) => r.floorOk).length}/${results.length}` : '–'} />
            )}
          </>
        )}
      >
        <Row label="Angle grid" value={`${params.angleStepDeg}°`} />
        <Row label="Counts as accurate" value={`≤ ${params.toleranceDeg}°`} />
        <Row label="Steps" value={String(params.steps)} />
        <Row label="Distractors" value={drill.distractor.toFixed(2)} />
      </DrillSidebar>
    </div>
  )
}
