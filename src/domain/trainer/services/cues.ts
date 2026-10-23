/**
 * Recoil Strafe audio cue (SPEC-006): a short beep panned to the side to
 * strafe toward. The AudioContext is created on first use, which happens after
 * the click that starts the drill (browsers require a user gesture).
 */
export function createStrafeBeeper(): (dir: number) => void {
  let ctx: AudioContext | null = null
  return (dir) => {
    if (typeof AudioContext === 'undefined') return
    ctx ??= new AudioContext()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const pan = ctx.createStereoPanner()
    // Left and right also differ in pitch, so the cue works on speakers too.
    osc.frequency.value = dir < 0 ? 660 : 990
    pan.pan.value = dir < 0 ? -0.9 : 0.9
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
    osc.connect(gain).connect(pan).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.1)
  }
}
