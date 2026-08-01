import { massToRadius } from './physics'

export interface CircleEntity {
  id: number
  x: number
  y: number
  mass: number
  isPlayer: boolean
  hue: number
  wanderAngle: number
  wanderTimer: number
}

let nextId = 1

export function createCircle(
  x: number,
  y: number,
  mass: number,
  isPlayer: boolean,
  hue: number,
): CircleEntity {
  return {
    id: nextId++,
    x,
    y,
    mass,
    isPlayer,
    hue,
    wanderAngle: Math.random() * Math.PI * 2,
    wanderTimer: 1 + Math.random() * 2,
  }
}

export function entityRadius(entity: CircleEntity): number {
  return massToRadius(entity.mass)
}

export function drawCircleEntity(
  ctx: CanvasRenderingContext2D,
  entity: CircleEntity,
  flash = 0,
): void {
  const r = entityRadius(entity)
  const { x, y, hue, isPlayer } = entity

  if (flash > 0) {
    ctx.beginPath()
    ctx.arc(x, y, r + 8 * flash, 0, Math.PI * 2)
    ctx.fillStyle = isPlayer
      ? `rgba(143, 211, 255, ${0.35 * flash / 0.18})`
      : `rgba(255, 160, 120, ${0.35 * flash / 0.18})`
    ctx.fill()
  }

  const light = isPlayer ? '#8fd3ff' : `hsl(${hue} 75% 68%)`
  const dark = isPlayer ? '#2f7fd3' : `hsl(${hue} 65% 42%)`
  const gradient = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r)
  gradient.addColorStop(0, light)
  gradient.addColorStop(1, dark)
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = isPlayer ? '#d8f1ff' : `hsl(${hue} 80% 82%)`
  ctx.lineWidth = 2
  ctx.stroke()
}

export function clampEntityToWorld(
  entity: CircleEntity,
  width: number,
  height: number,
): void {
  const r = entityRadius(entity)
  entity.x = clamp(entity.x, r, width - r)
  entity.y = clamp(entity.y, r, height - r)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
