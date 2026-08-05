import { ADULT_AGE_SEC, SCHEDULE_DAY_SEC } from './avatar-config'
import { initEntityDna } from './dna'
import { syncEntityGeo } from './geo'
import { massToRadius, PLAYER_START_MASS } from './physics'
import { ENTITY_SIMPLE_DRAW_RADIUS } from './perf-config'

export type Gender = 'male' | 'female'
export type AvatarRole = 'none' | 'farm' | 'school' | 'park' | 'ally'
export type TransformKind = 'farm' | 'school' | 'park'
export type ProductionStage = 'none' | 'active'

export interface CircleInitOptions {
  gender?: Gender
  generation?: number
  motherId?: number
  fatherId?: number
  familyId?: number
  birthGameTimeSec?: number
  paternalDna?: number
  maternalDna?: number
}

export interface CircleEntity {
  id: number
  name: string
  x: number
  y: number
  lat: number
  lng: number
  mass: number
  bodyMass: number
  intakeMass: number
  health: number
  isPlayer: boolean
  gender: Gender
  generation: number
  motherId: number
  fatherId: number
  familyId: number
  birthGameTimeSec: number
  birthX: number
  birthY: number
  dnaFingerprint: number
  paternalDna: number
  maternalDna: number
  childrenCount: number
  colorLight: string
  colorDark: string
  strokeColor: string
  wanderAngle: number
  wanderTimer: number
  respawnTimer: number
  invincibleTimer: number
  impulseX: number
  impulseY: number
  avatarRole: AvatarRole
  isFrozen: boolean
  pelletSpawnTimer: number
  avatarIncubateTimer: number
  pendingAvatarKind: TransformKind | 'none'
  avatarTransformCooldown: number
  avatarTransformTimer: number
  builderName: string
  visualScale: number
  knowledge: number
  knowledgeIntake: number
  joy: number
  joyIntake: number
  lifespanSec: number
  satiety: number
  absorptionPaused: boolean
  structureProduceCount: number
  lowMassSec: number
  lowSatietySec: number
  restSec: number
  workSec: number
  avatarTransformCount: number
  countFarmTransforms: number
  countSchoolTransforms: number
  countParkTransforms: number
  countProduceTransforms: number
  countProductionSessions: number
  feedRegularity: number
  lifespanEvalTimer: number
  transformHistory: TransformKind[]
  productionStage: ProductionStage
  productionTimer: number
  productionCooldown: number
  productionPartnerId: number
  mateSeekUrge: number
  scheduleOffsetSec: number
  aiIntent: 'eat' | 'learn' | 'play' | 'sleep' | 'wander' | 'wait'
  aiPelletTargetId: number
  aiPelletTargetTimer: number
  /** 意图目标坐标 */
  intentTargetX: number
  intentTargetY: number
  /** 预计到达意图目标的秒数 */
  intentEtaSec: number
  /** 当前追踪的光环发射源 id */
  aiEmitterTargetId: number
  /** 光环发射剩余秒数（结构体限时广播） */
  emitBurstSec: number
  aiAnchorX: number
  aiAnchorY: number
  aiAnchorTimer: number
  aiMateTargetId: number
  /** 出生后依恋母亲剩余秒数 @deprecated 后代不再依恋母亲 */
  motherBondTimer: number
  /** 闲逛目标方向（单位向量） */
  wanderDirX: number
  wanderDirY: number
  /** 正在履行的市场订单 id */
  marketContractOrderId: number
  /** 市场订单服务点位 */
  contractTargetX: number
  contractTargetY: number
  /** 订单履约光环类型（farm/school/park） */
  orderServiceKind: TransformKind | 'none'
  /** 订单履约剩余秒数（>0 表示正在展开光环服务） */
  orderServiceTimer: number
  /** 当前求偶意图窗口已持续秒数 */
  mateIntentElapsedSec: number
  /** 求偶意识冷却剩余秒数（指数退避） */
  mateIntentCooldownSec: number
  /** 已完成求偶意图轮次（用于指数冷却） */
  mateIntentCycles: number
  /** 已登记为化身者，可接单履约 */
  isAvatarPractitioner: boolean
  /** 化身者入册掷骰间隔计时 */
  practitionerRollTimer: number
}

let nextId = 1

export function entityAgeSec(entity: CircleEntity, gameTimeSec: number): number {
  return Math.max(0, gameTimeSec - entity.birthGameTimeSec)
}

export function secondsUntilAdult(entity: CircleEntity, gameTimeSec: number): number {
  return Math.max(0, ADULT_AGE_SEC - entityAgeSec(entity, gameTimeSec))
}

export function isAdult(entity: CircleEntity, gameTimeSec = 0): boolean {
  return entityAgeSec(entity, gameTimeSec) >= ADULT_AGE_SEC
}

export function isJuvenile(entity: CircleEntity, gameTimeSec = 0): boolean {
  return !isAdult(entity, gameTimeSec)
}

export function createCircle(
  x: number,
  y: number,
  mass: number,
  isPlayer: boolean,
  roster: { name: string; colorLight: string; colorDark: string; strokeColor: string },
  options: CircleInitOptions = {},
): CircleEntity {
  const gender = options.gender ?? (nextId % 2 === 0 ? 'male' : 'female')
  const entity: CircleEntity = {
    id: nextId++,
    name: roster.name,
    x,
    y,
    lat: 0,
    lng: 0,
    mass,
    bodyMass: mass,
    intakeMass: 0,
    health: PLAYER_START_MASS * 4,
    isPlayer,
    gender,
    generation: options.generation ?? 0,
    motherId: options.motherId ?? 0,
    fatherId: options.fatherId ?? 0,
    familyId: options.familyId ?? 0,
    birthGameTimeSec: options.birthGameTimeSec ?? 0,
    birthX: x,
    birthY: y,
    dnaFingerprint: 0,
    paternalDna: options.paternalDna ?? 0,
    maternalDna: options.maternalDna ?? 0,
    childrenCount: 0,
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
    avatarIncubateTimer: 0,
    pendingAvatarKind: 'none',
    avatarTransformCooldown: 0,
    avatarTransformTimer: 0,
    builderName: roster.name,
    visualScale: 1,
    knowledge: PLAYER_START_MASS * 0.6,
    knowledgeIntake: 0,
    joy: PLAYER_START_MASS * 0.6,
    joyIntake: 0,
    lifespanSec: 0,
    satiety: PLAYER_START_MASS * 1.8,
    absorptionPaused: false,
    structureProduceCount: 0,
    lowMassSec: 0,
    lowSatietySec: 0,
    restSec: 0,
    workSec: 0,
    avatarTransformCount: 0,
    countFarmTransforms: 0,
    countSchoolTransforms: 0,
    countParkTransforms: 0,
    countProduceTransforms: 0,
    countProductionSessions: 0,
    feedRegularity: 0.5,
    lifespanEvalTimer: 0,
    transformHistory: [],
    productionStage: 'none',
    productionTimer: 0,
    productionCooldown: 0,
    productionPartnerId: 0,
    aiIntent: 'wander',
    aiPelletTargetId: 0,
    aiPelletTargetTimer: 0,
    intentTargetX: 0,
    intentTargetY: 0,
    intentEtaSec: 0,
    aiEmitterTargetId: 0,
    emitBurstSec: 0,
    aiAnchorX: x,
    aiAnchorY: y,
    aiAnchorTimer: 0,
    aiMateTargetId: 0,
    mateSeekUrge: 0.45 + Math.random() * 0.5,
    scheduleOffsetSec: Math.random() * SCHEDULE_DAY_SEC,
    motherBondTimer: 0,
    wanderDirX: Math.cos(Math.random() * Math.PI * 2),
    wanderDirY: Math.sin(Math.random() * Math.PI * 2),
    marketContractOrderId: 0,
    contractTargetX: 0,
    contractTargetY: 0,
    orderServiceKind: 'none',
    orderServiceTimer: 0,
    mateIntentElapsedSec: 0,
    mateIntentCooldownSec: 0,
    mateIntentCycles: 0,
    isAvatarPractitioner: false,
    practitionerRollTimer: Math.random() * 4,
  }
  syncEntityGeo(entity)
  if (!entity.familyId) entity.familyId = entity.id
  initEntityDna(entity, options.paternalDna ?? 0, options.maternalDna ?? 0)
  return entity
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
  if (entity.invincibleTimer > 0) alpha = 0.35 + 0.65 * Math.abs(Math.sin(time * 12))
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

export function clampEntityToWorld(entity: CircleEntity, width: number, height: number): void {
  const r = entityRadius(entity)
  entity.x = Math.max(r, Math.min(width - r, entity.x))
  entity.y = Math.max(r, Math.min(height - r, entity.y))
}
