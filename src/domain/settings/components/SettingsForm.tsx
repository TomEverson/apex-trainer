import type { ReactNode } from 'react'
import { gameSchema, type Settings } from '../../../common/lib/tracking'
import { GAME_LABELS, TARGET_SPEEDS, degPerCount } from '../services/sensitivity'

type Props = { settings: Settings; onChange: (patch: Partial<Settings>) => void }

const inputCls = 'w-44 rounded-md border border-line bg-surface-2 px-2 py-1.5 text-ink disabled:opacity-50'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm text-ink-2">
      {label}
      {children}
    </label>
  )
}

function NumberInput({ value, onChange, step, min, max, disabled }: {
  value: number; onChange: (v: number) => void; step: number; min?: number; max?: number; disabled?: boolean
}) {
  return (
    <input
      type="number" className={inputCls} value={value} step={step} min={min} max={max} disabled={disabled}
      onChange={(e) => {
        const v = e.currentTarget.valueAsNumber
        if (Number.isFinite(v)) onChange(v)
      }}
    />
  )
}

export function SettingsForm({ settings, onChange }: Props) {
  const custom = settings.game === 'custom'
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      <fieldset className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
        <legend className="px-1.5 text-ink-2">Sensitivity (match your game)</legend>
        <Field label="Game">
          <select
            className={inputCls} value={settings.game}
            onChange={(e) => {
              const game = gameSchema.safeParse(e.currentTarget.value)
              if (game.success) onChange({ game: game.data })
            }}
          >
            {gameSchema.options.map((g) => <option key={g} value={g}>{GAME_LABELS[g]}</option>)}
          </select>
        </Field>
        {custom ? (
          <>
            <Field label="cm/360">
              <NumberInput value={settings.cm360} step={0.1} min={1} onChange={(cm360) => onChange({ cm360 })} />
            </Field>
            {/* The browser can't read the mouse's DPI, and cm → counts needs it. */}
            <Field label="Mouse DPI">
              <NumberInput value={settings.dpi} step={50} min={100} onChange={(dpi) => onChange({ dpi })} />
            </Field>
          </>
        ) : (
          <Field label="In-game sensitivity">
            <NumberInput value={settings.sens} step={0.001} min={0} onChange={(sens) => onChange({ sens })} />
          </Field>
        )}
        <p className="text-xs text-muted">
          {custom
            ? 'Custom cm/360 needs your mouse DPI to convert centimeters into mouse counts.'
            : 'Turns exactly like in-game for the same mouse — DPI not needed.'}
          {' '}{degPerCount(settings).toFixed(4)}° per mouse count.
        </p>
      </fieldset>
      <fieldset className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
        <legend className="px-1.5 text-ink-2">View</legend>
        <Field label="Horizontal FOV (°)">
          <NumberInput value={settings.fov} step={1} min={60} max={130} onChange={(fov) => onChange({ fov })} />
        </Field>
        <Field label="Target speed">
          <select className={inputCls} value={settings.targetSpeed} onChange={(e) => onChange({ targetSpeed: Number(e.currentTarget.value) })}>
            {TARGET_SPEEDS.map((m) => <option key={m} value={m}>{m}×{m === 1 ? ' (default)' : ''}</option>)}
          </select>
        </Field>
        <Field label="Run length">
          <select className={inputCls} value={settings.duration} onChange={(e) => onChange({ duration: Number(e.currentTarget.value) })}>
            {[30, 60, 90].map((d) => <option key={d} value={d}>{d}s</option>)}
          </select>
        </Field>
        <Field label="Start countdown">
          <select className={inputCls} value={settings.countdownS} onChange={(e) => onChange({ countdownS: Number(e.currentTarget.value) })}>
            {[0, 1, 2, 3, 4, 5].map((s) => <option key={s} value={s}>{s === 0 ? 'Off' : `${s}s`}</option>)}
          </select>
        </Field>
        <Field label="Crosshair size (px)">
          <NumberInput value={settings.crosshairSize} step={1} min={2} max={20} onChange={(crosshairSize) => onChange({ crosshairSize })} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" checked={settings.showHud} onChange={(e) => onChange({ showHud: e.currentTarget.checked })} />
          Show live HUD
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" checked={settings.autoFullscreen} onChange={(e) => onChange({ autoFullscreen: e.currentTarget.checked })} />
          Fullscreen when a scenario starts (F toggles)
        </label>
      </fieldset>
    </div>
  )
}
