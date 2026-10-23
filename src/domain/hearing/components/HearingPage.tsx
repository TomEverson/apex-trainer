import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Gait, HearingSettings, Mix, Render, SaveTrialInput, Surface } from '../types'
import { useHearingSettings } from '../hooks/useHearingSettings'
import { AudioEngine } from '../services/engine'
import { MAX_LEVEL, MIN_LEVEL } from '../services/difficulty'
import { gaitSchema, mixSchema, renderSchema, surfaceChoiceSchema, surfaceSchema } from '../validators'
import { DirectionDrill } from './DirectionDrill'
import { DistanceDrill } from './DistanceDrill'
import { HeadphoneCheck } from './HeadphoneCheck'

type Props = { onTrial: (trial: SaveTrialInput) => Promise<void> }

const inputCls = 'rounded-md border border-line bg-surface-2 px-2 py-1 text-ink'
const GAIT_LABELS: Record<Gait, string> = { crouch: 'crouch-walk', jog: 'jog', sprint: 'sprint' }
const RENDER_LABELS: Record<Render, string> = { stereo: 'Apex stereo (panning)', surround: 'virtual surround (HRTF, like Windows Sonic/Atmos)' }
const MIX_LABELS: Record<Mix, string> = { focused: 'Focused (Apex default)', original: 'Original' }

const MODES = [
  { id: 'direction', label: 'Direction' },
  { id: 'distance', label: 'Distance' },
] as const
type ModeId = (typeof MODES)[number]['id']
const LEVELS = Array.from({ length: MAX_LEVEL - MIN_LEVEL + 1 }, (_, i) => MIN_LEVEL + i)

/** Footstep audio trainer (SPEC-005): start audio → headphone check → drill. */
export function HearingPage({ onTrial }: Props) {
  const { settings, ready, update } = useHearingSettings()
  const [engine, setEngine] = useState<AudioEngine | null>(null)
  const [checked, setChecked] = useState(false)
  const [mode, setMode] = useState<ModeId>('direction')
  const engineRef = useRef<AudioEngine | null>(null)

  useEffect(() => () => void engineRef.current?.close(), [])
  useEffect(() => {
    if (!engine) return
    engine.setSwap(settings.swapChannels)
    engine.setVolume(settings.volume)
  }, [engine, settings.swapChannels, settings.volume])

  // AudioContext needs a user gesture, so the engine is created on this click.
  const start = async () => {
    const e = new AudioEngine()
    engineRef.current = e
    await e.resume()
    await e.loadSamples()
    setEngine(e)
  }

  if (!ready) return null
  return (
    <div>
      <p className="mt-6 text-sm text-ink-2">
        Footstep direction and distance training for Apex, on stereo headphones. Every trial is saved.
      </p>
      <ul className="mt-2 list-disc pl-5 text-xs text-muted">
        <li>No real up/down: Apex has no height channels (7.1 is a flat ring) and no HRTF of its own. Floors are trained the way Apex conveys them: muffled and boomy through the floor material.</li>
        <li>Apex stereo: front/back is only &ldquo;darker and a little quieter&rdquo; behind, so front/back confusion is expected. Virtual surround imitates a 7.1 headphone virtualizer; compare both in your stats.</li>
        <li>This trains listening skill. It is not a copy of Apex&apos;s sound.</li>
      </ul>

      {!engine && (
        <button className="mt-6 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white" onClick={() => void start()}>
          Start audio
        </button>
      )}

      {engine && !checked && (
        <HeadphoneCheck
          engine={engine}
          swapped={settings.swapChannels}
          canSkip={settings.checkedAt !== null}
          onSwap={(swapChannels) => update({ swapChannels })}
          onPass={() => {
            update({ checkedAt: new Date().toISOString() })
            setChecked(true)
          }}
        />
      )}

      {engine && checked && (
        <>
          <Options settings={settings} update={update} sources={engine.source} />
          <nav className="mt-6 flex gap-1 rounded-[10px] bg-surface p-1 text-sm w-fit">
            {MODES.map((m) => (
              <button key={m.id} onClick={() => setMode(m.id)}
                className={`rounded-md px-3.5 py-1.5 ${mode === m.id ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:text-ink'}`}>
                {m.label}
              </button>
            ))}
          </nav>
          {mode === 'direction' && <DirectionDrill key={`${settings.frontOnly}`} engine={engine} settings={settings} onTrial={onTrial} />}
          {mode === 'distance' && <DistanceDrill key={`${settings.frontOnly}`} engine={engine} settings={settings} onTrial={onTrial} />}
        </>
      )}
    </div>
  )
}

function Options({ settings, update, sources }: {
  settings: HearingSettings
  update: (patch: Partial<HearingSettings>) => void
  sources: Record<Surface, 'synth' | 'samples'>
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-line bg-surface p-4 text-sm text-ink-2">
      <Opt label="Gait">
        <select className={inputCls} value={settings.gait} onChange={(e) => {
          const g = gaitSchema.safeParse(e.currentTarget.value)
          if (g.success) update({ gait: g.data })
        }}>
          {gaitSchema.options.map((g: Gait) => <option key={g} value={g}>{GAIT_LABELS[g]}</option>)}
        </select>
      </Opt>
      <Opt label="Terrain">
        <select className={inputCls} value={settings.terrain} onChange={(e) => {
          const s = surfaceChoiceSchema.safeParse(e.currentTarget.value)
          if (s.success) update({ terrain: s.data })
        }}>
          <option value="mixed">mixed (random each trial)</option>
          {surfaceSchema.options.map((s) => <option key={s} value={s}>{s}{sources[s] === 'samples' ? ' (your samples)' : ''}</option>)}
        </select>
      </Opt>
      <Opt label="Distractors">
        <input type="range" min={0} max={2} step={0.1} value={settings.distractorGain}
          onChange={(e) => update({ distractorGain: e.currentTarget.valueAsNumber })} />
        <span className="w-8 tabular-nums">{settings.distractorGain.toFixed(1)}×</span>
      </Opt>
      <Opt label="Volume">
        <input type="range" min={0} max={1} step={0.05} value={settings.volume}
          onChange={(e) => update({ volume: e.currentTarget.valueAsNumber })} />
      </Opt>
      <Opt label="Playback">
        <select className={inputCls} value={settings.render} onChange={(e) => {
          const v = renderSchema.safeParse(e.currentTarget.value)
          if (v.success) update({ render: v.data })
        }}>
          {renderSchema.options.map((v) => <option key={v} value={v}>{RENDER_LABELS[v]}</option>)}
        </select>
      </Opt>
      <Opt label="Mix">
        <select className={inputCls} value={settings.mix} onChange={(e) => {
          const v = mixSchema.safeParse(e.currentTarget.value)
          if (v.success) update({ mix: v.data })
        }}>
          {mixSchema.options.map((v) => <option key={v} value={v}>{MIX_LABELS[v]}</option>)}
        </select>
      </Opt>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={settings.floors} onChange={(e) => update({ floors: e.currentTarget.checked })} />
        Floors (direction: some steps come from above/below)
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={settings.frontOnly} onChange={(e) => update({ frontOnly: e.currentTarget.checked })} />
        Front half only (easier)
      </label>
      <Opt label="Level">
        <select className={inputCls} value={settings.lockedLevel ?? 'auto'} onChange={(e) => {
          const v = e.currentTarget.value
          update({ lockedLevel: v === 'auto' ? null : Number(v) })
        }}>
          <option value="auto">adaptive</option>
          {LEVELS.map((l) => <option key={l} value={l}>locked at {l}</option>)}
        </select>
      </Opt>
    </div>
  )
}

function Opt({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-muted">{label}</span>
      {children}
    </label>
  )
}
