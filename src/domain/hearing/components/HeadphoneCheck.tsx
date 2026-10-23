import { useEffect, useRef, useState } from 'react'
import type { AudioEngine } from '../services/engine'

type Step = 'left' | 'right' | 'both'
const SEQUENCE: { step: Step; pan: number; atS: number }[] = [
  { step: 'left', pan: -1, atS: 0 },
  { step: 'right', pan: 1, atS: 0.9 },
  { step: 'both', pan: 0, atS: 1.8 },
]

type Props = {
  engine: AudioEngine
  swapped: boolean
  /** Shown when the check was already confirmed on this device. */
  canSkip: boolean
  onSwap: (swapped: boolean) => void
  onPass: () => void
}

/** Left, right, both — confirm the channels aren't reversed before any drill. */
export function HeadphoneCheck({ engine, swapped, canSkip, onSwap, onPass }: Props) {
  const [playing, setPlaying] = useState<Step | null>(null)
  const [played, setPlayed] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const play = async () => {
    await engine.resume()
    timers.current.forEach(clearTimeout)
    timers.current = []
    for (const s of SEQUENCE) {
      engine.tone(s.pan, s.atS)
      timers.current.push(setTimeout(() => setPlaying(s.step), s.atS * 1000))
    }
    timers.current.push(setTimeout(() => {
      setPlaying(null)
      setPlayed(true)
    }, 2500))
  }

  const btn = 'rounded-md border border-line bg-surface-2 px-3.5 py-2 text-sm hover:border-ink-2 disabled:opacity-40'
  return (
    <section className="mt-6 rounded-xl border border-line bg-surface p-5">
      <h2 className="text-lg font-semibold">Headphone check</h2>
      <p className="mt-1 text-sm text-ink-2">Put your headphones on. You should hear a tone in the left ear, then the right, then both.</p>
      <div className="mt-4 flex gap-3">
        {SEQUENCE.map((s) => (
          <div key={s.step} className={`w-20 rounded-md border px-3 py-2 text-center text-sm ${playing === s.step ? 'border-accent bg-accent/20 text-ink' : 'border-line text-muted'}`}>
            {s.step}
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className={btn} onClick={() => void play()}>{played ? 'Play again' : 'Play tones'}</button>
        <button className={btn} disabled={!played} onClick={onPass}>It matched</button>
        <button className={btn} disabled={!played} onClick={() => { onSwap(!swapped); setPlayed(false) }}>
          Left and right were reversed
        </button>
        {canSkip && <button className={`${btn} ml-auto`} onClick={onPass}>Skip (checked before)</button>}
      </div>
      {swapped && <p className="mt-3 text-xs text-muted">Channels are being swapped in software. Play again to confirm.</p>}
    </section>
  )
}
