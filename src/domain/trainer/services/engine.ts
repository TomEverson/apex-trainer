/**
 * First-person camera, projection and Canvas 2D renderer (SPEC-001).
 * Angles are degrees: yaw + = right, pitch + = up. Eye looks down +Z at yaw 0.
 */
import { PILL } from '../../../common/lib/recoil'

const DEG = Math.PI / 180
export const EYE = { x: 0, y: 1.4, z: 0 }

type Vec3 = { x: number; y: number; z: number }
export type Camera = { yaw: number; pitch: number }

export function dirTo(p: Vec3) {
  const dx = p.x - EYE.x, dy = p.y - EYE.y, dz = p.z - EYE.z
  return {
    yaw: Math.atan2(dx, dz) / DEG,
    pitch: Math.atan2(dy, Math.hypot(dx, dz)) / DEG,
    dist: Math.hypot(dx, dy, dz),
  }
}

/** True when the crosshair ray passes through the target sphere. */
export function isOnTarget(cam: Camera, pos: Vec3, radius: number): boolean {
  const cy = Math.cos(cam.yaw * DEG), sy = Math.sin(cam.yaw * DEG)
  const cp = Math.cos(cam.pitch * DEG), sp = Math.sin(cam.pitch * DEG)
  const dx = pos.x - EYE.x, dy = pos.y - EYE.y, dz = pos.z - EYE.z
  const dist = Math.hypot(dx, dy, dz)
  const cos = (sy * cp * dx + sp * dy + cy * cp * dz) / dist
  return Math.acos(Math.min(1, cos)) < Math.asin(Math.min(1, radius / dist))
}

export class Renderer {
  private ctx: CanvasRenderingContext2D
  private w = 0
  private h = 0
  private focal = 1

  constructor(private canvas: HTMLCanvasElement, private fovDeg: number) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D not supported')
    this.ctx = ctx
    this.resize()
  }

  resize() {
    const dpr = window.devicePixelRatio || 1
    this.w = this.canvas.clientWidth
    this.h = this.canvas.clientHeight
    this.canvas.width = Math.round(this.w * dpr)
    this.canvas.height = Math.round(this.h * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.focal = this.w / 2 / Math.tan((this.fovDeg * DEG) / 2)
  }

  get size() {
    return `${this.w}x${this.h}`
  }

  private toCamera(cam: Camera, p: Vec3): Vec3 {
    const cy = Math.cos(cam.yaw * DEG), sy = Math.sin(cam.yaw * DEG)
    const cp = Math.cos(cam.pitch * DEG), sp = Math.sin(cam.pitch * DEG)
    const rx = p.x - EYE.x, ry = p.y - EYE.y, rz = p.z - EYE.z
    const x1 = rx * cy - rz * sy
    const z1 = rx * sy + rz * cy
    return { x: x1, y: ry * cp - z1 * sp, z: ry * sp + z1 * cp }
  }

  private project(c: Vec3) {
    return { x: this.w / 2 + (c.x * this.focal) / c.z, y: this.h / 2 - (c.y * this.focal) / c.z }
  }

  /** Line segment clipped against the near plane. */
  private line(cam: Camera, a: Vec3, b: Vec3) {
    const near = 0.05
    let ca = this.toCamera(cam, a), cb = this.toCamera(cam, b)
    if (ca.z < near && cb.z < near) return
    if (ca.z < near || cb.z < near) {
      const t = (near - ca.z) / (cb.z - ca.z)
      const clip = { x: ca.x + (cb.x - ca.x) * t, y: ca.y + (cb.y - ca.y) * t, z: near }
      if (ca.z < near) ca = clip
      else cb = clip
    }
    const pa = this.project(ca), pb = this.project(cb)
    this.ctx.moveTo(pa.x, pa.y)
    this.ctx.lineTo(pb.x, pb.y)
  }

  /** Floor grid plus a back wall at `far` meters (recoil drills push it past the target). */
  drawWorld(cam: Camera, far = 40) {
    const { ctx } = this
    // Coarser grid on long ranges so distant lines don't turn into moiré.
    const step = far > 60 ? 10 : 2
    const half = Math.max(40, Math.ceil(far / 2 / step) * step)
    const wallH = far > 60 ? 40 : 14
    ctx.fillStyle = '#121418'
    ctx.fillRect(0, 0, this.w, this.h)
    ctx.lineWidth = 1
    ctx.strokeStyle = '#262a31'
    ctx.beginPath()
    for (let x = -half; x <= half; x += step) this.line(cam, { x, y: 0, z: -40 }, { x, y: 0, z: far })
    for (let z = -40; z <= far; z += step) this.line(cam, { x: -half, y: 0, z }, { x: half, y: 0, z })
    ctx.stroke()
    // Back wall grid as a depth cue.
    ctx.strokeStyle = '#1f232a'
    ctx.beginPath()
    for (let x = -half; x <= half; x += step) this.line(cam, { x, y: 0, z: far }, { x, y: wallH, z: far })
    for (let y = 0; y <= wallH; y += step) this.line(cam, { x: -half, y, z: far }, { x: half, y, z: far })
    ctx.stroke()
  }

  drawTarget(cam: Camera, pos: Vec3, radius: number, onTarget: boolean, shadow = true) {
    const { ctx } = this
    const c = this.toCamera(cam, pos)
    if (c.z <= 0.1) return
    const p = this.project(c)
    const r = (radius * this.focal) / c.z
    // Floor shadow helps read height on jumping targets.
    const sh = this.toCamera(cam, { x: pos.x, y: 0, z: pos.z })
    if (shadow && sh.z > 0.1) {
      const ps = this.project(sh)
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.beginPath()
      ctx.ellipse(ps.x, ps.y, r, r * 0.3, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    const g = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.35, r * 0.1, p.x, p.y, r)
    if (onTarget) {
      g.addColorStop(0, '#9ff5c4')
      g.addColorStop(1, '#1f9d5c')
    } else {
      g.addColorStop(0, '#ffb4a8')
      g.addColorStop(1, '#c2412d')
    }
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  /** Ghost outline + floor post marking where a sweep target reverses. */
  drawTurnMarker(cam: Camera, pos: Vec3, radius: number) {
    const { ctx } = this
    ctx.strokeStyle = 'rgba(255, 196, 77, 0.45)'
    ctx.lineWidth = 2
    ctx.beginPath()
    this.line(cam, { x: pos.x, y: 0, z: pos.z }, { x: pos.x, y: pos.y - radius, z: pos.z })
    this.line(cam, { x: pos.x, y: pos.y + radius, z: pos.z }, { x: pos.x, y: pos.y + radius * 4, z: pos.z })
    ctx.stroke()
    const c = this.toCamera(cam, pos)
    if (c.z <= 0.1) return
    const p = this.project(c)
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.arc(p.x, p.y, (radius * this.focal) / c.z, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  }

  /** Health bar above a target; frac 1 = full. */
  drawHealthBar(cam: Camera, pos: Vec3, radius: number, frac: number) {
    const { ctx } = this
    const c = this.toCamera(cam, pos)
    if (c.z <= 0.1) return
    const p = this.project(c)
    const r = (radius * this.focal) / c.z
    const w = Math.max(36, r * 2.4), h = 5
    const x = p.x - w / 2, y = p.y - r - 12
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2)
    ctx.fillStyle = frac > 0.35 ? '#f0efec' : '#ffb4a8'
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h)
  }

  /** Upright pill standing at base (feet), drawn as a camera-facing silhouette. */
  drawPill(cam: Camera, base: Vec3) {
    const bot = this.toCamera(cam, { x: base.x, y: PILL.radius, z: base.z })
    const top = this.toCamera(cam, { x: base.x, y: PILL.height - PILL.radius, z: base.z })
    if (bot.z <= 0.1 || top.z <= 0.1) return
    const a = this.project(bot), b = this.project(top)
    const r = (PILL.radius * this.focal) / bot.z
    const { ctx } = this
    ctx.fillStyle = '#6a7282'
    ctx.beginPath()
    ctx.arc(b.x, b.y, r, Math.PI, 0)
    ctx.lineTo(a.x + r, a.y)
    ctx.arc(a.x, a.y, r, 0, Math.PI)
    ctx.closePath()
    ctx.fill()
  }

  /** Optic view: dimmed (still see-through) outside a circular lens with a thin rim. */
  drawScope() {
    const { ctx } = this
    const cx = this.w / 2, cy = this.h / 2
    const r = Math.min(this.w, this.h) * 0.46
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
    ctx.beginPath()
    ctx.rect(0, 0, this.w, this.h)
    ctx.arc(cx, cy, r, 0, Math.PI * 2, true)
    ctx.fill()
    ctx.strokeStyle = '#2b2f36'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  }

  /** Bullet impact: hit 1 on the target, 0 miss. */
  drawImpact(cam: Camera, pos: Vec3, hit: number) {
    const c = this.toCamera(cam, pos)
    if (c.z <= 0.1) return
    const p = this.project(c)
    const { ctx } = this
    ctx.fillStyle = hit ? '#ffd166' : 'rgba(170,175,185,0.55)'
    ctx.beginPath()
    ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2)
    ctx.fill()
  }

  drawCrosshair(size: number) {
    const { ctx } = this
    const cx = this.w / 2, cy = this.h / 2
    ctx.fillStyle = '#000'
    ctx.fillRect(cx - size / 2 - 1, cy - size / 2 - 1, size + 2, size + 2)
    ctx.fillStyle = '#4dffd2'
    ctx.fillRect(cx - size / 2, cy - size / 2, size, size)
  }
}
