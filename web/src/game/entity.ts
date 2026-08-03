import { massToRadius } from './physics'
import { ENTITY_SIMPLE_DRAW_RADIUS } from './perf-config'

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
  impulseX: number
  impulseY: number
  /** 化身模式：农场 / 牧场 / 友方后代 */
  avatarRole: AvatarRole
  isFrozen: boolean
  pelletSpawnTimer: number
  allySpawnTimer: number
  avatarIncubateTimer: number
  pendingAvatarKind: 'none' | 'farm' | 'ranch'
  /** 化身冷却剩余时间（秒） */
  avatarTransformCooldown: number
  builderName: string
  /** 化身模式：剩余寿命（秒） */
  lifespanSec: number
  /** 化身模式：饱食度 0~1，降至 0 时开始消耗质量 */
  satiety: number
  /** 化身模式：饱食度过高时暂停摄取颗粒 */
  absorptionPaused: boolean
  /** 化身模式：农场/牧场已产出轮次 */
  structureProduceCount: number
  /** 连续低于初始质量的秒数 */
  lowMassSec: number
  /** 饱食度低于警戒阈值的累计秒数（评估窗口内） */
  lowSatietySec: number
  /** 评估窗口内休息秒数 */
  restSec: number
  /** 评估窗口内工作（移动）秒数 */
  workSec: number
  /** 累计化身农场/牧场次数 */
  avatarTransformCount: number
  /** 规律进食评分 0~1 */
  feedRegularity: number
  /** 寿命评估倒计时 */
  lifespanEvalTimer: number
}

export type AvatarRole = 'none' | 'farm' | 'ranch' | 'ally'

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
    impulseX: 0,
    impulseY: 0,
    avatarRole: 'none',
    isFrozen: false,
    pelletSpawnTimer: 0,
    allySpawnTimer: 0,
    avatarIncubateTimer: 0,
    pendingAvatarKind: 'none',
    avatarTransformCooldown: 0,
    builderName: roster.name,
    lifespanSec: 0,
    satiety: 1,
    absorptionPaused: false,
    structureProduceCount: 0,
    lowMassSec: 0,
    lowSatietySec: 0,
    restSec: 0,
    workSec: 0,
    avatarTransformCount: 0,
    feedRegularity: 0.5,
    lifespanEvalTimer: 0,
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

  if (r < ENTITY_SIMPLE_DRAW_RADIUS) {
    ctx.fillStyle = colorLight
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.restore()
    return
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
