import { SURFACE_DENSITY, PELLET_MAX_RADIUS } from './physics'

export interface Pellet {
  id: number
  x: number
  y: number
  sides: number
  radius: number
  mass: number
  hue: number
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

export function createPellet(x: number, y: number, sides?: number, radius?: number): Pellet {
  const s = sides ?? SIDE_OPTIONS[Math.floor(Math.random() * SIDE_OPTIONS.length)]
  const r = radius ?? PELLET_MIN_RADIUS + Math.random() * (PELLET_MAX_RADIUS - PELLET_MIN_RADIUS)
  return {
    id: nextId++,
    x,
    y,
    sides: s,
    radius: r,
    mass: pelletMass(s, r),
    hue: 120 + Math.random() * 80,
  }
}

export function spawnPellets(
  count: number,
  width: number,
  height: number,
  margin = 24,
): Pellet[] {
  const pellets: Pellet[] = []
  for (let i = 0; i < count; i++) {
    pellets.push(
      createPellet(
        margin + Math.random() * (width - margin * 2),
        margin + Math.random() * (height - margin * 2),
      ),
    )
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
  const { x, y, sides, radius, hue } = pellet
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
  playerRadius: number,
  pellet: Pellet,
): boolean {
  const dx = pellet.x - playerX
  const dy = pellet.y - playerY
  const dist = Math.hypot(dx, dy)
  return dist < playerRadius - pellet.radius * 0.35
}
