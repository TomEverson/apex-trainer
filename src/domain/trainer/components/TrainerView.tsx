import { useEffect, useRef, useState, type RefObject } from 'react'
import type { Environment, Settings } from '../../../common/lib/tracking'
import { enterFullscreen, toggleFullscreen } from '../../../common/lib/fullscreen'
import { Renderer, type Camera } from '../services/engine'
import { createRunLogic, drillLabels, type Drill, type RunData, type RunHooks } from '../services/logic'
import { createStrafeBeeper } from '../services/cues'

export type RunResult = {
  run: RunData
  seed: number
  startedAt: string
  endedAt: string
  environment: Environment
}

type Props = {
  drill: Drill
  settings: Settings
  /** Degrees of rotation per reported movementX unit, from the settings domain. */
  degPerUnit: number
  /** Rendered horizontal FOV when it differs from settings (an optic's zoom). */
  fovDeg?: number
  onFinish: (result: RunResult) => void
  onAbort: () => void
}

type Phase = 'waiting' | 'countdown' | 'live'

/**
 * Run shell: pointer lock, countdown, input, HUD, R/F/Esc and the frame loop.
 * What the targets do and what gets recorded is the RunLogic's job (tracking,
 * clicking or recoil). Everything per-frame lives in closures — React state only
 * changes for the overlay text.
 */
export function TrainerView({ drill, settings, degPerUnit, fovDeg, onFinish, onAbort }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  const scoreRef = useRef<HTMLSpanElement>(null)
  const fpsRef = useRef<HTMLSpanElement>(null)
  const [overlay, setOverlay] = useState<string | null>('Click to start')
  // Keep latest callbacks without restarting the run when the parent re-renders.
  const finishRef = useRef(onFinish)
  const abortRef = useRef(onAbort)
  useEffect(() => {
    finishRef.current = onFinish
    abortRef.current = onAbort
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = new Renderer(canvas, fovDeg ?? settings.fov)
    // Recoil drills put the back wall behind the target, up to 200 m out.
    const worldDepth = drill.kind === 'recoil' ? Math.max(40, drill.drill.rangeM + 20) : 40
    const hooks: RunHooks = drill.kind === 'recoil' && drill.drill.mode === 'strafe' && drill.drill.strafeAudio
      ? { strafeCue: createStrafeBeeper() }
      : {}
    let seed = 0
    let logic = createRunLogic(drill, seed, settings.duration, hooks)
    const cam: Camera = { yaw: 0, pitch: 0 }

    let phase: Phase = 'waiting'
    let countdownEnd = 0, startT = 0, lastT = 0, liveS = 0
    let frames = 0
    let rawInput = false, done = false
    // Switching fullscreen can drop pointer lock; treat that as a restart, not an abort.
    let ignoreUnlockUntil = 0
    let startedAt = ''

    /** Fresh run state. Keeps pointer lock, so R restarts without another click. */
    const resetRun = (initial = false) => {
      seed = (Math.random() * 2 ** 32) >>> 0
      logic = createRunLogic(drill, seed, settings.duration, hooks)
      cam.yaw = logic.start.yaw
      cam.pitch = logic.start.pitch
      cam.x = 0
      frames = 0
      liveS = 0
      startedAt = ''
      if (document.pointerLockElement === canvas) {
        phase = 'countdown'
        countdownEnd = performance.now() + settings.countdownS * 1000
      } else {
        phase = 'waiting'
        if (!initial) setOverlay('Click to start')
      }
      if (timeRef.current) timeRef.current.textContent = logic.progress(0)
      if (scoreRef.current) scoreRef.current.textContent = logic.hud()
    }
    resetRun(true)
    let raf = 0
    // Live FPS over a rolling 0.5 s window (engine comparison: Chrome vs Safari/WebKit).
    let fpsFrames = 0, fpsSince = 0

    const finish = () => {
      done = true
      document.exitPointerLock()
      finishRef.current({
        run: logic.data(), seed, startedAt,
        endedAt: new Date().toISOString(),
        environment: {
          rawInput,
          avgFps: Math.round(frames / Math.max(1e-3, liveS)),
          screen: renderer.size,
          userAgent: navigator.userAgent,
        },
      })
    }

    const frame = (now: number) => {
      if (done) return
      raf = requestAnimationFrame(frame)
      const t = now / 1000
      const dt = lastT ? Math.min(0.1, t - lastT) : 0
      lastT = t
      fpsFrames++
      if (now - fpsSince >= 500) {
        if (fpsRef.current && fpsSince) fpsRef.current.textContent = String(Math.round((fpsFrames * 1000) / (now - fpsSince)))
        fpsFrames = 0
        fpsSince = now
      }

      if (phase === 'countdown') {
        const left = countdownEnd - now
        setOverlay(String(Math.ceil(left / 1000)))
        if (left <= 0) {
          phase = 'live'
          startT = t
          startedAt = new Date().toISOString()
          setOverlay(null)
        }
      }

      if (phase === 'live') {
        const elapsed = t - startT
        logic.frame(elapsed, dt, cam)
        frames++
        liveS = elapsed
        if (timeRef.current) timeRef.current.textContent = logic.progress(elapsed)
        if (scoreRef.current) scoreRef.current.textContent = logic.hud()
        if (logic.done(elapsed)) {
          cancelAnimationFrame(raf)
          return finish()
        }
      }

      renderer.drawWorld(cam, worldDepth)
      logic.draw(renderer, cam, phase === 'live')
      renderer.drawCrosshair(settings.crosshairSize)
    }

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return
      cam.yaw = ((cam.yaw + e.movementX * degPerUnit + 540) % 360) - 180
      cam.pitch = Math.max(-89, Math.min(89, cam.pitch - e.movementY * degPerUnit))
    }

    const onMouseDown = async (e: MouseEvent) => {
      if (phase === 'live' && document.pointerLockElement === canvas) {
        if (e.button === 0) {
          const elapsed = performance.now() / 1000 - startT
          logic.click(elapsed, cam)
          logic.trigger(true, elapsed)
        }
        return
      }
      if (phase !== 'waiting' || document.pointerLockElement === canvas) return
      if (settings.autoFullscreen && !document.fullscreenElement) {
        // Opened without the card click (e.g. reload): this click enters
        // fullscreen; the next one locks the mouse.
        ignoreUnlockUntil = performance.now() + 1500
        void enterFullscreen()
        return
      }
      try {
        // Raw input bypasses OS pointer acceleration where the browser supports it.
        await canvas.requestPointerLock({ unadjustedMovement: true })
        rawInput = true
      } catch {
        try {
          await canvas.requestPointerLock()
        } catch {
          return // needs another click
        }
        rawInput = false
      }
    }

    const onMouseUp = (e: MouseEvent) => {
      if (phase === 'live' && e.button === 0) logic.trigger(false, performance.now() / 1000 - startT)
    }

    const onLockChange = () => {
      if (done) return
      if (document.pointerLockElement === canvas) {
        if (phase === 'waiting') {
          phase = 'countdown'
          countdownEnd = performance.now() + settings.countdownS * 1000
        }
      } else if (phase !== 'waiting') {
        if (performance.now() < ignoreUnlockUntil) {
          resetRun()
          return
        }
        done = true
        abortRef.current()
      }
    }

    const onKey = (e: KeyboardEvent) => {
      // Always forwarded so a key held before GO counts; logic only logs while spraying.
      if (!e.repeat) logic.key(e.code, true, performance.now() / 1000 - startT)
      if ((e.key === 'f' || e.key === 'F') && !e.repeat) {
        ignoreUnlockUntil = performance.now() + 1500
        void toggleFullscreen()
        return
      }
      if ((e.key === 'r' || e.key === 'R') && !e.repeat) {
        resetRun(true)
        return
      }
      if (e.key === 'Escape' && phase === 'waiting') {
        done = true
        abortRef.current()
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      logic.key(e.code, false, performance.now() / 1000 - startT)
    }

    const onResize = () => renderer.resize()

    canvas.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('pointerlockchange', onLockChange)
    document.addEventListener('keydown', onKey)
    document.addEventListener('keyup', onKeyUp)
    window.addEventListener('resize', onResize)
    raf = requestAnimationFrame(frame)

    return () => {
      done = true
      cancelAnimationFrame(raf)
      canvas.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('pointerlockchange', onLockChange)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('resize', onResize)
      if (document.pointerLockElement === canvas) document.exitPointerLock()
    }
  }, [drill, settings, degPerUnit, fovDeg])

  const labels = drillLabels(drill)
  const initialProgress = drill.kind === 'recoil' ? `1/${drill.drill.sprays}` : settings.duration.toFixed(1)
  return (
    <div className="fixed inset-0 cursor-crosshair select-none">
      <canvas ref={canvasRef} className="block h-full w-full" />
      {settings.showHud && (
        <div className="pointer-events-none fixed top-4 left-1/2 flex -translate-x-1/2 gap-7 text-center">
          <HudItem label={labels.progress} spanRef={timeRef} initial={initialProgress} />
          <HudItem label={labels.score} spanRef={scoreRef} initial={labels.score === 'kills' ? '0' : '0.0%'} />
          <HudItem label="fps" spanRef={fpsRef} initial="–" />
        </div>
      )}
      {overlay && (
        <div className="pointer-events-none fixed inset-0 grid place-items-center text-center">
          <div>
            <div className="text-6xl font-extrabold [text-shadow:0_2px_20px_#000]">{overlay}</div>
            {overlay === 'Click to start' && (
              <p className="mt-3 text-sm text-ink-2">
                {labels.name} · {drill.kind === 'recoil' ? `${drill.drill.sprays} sprays · hold left click${drill.drill.mode === 'strafe' ? ' · strafe A/D on the cues' : ''} · Tab guide` : `${settings.duration}s`} · R restart · F fullscreen · Esc to leave
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function HudItem({ label, spanRef, initial }: { label: string; spanRef: RefObject<HTMLSpanElement | null>; initial: string }) {
  return (
    <div>
      <span ref={spanRef} className="text-2xl font-bold tabular-nums">{initial}</span>
      <div className="text-[11px] tracking-widest text-muted uppercase">{label}</div>
    </div>
  )
}
