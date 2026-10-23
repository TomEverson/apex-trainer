import { createFileRoute, Link } from '@tanstack/react-router'
import type { RecoilPrefs, WeaponClass } from '../common/lib/recoil'
import { enterFullscreen } from '../common/lib/fullscreen'
import { buildDrill, CLASS_LABELS, OPTICS, patternClimb, RANGES_M, SPRAY_COUNTS, TIER_LABELS, WEAPONS } from '../domain/trainer'
import { useSettings } from '../domain/settings'
import { listRecoilSessionsFn } from '../domain/sessions'

export const Route = createFileRoute('/_menu/recoil')({
  loader: async () => ({ sessions: await listRecoilSessionsFn() }),
  component: RecoilRoute,
})

const CLASSES: WeaponClass[] = ['ar', 'smg', 'lmg']
const pct = (v: number) => `${(v * 100).toFixed(1)}%`

function RecoilRoute() {
  const { sessions } = Route.useLoaderData()
  const { settings, update } = useSettings()
  const prefs = settings.recoil
  const set = (patch: Partial<RecoilPrefs>) => update({ recoil: { ...prefs, ...patch } })

  return (
    <>
      <p className="mt-6 mb-4 text-ink-2">
        Pick a weapon. Hold left click to spray a full magazine at the target and pull against the recoil. Letting go ends the spray. <kbd className="rounded bg-surface-2 px-1.5">R</kbd> restarts, <kbd className="rounded bg-surface-2 px-1.5">F</kbd> fullscreen, <kbd className="rounded bg-surface-2 px-1.5">Esc</kbd> aborts.
      </p>

      <div className="mb-5 flex flex-wrap items-end gap-x-5 gap-y-3 rounded-xl border border-line bg-surface p-3">
        <Choice label="Range" value={prefs.rangeM} options={RANGES_M.map((r) => [r, `${r} m`])} onChange={(rangeM) => set({ rangeM })} />
        <Choice label="Optic" value={prefs.zoom} options={OPTICS.map((z) => [z, `${z}x`])} onChange={(zoom) => set({ zoom })} />
        <Choice label="Target" value={prefs.target} options={[['static', 'Static'], ['strafe', 'Strafing']]} onChange={(target) => set({ target })} />
        <Choice label="Magazine" value={prefs.magTier} options={TIER_LABELS.map((l, i) => [i, l])} onChange={(magTier) => set({ magTier })} />
        <Choice label="Barrel" value={prefs.barrelTier} options={TIER_LABELS.map((l, i) => [i, l])} onChange={(barrelTier) => set({ barrelTier })} />
        <Choice label="Sprays" value={prefs.sprays} options={SPRAY_COUNTS.map((n) => [n, String(n)])} onChange={(sprays) => set({ sprays })} />
        <label className="flex flex-col gap-1 text-xs text-muted">
          ADS multiplier
          <input type="number" min={0.1} max={3} step={0.05} value={prefs.adsScale}
            onChange={(e) => { const v = Number(e.target.value); if (v > 0) set({ adsScale: v }) }}
            className="w-20 rounded-md border border-line bg-surface-2 px-2 py-1.5 text-sm text-ink tabular-nums" />
        </label>
      </div>

      {CLASSES.map((cls) => (
        <section key={cls} className="mb-6">
          <h2 className="mb-2.5 text-sm tracking-wider text-ink-2 uppercase">{CLASS_LABELS[cls]}</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
            {WEAPONS.filter((w) => w.class === cls).map((w) => {
              const drill = buildDrill(w, prefs)
              const runs = sessions.filter((s) => s.drill.id === drill.id)
              const rates = runs.map((r) => r.summary.hitRate ?? 0)
              const last = runs.at(-1)?.summary
              return (
                <Link key={w.id} to="/recoil/$weaponId" params={{ weaponId: w.id }}
                  onClick={() => { if (settings.autoFullscreen) void enterFullscreen() }}
                  className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface p-4 transition hover:-translate-y-px hover:border-accent">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-base font-semibold">{w.name}</span>
                    {w.carePackage && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-2">Care Package</span>}
                  </span>
                  <span className="text-[13px] text-ink-2 tabular-nums">
                    {w.ammo} · {w.burst ? `${w.burst.size}-round burst` : `${w.rpm} rpm`} · {drill.magSize} rounds
                  </span>
                  <span className="text-[13px] text-muted tabular-nums">
                    Climbs ~{patternClimb(drill).toFixed(1)}° over the magazine{!w.barrel && prefs.barrelTier > 0 ? ' · no barrel slot' : ''}
                  </span>
                  <span className="mt-1 text-xs text-muted tabular-nums">
                    {runs.length
                      ? `Avg ${pct(rates.reduce((a, b) => a + b, 0) / rates.length)} · Best ${pct(Math.max(...rates))} · ${runs.length} run${runs.length === 1 ? '' : 's'}${last?.vertComp != null ? ` · last pull ${Math.round(last.vertComp * 100)}%` : ''}`
                      : 'Not played yet'}
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      ))}

      <p className="text-xs leading-relaxed text-muted">
        Fire rates and magazines follow the patch notes up to Season 30 Split 2. Respawn doesn't publish recoil data, so each spray shape is an approximation of the gun's known pattern — practise the shape, then check it in the Firing Range. The optic zooms the view and slows turning by its magnification; set ADS multiplier to the in-game per-optic ADS sensitivity (1.0 = default).
      </p>
    </>
  )
}

function Choice<T extends string | number>({ label, value, options, onChange }: {
  label: string
  value: T
  options: [T, string][]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-col gap-1 text-xs text-muted">
      {label}
      <div className="flex gap-1 rounded-lg bg-surface-2 p-0.5">
        {options.map(([v, l]) => (
          <button key={String(v)} onClick={() => onChange(v)}
            className={`rounded-md px-2.5 py-1 text-sm ${v === value ? 'bg-accent text-white' : 'text-ink-2 hover:text-ink'}`}>
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}
