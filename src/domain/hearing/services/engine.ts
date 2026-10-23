/**
 * Audio engine (SPEC-005). Each footstep sequence gets a "voice":
 *   [occlusion low-pass + boom] → distance low-pass → (dry + room reverb) → gain → placement → master
 * Placement is a StereoPanner ('stereo', like Apex's plain stereo output) or an
 * HRTF PannerNode on the horizontal plane ('surround', like a 7.1 headphone
 * virtualizer). swapChannels mirrors left/right after the headphone check.
 */
import type { Gait, Mix, Render, Surface } from '../types'
import { surfaceSchema } from '../validators'
import { Distractors } from './distractors'
import { loadUserSamples } from './samples'
import { occlusionCues, spatialCues, surroundPosition, type Environment, type Occluder } from './spatial'
import { synthFootstep, synthRoom } from './synth'

const SYNTH_VARIANTS = 6

/** One value per surface; listed out so the record type is checked without a cast. */
function perSurface<T>(f: (s: Surface) => T): Record<Surface, T> {
  return { concrete: f('concrete'), metal: f('metal'), wood: f('wood'), dirt: f('dirt'), grass: f('grass'), sand: f('sand') }
}

type GaitSound = { intervalS: number; gain: number; brightness: number }

/** Tempo, loudness and brightness per gait. Focused mix narrows the jog/sprint loudness gap. */
export function gaitSound(gait: Gait, mix: Mix): GaitSound {
  switch (gait) {
    case 'crouch': return { intervalS: 0.8, gain: 0.3, brightness: 0.55 }
    case 'jog': return { intervalS: 0.42, gain: mix === 'focused' ? 0.8 : 0.62, brightness: 0.9 }
    case 'sprint': return { intervalS: 0.32, gain: 1, brightness: 1 }
  }
}

export type VoiceOpts = {
  render: Render
  /** Stereo only: darker/quieter the further behind. Surround gets this from the HRTF. */
  behindCue: boolean
  brightness?: number
  env?: Environment
  occluder?: Occluder | null
}

export type FootstepOpts = VoiceOpts & {
  angle: number
  /** 0 near … 1 far. */
  distance: number
  gait: Gait
  mix: Mix
  surface: Surface
  steps: number
}

export type Voice = {
  input: AudioNode
  /** Move the source; ramps over `rampS` (0 = jump). */
  set(angle: number, distance: number, rampS?: number): void
  dispose(): void
}

export type Playback = {
  /** Audio onset of the first step, on the performance.now() clock (output latency included). */
  onsetMs: number
  /** Context time when the last step and its tail have finished. */
  endS: number
  voice: Voice
  stop(): void
}

export class AudioEngine {
  readonly ctx = new AudioContext({ latencyHint: 'interactive' })
  readonly distractors: Distractors
  private swap = false
  private master: GainNode
  private rooms: Record<Environment, AudioBuffer>
  private bank: Record<Surface, AudioBuffer[]>
  /** Where each surface's sounds come from, for the trial log. */
  source = perSurface((): 'synth' | 'samples' => 'synth')

  constructor() {
    this.master = this.ctx.createGain()
    this.master.connect(this.ctx.destination)
    this.rooms = { interior: synthRoom(this.ctx, 'interior', Math.random), exterior: synthRoom(this.ctx, 'exterior', Math.random) }
    this.bank = perSurface((s) => Array.from({ length: SYNTH_VARIANTS }, () => synthFootstep(this.ctx, s, Math.random)))
    this.distractors = new Distractors(this.ctx, this.master)
  }

  /** Swap in user samples from public/samples where present. */
  async loadSamples() {
    for (const s of surfaceSchema.options) {
      const user = await loadUserSamples(this.ctx, s)
      if (user.length) {
        this.bank[s] = user
        this.source[s] = 'samples'
      }
    }
  }

  resume() {
    return this.ctx.resume()
  }

  /** Flip every pan, after the headphone check found left/right reversed. */
  setSwap(swap: boolean) {
    this.swap = swap
  }

  get swapped() {
    return this.swap
  }

  setVolume(v: number) {
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05)
  }

  close() {
    this.distractors.stop()
    return this.ctx.close()
  }

  /** performance.now() time at which context time `t` reaches the speakers. */
  private perfTime(t: number): number {
    const ts = this.ctx.getOutputTimestamp()
    if (ts.contextTime !== undefined && ts.performanceTime !== undefined) return ts.performanceTime + (t - ts.contextTime) * 1000
    return performance.now() + (t - this.ctx.currentTime) * 1000
  }

  /** Headphone check tone; pan −1 left, +1 right, 0 both. */
  tone(pan: number, atS: number, durS = 0.6) {
    const { ctx } = this
    const t = ctx.currentTime + atS
    const osc = ctx.createOscillator()
    osc.frequency.value = 440
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.4, t + 0.02)
    g.gain.setValueAtTime(0.4, t + durS - 0.05)
    g.gain.linearRampToValueAtTime(0, t + durS)
    const p = ctx.createStereoPanner()
    p.pan.value = this.swap ? -pan : pan
    osc.connect(g).connect(p).connect(this.master)
    osc.start(t)
    osc.stop(t + durS)
  }

  voice({ render, behindCue, brightness = 1, env = 'interior', occluder = null }: VoiceOpts): Voice {
    const { ctx } = this
    const input = ctx.createGain()
    let head: AudioNode = input
    if (occluder) {
      // Through a floor: density low-pass, level drop, structure-borne boom.
      const o = occlusionCues(occluder)
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = o.cutoffHz
      const boom = ctx.createBiquadFilter()
      boom.type = 'peaking'
      boom.frequency.value = 150
      boom.Q.value = 1
      boom.gain.value = o.boomDb
      const level = ctx.createGain()
      level.gain.value = 10 ** (o.gainDb / 20)
      head = head.connect(lp).connect(boom).connect(level)
    }
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    head.connect(filter)
    const dry = ctx.createGain()
    const send = ctx.createGain()
    const reverb = ctx.createConvolver()
    reverb.buffer = this.rooms[env]
    const gain = ctx.createGain()
    filter.connect(dry).connect(gain)
    filter.connect(send).connect(reverb).connect(gain)

    let place: (angle: number, to: (p: AudioParam, v: number) => void) => void
    let out: AudioNode
    if (render === 'surround') {
      const p = ctx.createPanner()
      p.panningModel = 'HRTF'
      p.distanceModel = 'linear'
      p.rolloffFactor = 0 // distance is our gain/filter, not the panner's
      p.positionY.value = 0
      out = p
      place = (angle, to) => {
        const pos = surroundPosition(angle)
        to(p.positionX, this.swap ? -pos.x : pos.x)
        to(p.positionZ, pos.z)
      }
    } else {
      const p = ctx.createStereoPanner()
      out = p
      place = (angle, to) => {
        const pan = spatialCues(angle, 0, false).pan
        to(p.pan, this.swap ? -pan : pan)
      }
    }
    gain.connect(out).connect(this.master)
    const stereoBehind = render === 'stereo' && behindCue

    return {
      input,
      set: (angle, distance, rampS = 0) => {
        const c = spatialCues(angle, distance, stereoBehind, env)
        const now = ctx.currentTime
        const to = (p: AudioParam, v: number) => (rampS > 0 ? p.setTargetAtTime(v, now, rampS / 3) : p.setValueAtTime(v, now))
        place(angle, to)
        to(gain.gain, c.gain)
        to(filter.frequency, c.cutoffHz * brightness)
        to(send.gain, c.wet)
        to(dry.gain, 1 - c.wet * 0.5)
      },
      dispose: () => {
        input.disconnect()
        out.disconnect()
      },
    }
  }

  /** Schedule a footstep sequence at a fixed position. */
  footsteps(o: FootstepOpts): Playback {
    const { ctx } = this
    const gait = gaitSound(o.gait, o.mix)
    const voice = this.voice({ ...o, brightness: gait.brightness })
    voice.set(o.angle, o.distance)
    const bank = this.bank[o.surface]
    const t0 = ctx.currentTime + 0.08
    const sources: AudioBufferSourceNode[] = []
    let t = t0
    for (let i = 0; i < o.steps; i++) {
      const src = ctx.createBufferSource()
      src.buffer = bank[Math.floor(Math.random() * bank.length)]
      src.playbackRate.value = 0.92 + Math.random() * 0.16
      const g = ctx.createGain()
      // Alternate feet slightly so it doesn't sound like a metronome.
      g.gain.value = gait.gain * (i % 2 ? 0.85 : 1) * (0.9 + Math.random() * 0.2)
      src.connect(g).connect(voice.input)
      src.start(t)
      if (o.mix === 'focused') this.distractors.duck(t)
      sources.push(src)
      t += gait.intervalS * (0.96 + Math.random() * 0.08)
    }
    const endS = t + 1.3
    const timer = setTimeout(() => voice.dispose(), (endS - ctx.currentTime) * 1000 + 100)
    return {
      onsetMs: this.perfTime(t0),
      endS,
      voice,
      stop: () => {
        clearTimeout(timer)
        for (const s of sources) s.stop()
        voice.dispose()
      },
    }
  }
}
