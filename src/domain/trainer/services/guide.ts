/**
 * Spray guide (SPEC-006): turns a drill's pattern into the mouse movement that
 * cancels it, split into a few steps with plain-language instructions. Pure.
 */
import { expandPattern, type RecoilDrill } from '../../../common/lib/recoil'
import { shotTimes } from './weapons'

/** Sideways movement below this (degrees per step) is called "straight down". */
const SIDE_MIN_DEG = 0.25

export type GuideStep = {
  /** 1-based bullet numbers. */
  from: number
  to: number
  /** How far to pull down / sideways over the step, degrees. side + = move the mouse right. */
  downDeg: number
  sideDeg: number
  seconds: number
  text: string
}

export type SprayGuide = {
  /** Uncompensated bullet offsets [yaw, pitch] after the barrel. */
  pattern: [number, number][]
  /** Bullet index where each step ends (for markers). */
  marks: number[]
  steps: GuideStep[]
  tips: string[]
}

const strength = (degPerS: number) => (degPerS >= 6 ? 'hard' : degPerS >= 3 ? 'steadily' : 'gently')

export function sprayGuide(d: RecoilDrill): SprayGuide {
  const n = d.magSize
  const pattern = expandPattern(d.weapon.pattern, n).map(([y, p]): [number, number] => [y * d.kickScale, p * d.kickScale])
  const times = shotTimes(d.weapon, n)
  const count = n <= 20 ? 3 : 4
  const marks = Array.from({ length: count }, (_, k) => Math.round(((k + 1) * (n - 1)) / count))

  const steps: GuideStep[] = []
  let a = 0
  for (const b of marks) {
    const downDeg = pattern[b][1] - pattern[a][1]
    // Pattern drifting right means the mouse has to go left.
    const sideDeg = -(pattern[b][0] - pattern[a][0])
    const seconds = Math.max(1e-3, times[b] - times[a])
    const parts: string[] = []
    if (downDeg < 0.2) parts.push('barely any vertical — hold your height')
    else parts.push(`pull down ${strength(downDeg / seconds)} (${downDeg.toFixed(1)}° in ${seconds.toFixed(1)} s)`)
    if (Math.abs(sideDeg) >= SIDE_MIN_DEG) parts.push(`drift ${sideDeg > 0 ? 'right' : 'left'} ${Math.abs(sideDeg).toFixed(1)}°`)
    steps.push({ from: a + 1, to: b + 1, downDeg, sideDeg, seconds, text: parts.join(', ') })
    a = b
  }

  const rates = steps.map((s) => s.downDeg / s.seconds)
  const front = rates[0] >= Math.max(...rates) * 0.9
  const total = pattern[n - 1][1]
  const tips = [
    'Be on the target before you press — the first bullet goes exactly where you aim.',
    front
      ? 'The kick is strongest at the start: begin pulling with the first bullet, not when you see the climb.'
      : 'The climb builds up: start with a light pull and increase it as the spray goes on.',
    'Make each step one continuous movement at a constant speed. Change speed or direction gradually at the step boundaries, never stop and correct.',
    total > 8
      ? `This is a long pull (${total.toFixed(1)}° in total): keep the wrist fixed and drag with the forearm so you don't run out of reach.`
      : 'Keep the wrist relaxed and pull with the forearm; use fingertips only for the small sideways drifts.',
    'Watch the target, not the crosshair. If hits drift high late in the spray, pull harder earlier rather than more at the end.',
  ]
  return { pattern, marks, steps, tips }
}
