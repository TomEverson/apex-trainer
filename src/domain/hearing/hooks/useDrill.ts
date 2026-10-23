import { useCallback, useEffect, useRef, useState } from 'react'
import type { HearingSettings, SaveTrialInput, Surface } from '../types'
import type { AudioEngine, FootstepOpts, Playback } from '../services/engine'
import { initialDifficulty, levelParams, MIN_LEVEL, nextDifficulty } from '../services/difficulty'

type PlayOpts = Omit<FootstepOpts, 'render' | 'mix' | 'steps'>

/**
 * What every drill shares: adaptive level (or the locked one), distractors at
 * the level's loudness, one playback at a time, trial saving and the detail
 * fields every trial logs.
 */
export function useDrill(engine: AudioEngine, settings: HearingSettings, onTrial: (t: SaveTrialInput) => Promise<void>) {
  const locked = settings.lockedLevel !== null
  const [difficulty, setDifficulty] = useState(() => initialDifficulty(settings.lockedLevel ?? MIN_LEVEL))
  const level = settings.lockedLevel ?? difficulty.level
  const params = levelParams(level)
  const distractor = params.distractor * settings.distractorGain
  const [saveError, setSaveError] = useState<string | null>(null)
  const playbackRef = useRef<Playback | null>(null)

  useEffect(() => {
    engine.distractors.setLevel(distractor)
  }, [engine, distractor])
  useEffect(() => () => {
    engine.distractors.setLevel(0)
    playbackRef.current?.stop()
  }, [engine])

  const play = useCallback(async (o: PlayOpts): Promise<Playback> => {
    await engine.resume()
    playbackRef.current?.stop()
    const pb = engine.footsteps({ ...o, render: settings.render, mix: settings.mix, steps: params.steps })
    playbackRef.current = pb
    return pb
  }, [engine, settings.render, settings.mix, params.steps])

  const record = useCallback((accurate: boolean) => setDifficulty((d) => nextDifficulty(d, accurate, locked)), [locked])

  /** Detail fields common to every mode; `at` is the trial's own snapshot. */
  const baseDetail = (at: { surface: Surface; steps: number; distractor: number }) => ({
    render: settings.render,
    mix: settings.mix,
    surface: at.surface,
    terrainSetting: settings.terrain,
    source: engine.source[at.surface],
    steps: at.steps,
    distractor: Number(at.distractor.toFixed(3)),
    swapped: engine.swapped,
  })

  const save = (trial: SaveTrialInput) => {
    onTrial(trial).then(() => setSaveError(null), (err: unknown) => setSaveError(err instanceof Error ? err.message : String(err)))
  }

  return { level, locked, params, distractor, streak: difficulty.streak, play, record, baseDetail, save, saveError }
}

/** Space plays the first/next sound; number keys pick answers. */
export function useDrillKeys(onSpace: () => void, onNumber?: (n: number) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.code === 'Space') {
        e.preventDefault()
        onSpace()
      } else if (onNumber && /^Digit[1-9]$/.test(e.code)) {
        onNumber(Number(e.code.slice(5)))
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onSpace, onNumber])
}

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
