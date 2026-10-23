import { useEffect, useRef, useState } from 'react'
import type { Settings } from '../../../common/lib/tracking'

const DISTANCE_CM = 10
const ACCEL_TOLERANCE = 0.05

type Pass = { units: number; rawInput: boolean }
type Props = { settings: Settings; onChange: (patch: Partial<Settings>) => void }

/**
 * Mouse check (SPEC-001): measures how many movementX units the browser
 * reports for a known physical distance, so OS scaling / acceleration can be
 * detected and corrected via settings.inputScale.
 */
export function InputCalibration({ settings, onChange }: Props) {
  const padRef = useRef<HTMLDivElement>(null)
  const [dpi, setDpi] = useState(settings.dpi)
  const [measuring, setMeasuring] = useState(false)
  const [live, setLive] = useState(0)
  const [passes, setPasses] = useState<Pass[]>([])

  useEffect(() => {
    if (!measuring) return
    const pad = padRef.current
    let units = 0
    let finished = false
    let raw = false

    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== pad) return
      units += e.movementX
      setLive(units)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || document.pointerLockElement !== pad) return
      e.preventDefault()
      finished = true
      setPasses((p) => [...p, { units: Math.abs(units), rawInput: raw }])
      document.exitPointerLock()
    }
    const onLock = () => {
      if (document.pointerLockElement !== pad) setMeasuring(false)
    }
    const lock = async () => {
      if (!pad) return
      try {
        await pad.requestPointerLock({ unadjustedMovement: true })
        raw = true
      } catch {
        try {
          await pad.requestPointerLock()
        } catch {
          setMeasuring(false)
        }
      }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerlockchange', onLock)
    void lock()
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerlockchange', onLock)
      if (!finished && document.pointerLockElement === pad) document.exitPointerLock()
    }
  }, [measuring])

  const expected = (dpi * DISTANCE_CM) / 2.54
  const ratios = passes.map((p) => p.units / expected)
  const mean = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null
  const spread = ratios.length >= 2 && mean ? (Math.max(...ratios) - Math.min(...ratios)) / mean : null
  const accelerated = spread !== null && spread > ACCEL_TOLERANCE
  const rawInput = passes.at(-1)?.rawInput

  const start = () => {
    setLive(0)
    setMeasuring(true)
  }

  return (
    <fieldset className="mt-4 flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
      <legend className="px-1.5 text-ink-2">Mouse check</legend>
      <p className="text-sm leading-relaxed text-ink-2">
        Checks that {DISTANCE_CM} cm of real mouse movement turns the camera as far as your settings say. Put the mouse at
        the 0 mark of a ruler, click the box, move exactly <b className="text-ink">{DISTANCE_CM} cm to the right</b>, then
        press <kbd className="rounded bg-surface-2 px-1.5">Space</kbd>. Do it twice, once slowly and once fast.
      </p>
      <label className="flex items-center justify-between gap-3 text-sm text-ink-2">
        Mouse DPI (from your mouse software)
        <input type="number" step={50} min={100} value={dpi}
          className="w-44 rounded-md border border-line bg-surface-2 px-2 py-1.5 text-ink"
          onChange={(e) => {
            const v = e.currentTarget.valueAsNumber
            if (Number.isFinite(v) && v > 0) setDpi(v)
          }} />
      </label>

      <div ref={padRef} onClick={measuring ? undefined : start}
        className={`grid h-28 cursor-pointer place-items-center rounded-lg border border-dashed text-center ${measuring ? 'border-accent bg-surface-2' : 'border-line hover:border-accent'}`}>
        {measuring ? (
          <div>
            <div className="text-3xl font-bold tabular-nums">{Math.abs(live)}</div>
            <div className="text-xs text-muted">units so far · expected ≈ {Math.round(expected)} · Space to finish, Esc to cancel</div>
          </div>
        ) : (
          <span className="text-ink-2">Click to start pass {passes.length + 1}</span>
        )}
      </div>

      {passes.length > 0 && mean !== null && (
        <div className="flex flex-col gap-2 text-sm text-ink-2">
          <div className="tabular-nums">
            {passes.map((p, i) => (
              <div key={i}>Pass {i + 1}: {p.units} units → {(ratios[i] * 100).toFixed(1)}% of expected</div>
            ))}
          </div>
          <p>
            Raw input: <b className={rawInput ? 'text-ink' : 'text-[#d9a23a]'}>{rawInput ? 'on' : 'not available in this browser'}</b>.
            {!rawInput && ' The browser is reporting cursor movement after macOS scaling, not real mouse counts, so a correction is needed.'}
          </p>
          {accelerated && (
            <p className="text-[#d9a23a]">
              Fast and slow passes differ by {(spread * 100).toFixed(0)}%, so mouse acceleration is on and no single
              correction can be exact. Turn it off in System Settings → Mouse → Advanced → Pointer acceleration, then
              measure again.
            </p>
          )}
          {Math.abs(mean - 1) < 0.02 && !accelerated ? (
            <p>Input matches your DPI. No correction needed.</p>
          ) : (
            <p>Correction factor: <b className="text-ink tabular-nums">×{mean.toFixed(3)}</b> reported units per real count.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { onChange({ inputScale: Math.abs(mean - 1) < 0.02 ? 1 : mean, dpi }); setPasses([]) }}
              className="rounded-lg bg-accent px-3.5 py-2 font-semibold text-white">
              Apply
            </button>
            <button onClick={() => setPasses([])} className="rounded-lg border border-line bg-surface-2 px-3.5 py-2">Start over</button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted">
        Current correction: ×{settings.inputScale.toFixed(3)}
        {settings.inputScale !== 1 && (
          <> · <button className="underline" onClick={() => onChange({ inputScale: 1 })}>reset</button></>
        )}
      </p>
    </fieldset>
  )
}
