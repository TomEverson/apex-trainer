import { describe, expect, it } from 'vitest'
import { sprayGuide } from './guide'
import { buildDrill, getWeapon, SPRAYS_PER_RUN, WEAPONS } from './weapons'

const PREFS = { rangeM: 20, target: 'static' as const, magTier: 3, barrelTier: 0, sprays: 10, adsScale: 1, zoom: 1, mode: 'pure' as const, strafeAudio: true }

function drillFor(id: string) {
  const w = getWeapon(id)
  if (!w) throw new Error(id)
  return buildDrill(w, PREFS)
}

describe('sprayGuide', () => {
  it('covers the whole magazine in consecutive steps', () => {
    for (const w of WEAPONS) {
      const g = sprayGuide(buildDrill(w, PREFS))
      expect(g.steps[0].from).toBe(1)
      expect(g.steps.at(-1)?.to).toBe(buildDrill(w, PREFS).magSize)
      g.steps.slice(1).forEach((s, i) => expect(s.from).toBe(g.steps[i].to))
    }
  })
  it('tells you to move the mouse against the drift', () => {
    // The Flatline spray swings left first, so the mouse has to go right.
    const first = sprayGuide(drillFor('flatline')).steps[0]
    expect(first.sideDeg).toBeGreaterThan(0)
    expect(first.text).toContain('right')
    expect(first.downDeg).toBeGreaterThan(1)
  })
})

describe('sprays per run', () => {
  it('is always 5, whatever the stored preference says', () => {
    expect(SPRAYS_PER_RUN).toBe(5)
    expect(drillFor('r-301').sprays).toBe(5)
  })
})
