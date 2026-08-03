import { AVATAR_BASE_RADIUS } from './avatar-config'
import { SURFACE_DENSITY, PELLET_MAX_RADIUS } from './physics'

export type PelletKind = 'food' | 'knowledge' | 'joy'

export interface Pellet {
  id: number
  x: number
  y: number
  sides: number
  radius: number
  mass: number
  hue: number
  kind: PelletKind
}

const MASS_MULTIPLIERS: Record<number, number> = {
  3: 1,
  4: 1.2,
  5: 1.35,
  6: 1.5,
}

const SIDE_OPTIONS = [3, 4, 5, 6] as const
export const PELLET_MIN_RADIUS = 6
export { PELLET_MAX_RADIUS } from './physics'

let nextId = 1

export function polygonArea(sides: number, radius: number): number {
  return (sides / 2) * radius * radius * Math.sin((2 * Math.PI) / sides)
}

export function pelletMass(sides: number, radius: number): number {
  const multiplier = MASS_MULTIPLIERS[sides] ?? 1
  return SURFACE_DENSITY * polygonArea(sides, radius) * multiplier
}

export function createPellet(
  x: number,
  y: number,
  sides?: number,
  radius?: number,
  kind: PelletKind = 'food',
): Pellet {
  const s = sides ?? SIDE_OPTIONS[Math.floor(Math.random() * SIDE_OPTIONS.length)]
  const r = radius ?? PELLET_MIN_RADIUS + Math.random() * (PELLET_MAX_RADIUS - PELLET_MIN_RADIUS)
  const hue =
    kind === 'knowledge' ? 210 + Math.random() * 25 : kind === 'joy' ? 38 + Math.random() * 28 : 120 + Math.random() * 80
  return {
    id: nextId++,
    x,
    y,
    sides: s,
    radius: r,
    mass: pelletMass(s, r),
    hue,
    kind,
  }
}

export function createTraitPellet(x: number, y: number, kind: 'knowledge' | 'joy'): Pellet {
  const radius = PELLET_MIN_RADIUS + 1 + Math.random() * 3
  const sides = kind === 'knowledge' ? 4 : 5
  return createPellet(x, y, sides, radius, kind)
}

/** 颗粒中心距世界边缘的最小距离，保证实体能靠近并摄取 */
export function pelletAbsorbInset(pelletRadius = PELLET_MAX_RADIUS): number {
  return AVATAR_BASE_RADIUS + pelletRadius * 0.35 + 8
}

export function clampPelletPosition(
  x: number,
  y: number,
  radius: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const inset = pelletAbsorbInset(radius)
  return {
    x: Math.max(inset, Math.min(width - inset, x)),
    y: Math.max(inset, Math.min(height - inset, y)),
  }
}

function placePelletInWorld(
  pellet: Pellet,
  width: number,
  height: number,
): Pellet {
  const pos = clampPelletPosition(pellet.x, pellet.y, pellet.radius, width, height)
  pellet.x = pos.x
  pellet.y = pos.y
  return pellet
}

export function spawnPellets(
  count: number,
  width: number,
  height: number,
  margin = pelletAbsorbInset(),
): Pellet[] {
  const pellets: Pellet[] = []
  for (let i = 0; i < count; i++) {
    pellets.push(
      placePelletInWorld(
        createPellet(
          margin + Math.random() * (width - margin * 2),
          margin + Math.random() * (height - margin * 2),
        ),
        width,
        height,
      ),
    )
  }
  return pellets
}

/** 食物/知识/快乐各生成 perKind 个，总数 3×perKind */
export function spawnBalancedPellets(
  perKind: number,
  width: number,
  height: number,
): Pellet[] {
  const inset = pelletAbsorbInset()
  const spanX = width - inset * 2
  const spanY = height - inset * 2
  const pellets: Pellet[] = []
  const kinds: PelletKind[] = ['food', 'knowledge', 'joy']
  for (const kind of kinds) {
    for (let i = 0; i < perKind; i++) {
      const x = inset + Math.random() * spanX
      const y = inset + Math.random() * spanY
      const pellet =
        kind === 'food'
          ? createPellet(x, y)
          : createTraitPellet(x, y, kind)
      pellets.push(placePelletInWorld(pellet, width, height))
    }
  }
  return pellets
}

import type { ViewBounds } from './viewport'
import { isInView } from './viewport'

export function drawPelletsInView(
  ctx: CanvasRenderingContext2D,
  pellets: Pellet[],
  bounds: ViewBounds,
): void {
  for (const pellet of pellets) {
    if (!isInView(pellet.x, pellet.y, bounds, pellet.radius)) continue
    drawPellet(ctx, pellet)
  }
}

export function drawPellet(ctx: CanvasRenderingContext2D, pellet: Pellet): void {
  const { x, y, sides, radius, hue, kind } = pellet
  if (kind === 'knowledge') {
    ctx.save()
    ctx.translate(x, y)
    ctx.fillStyle = `hsl(${hue} 72% 62%)`
    ctx.strokeStyle = `hsl(${hue} 85% 82%)`
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.rect(-radius, -radius, radius * 2, radius * 2)
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(-radius * 0.55, 0)
    ctx.lineTo(0, -radius * 0.55)
    ctx.lineTo(radius * 0.55, 0)
    ctx.lineTo(0, radius * 0.55)
    ctx.closePath()
    ctx.strokeStyle = `hsl(${hue} 90% 90%)`
    ctx.stroke()
    ctx.restore()
    return
  }
  if (kind === 'joy') {
    ctx.save()
    ctx.translate(x, y)
    ctx.fillStyle = `hsl(${hue} 78% 60%)`
    ctx.strokeStyle = `hsl(${hue} 88% 80%)`
    ctx.lineWidth = 1.5
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2
      const px = Math.cos(angle) * radius
      const py = Math.sin(angle) * radius
      if (i === 0) ctx.beginPath(), ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, 0, radius * 0.28, 0, Math.PI * 2)
    ctx.fillStyle = `hsl(${hue} 95% 92%)`
    ctx.fill()
    ctx.restore()
    return
  }
  ctx.beginPath()
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2
    const px = x + Math.cos(angle) * radius
    const py = y + Math.sin(angle) * radius
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fillStyle = `hsl(${hue} 68% 58%)`
  ctx.fill()
  ctx.strokeStyle = `hsl(${hue} 80% 78%)`
  ctx.lineWidth = 1.5
  ctx.stroke()
}

export function canAbsorbPellet(
  playerX: number,
  playerY: number,
  absorbRadius: number,
  pellet: Pellet,
): boolean {
  const dx = pellet.x - playerX
  const dy = pellet.y - playerY
  const dist = Math.hypot(dx, dy)
  return dist <= absorbRadius + pellet.radius * 0.45
}
