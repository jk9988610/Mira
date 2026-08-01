import { massToRadius } from './physics'

export interface CircleEntity {
  id: number
  name: string
  x: number
  y: number
  mass: number
  isPlayer: boolean
  colorLight: string
  colorDark: string
  strokeColor: string
  wanderAngle: number
  wanderTimer: number
  respawnTimer: number
  invincibleTimer: number
}

let nextId = 1

export function createCircle(
  x: number,
  y: number,
  mass: number,
  isPlayer: boolean,
  roster: { name: string; colorLight: string; colorDark: string; strokeColor: string },
): CircleEntity {
  return {
    id: nextId++,
    name: roster.name,
    x,
    y,
    mass,
    isPlayer,
    colorLight: roster.colorLight,
    colorDark: roster.colorDark,
    strokeColor: roster.strokeColor,
    wanderAngle: Math.random() * Math.PI * 2,
    wanderTimer: 1 + Math.random() * 2,
    respawnTimer: 0,
    invincibleTimer: 0,
  }
}

export function entityRadius(entity: CircleEntity): number {
  return massToRadius(entity.mass)
}

export function isActive(entity: CircleEntity): boolean {
  return entity.respawnTimer <= 0
}

export function isInvincible(entity: CircleEntity): boolean {
  return entity.invincibleTimer > 0
}

export function drawCircleEntity(
  ctx: CanvasRenderingContext2D,
  entity: CircleEntity,
  flash = 0,
  time = 0,
): void {
  if (!isActive(entity)) return

  const r = entityRadius(entity)
  const { x, y, colorLight, colorDark, strokeColor, name } = entity

  let alpha = 1
  if (entity.invincibleTimer > 0) {
    alpha = 0.35 + 0.65 * Math.abs(Math.sin(time * 12))
  }

  ctx.save()
  ctx.globalAlpha = alpha

  if (flash > 0) {
    ctx.beginPath()
    ctx.arc(x, y, r + 8 * flash, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(143, 211, 255, ${0.35 * flash / 0.18})`
    ctx.fill()
  }

  const gradient = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r)
  gradient.addColorStop(0, colorLight)
  gradient.addColorStop(1, colorDark)
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = 2
  ctx.stroke()

  if (r > 18) {
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.font = `600 ${Math.min(16, r * 0.38)}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(name, x, y)
  }

  ctx.restore()
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
