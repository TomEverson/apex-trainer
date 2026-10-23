/**
 * Distractor layer (SPEC-005): an ambient hum bed (brown noise + low tone) and
 * distant gunfire-like volleys from random sides. One level control, 0 = silent.
 */
import { synthBrownNoise, synthCrack } from './synth'

export class Distractors {
  private out: GainNode
  /** Focused-mix ducking: dips the footstep band of the distractors while a step plays. */
  private duckBand: BiquadFilterNode
  private sources: AudioScheduledSourceNode[] = []
  private timer: ReturnType<typeof setTimeout> | undefined
  private running = false
  private crack: AudioBuffer
  private bed: AudioBuffer

  constructor(private ctx: AudioContext, dest: AudioNode) {
    this.out = ctx.createGain()
    this.out.gain.value = 0
    this.duckBand = ctx.createBiquadFilter()
    this.duckBand.type = 'peaking'
    this.duckBand.frequency.value = 1000
    this.duckBand.Q.value = 0.5
    this.out.connect(this.duckBand).connect(dest)
    this.crack = synthCrack(ctx, Math.random)
    this.bed = synthBrownNoise(ctx, 4, Math.random)
  }

  setLevel(level: number) {
    this.out.gain.setTargetAtTime(Math.max(0, level), this.ctx.currentTime, 0.15)
    if (level > 0 && !this.running) this.start()
    if (level <= 0 && this.running) this.stop()
  }

  /**
   * Multiband-sidechain stand-in (Apex Focused Mix): cut ~200 Hz–4 kHz of the
   * distractors by 9 dB for the length of one footstep starting at `at`.
   */
  duck(at: number, durS = 0.18) {
    const g = this.duckBand.gain
    g.setTargetAtTime(-9, at, 0.005)
    g.setTargetAtTime(0, at + durS, 0.05)
  }

  private start() {
    const { ctx } = this
    this.running = true
    const bed = ctx.createBufferSource()
    bed.buffer = this.bed
    bed.loop = true
    const bedLp = ctx.createBiquadFilter()
    bedLp.type = 'lowpass'
    bedLp.frequency.value = 500
    const bedGain = ctx.createGain()
    bedGain.gain.value = 0.35
    bed.connect(bedLp).connect(bedGain).connect(this.out)
    const hum = ctx.createOscillator()
    hum.type = 'triangle'
    hum.frequency.value = 58
    const humGain = ctx.createGain()
    humGain.gain.value = 0.06
    hum.connect(humGain).connect(this.out)
    bed.start()
    hum.start()
    this.sources.push(bed, hum)
    this.scheduleVolley()
  }

  /** 3–8 shots ~100 ms apart from one random side, then wait 1.5–5 s. */
  private scheduleVolley() {
    const { ctx } = this
    const shots = 3 + Math.floor(Math.random() * 6)
    const pan = ctx.createStereoPanner()
    pan.pan.value = Math.random() * 2 - 1
    pan.connect(this.out)
    const level = 0.25 + Math.random() * 0.45
    let t = ctx.currentTime + 0.05
    for (let i = 0; i < shots; i++) {
      const src = ctx.createBufferSource()
      src.buffer = this.crack
      src.playbackRate.value = 0.9 + Math.random() * 0.2
      const g = ctx.createGain()
      g.gain.value = level * (0.8 + Math.random() * 0.4)
      src.connect(g).connect(pan)
      src.start(t)
      t += 0.08 + Math.random() * 0.05
    }
    this.timer = setTimeout(() => {
      if (this.running) this.scheduleVolley()
    }, (t - ctx.currentTime + 1.5 + Math.random() * 3.5) * 1000)
  }

  stop() {
    this.running = false
    clearTimeout(this.timer)
    for (const s of this.sources) s.stop()
    this.sources = []
  }
}
