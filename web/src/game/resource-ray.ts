import {
  JOY_CAP,
  KNOWLEDGE_CAP,
  RESOURCE_BURST_SEC,
  RESOURCE_EMIT_BASE_RATE,
  RESOURCE_RAY_MAX_RADIUS,
  RESOURCE_RAY_MIN_RADIUS,
  RESOURCE_RAY_MASS_RADIUS_RATIO,
  RESOURCE_RECEIVE_EFFICIENCY,
  SATIETY_CAP,
} from './avatar-config'
import { workEfficiency } from './avatar-traits'
import type { NeedKind } from './avatar-needs'
import type { AvatarRole, CircleEntity } from './entity'
import { isActive } from './entity'
import { speedForMass } from './movement'
import { PLAYER_START_MASS } from './physics'

export type ResourceKind = 'food' | 'knowledge' | 'joy'

export interface EmitterTarget {
  emitterId: number
  x: number
  y: number
  etaSec: number
  remainingAtArrival: number
  strength: number
}

function distanceBetween(a: CircleEntity, b: CircleEntity): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export function needToResourceKind(need: NeedKind): ResourceKind {
  if (need === 'learn') return 'knowledge'
  if (need === 'play') return 'joy'
  return 'food'
}

export function roleToResourceKind(role: AvatarRole): ResourceKind | null {
  if (role === 'farm') return 'food'
  if (role === 'school') return 'knowledge'
  if (role === 'park') return 'joy'
  return null
}

export function emitterRadius(entity: CircleEntity): number {
  const massRatio = Math.min(1.8, entity.mass / (PLAYER_START_MASS * 3))
  const r = entity.mass * RESOURCE_RAY_MASS_RADIUS_RATIO * (0.75 + massRatio * 0.35)
  return Math.max(RESOURCE_RAY_MIN_RADIUS, Math.min(RESOURCE_RAY_MAX_RADIUS, r))
}

export function emitterEfficiency(entity: CircleEntity): number {
  return workEfficiency(entity)
}

export function isStructureEmitter(entity: CircleEntity): boolean {
  return (
    entity.isFrozen &&
    (entity.avatarRole === 'farm' || entity.avatarRole === 'school' || entity.avatarRole === 'park')
  )
}

export function isEmitterBursting(entity: CircleEntity): boolean {
  return isStructureEmitter(entity) && entity.emitBurstSec > 0
}

/** 到达后预计仍可接收的射线秒数 */
export function projectedEmissionRemaining(entity: CircleEntity, etaSec: number): number {
  if (!isStructureEmitter(entity)) return 0
  if (entity.emitBurstSec > 0) {
    return entity.emitBurstSec - etaSec
  }
  if (entity.pelletSpawnTimer <= etaSec) {
    return Math.max(0, RESOURCE_BURST_SEC - Math.max(0, etaSec - entity.pelletSpawnTimer))
  }
  return 0
}

export function estimateTravelEta(entity: CircleEntity, targetX: number, targetY: number): number {
  const dist = Math.hypot(targetX - entity.x, targetY - entity.y)
  const speed = Math.max(18, speedForMass(entity.mass))
  return dist / speed
}

/** 射线强度：随距离二次衰减，类似求偶信号 */
export function resourceRayStrength(
  emitter: CircleEntity,
  receiver: CircleEntity,
  kind: ResourceKind,
): number {
  const emitterKind = roleToResourceKind(emitter.avatarRole)
  if (!emitterKind || emitterKind !== kind || !isEmitterBursting(emitter)) return 0

  const radius = emitterRadius(emitter)
  const dist = distanceBetween(emitter, receiver)
  if (dist > radius) return 0

  const t = dist / radius
  const decay = (1 - t) * (1 - t)
  return decay * emitterEfficiency(emitter)
}

export function pickBestEmitterTarget(
  entity: CircleEntity,
  entities: CircleEntity[],
  need: NeedKind,
): EmitterTarget | null {
  const kind = needToResourceKind(need)
  const role =
    kind === 'food' ? 'farm' : kind === 'knowledge' ? 'school' : ('park' as AvatarRole)

  let best: EmitterTarget | null = null
  let bestScore = -1

  for (const emitter of entities) {
    if (!isActive(emitter) || emitter.avatarRole !== role || !emitter.isFrozen) continue

    const eta = estimateTravelEta(entity, emitter.x, emitter.y)
    const remainingAtArrival = projectedEmissionRemaining(emitter, eta)
    if (remainingAtArrival < 0.6) continue

    const strength = isEmitterBursting(emitter)
      ? resourceRayStrength(emitter, entity, kind)
      : 0.25 + emitterEfficiency(emitter) * 0.35

    const score = strength * (1 + remainingAtArrival) / (1 + eta * 0.08)
    if (score > bestScore) {
      bestScore = score
      best = {
        emitterId: emitter.id,
        x: emitter.x,
        y: emitter.y,
        etaSec: eta,
        remainingAtArrival,
        strength,
      }
    }
  }

  return best
}

function applyFoodRay(entity: CircleEntity, amount: number): void {
  const gain = amount * RESOURCE_RECEIVE_EFFICIENCY
  entity.satiety = Math.min(SATIETY_CAP, entity.satiety + gain)
}

function applyKnowledgeRay(entity: CircleEntity, amount: number): void {
  const gain = amount * RESOURCE_RECEIVE_EFFICIENCY
  entity.knowledge = Math.min(KNOWLEDGE_CAP, entity.knowledge + gain)
}

function applyJoyRay(entity: CircleEntity, amount: number): void {
  const gain = amount * RESOURCE_RECEIVE_EFFICIENCY
  entity.joy = Math.min(JOY_CAP, entity.joy + gain)
}

function applyResourceToReceiver(
  receiver: CircleEntity,
  emitter: CircleEntity,
  kind: ResourceKind,
  dt: number,
): void {
  if (!isActive(receiver) || receiver.isFrozen || receiver.productionStage !== 'none') return

  const strength = resourceRayStrength(emitter, receiver, kind)
  if (strength <= 0.01) return

  const amount = RESOURCE_EMIT_BASE_RATE * strength * dt
  if (kind === 'food') {
    if (receiver.satiety >= SATIETY_CAP * 0.96) return
    applyFoodRay(receiver, amount)
  } else if (kind === 'knowledge') {
    if (receiver.knowledge >= KNOWLEDGE_CAP * 0.96) return
    applyKnowledgeRay(receiver, amount)
  } else {
    if (receiver.joy >= JOY_CAP * 0.96) return
    applyJoyRay(receiver, amount)
  }
}

/** 开始一轮限时射线发射 */
export function startEmitterBurst(entity: CircleEntity): void {
  entity.emitBurstSec = RESOURCE_BURST_SEC
  entity.structureProduceCount++
}

export function tickEmitterBursts(entities: CircleEntity[], dt: number): void {
  for (const entity of entities) {
    if (!isStructureEmitter(entity)) continue
    if (entity.emitBurstSec > 0) {
      entity.emitBurstSec = Math.max(0, entity.emitBurstSec - dt)
    }
  }
}

/** 对所有移动圆应用当前活跃射线 */
export function tickResourceRays(entities: CircleEntity[], dt: number): void {
  const emitters = entities.filter((e) => isEmitterBursting(e))
  if (emitters.length === 0) return

  const receivers = entities.filter(
    (e) => isActive(e) && !e.isFrozen && e.avatarRole !== 'farm' && e.avatarRole !== 'school' && e.avatarRole !== 'park',
  )

  for (const emitter of emitters) {
    const kind = roleToResourceKind(emitter.avatarRole)
    if (!kind) continue
    for (const receiver of receivers) {
      if (receiver.id === emitter.id) continue
      applyResourceToReceiver(receiver, emitter, kind, dt)
    }
  }
}

export function receiveRaysInRange(entity: CircleEntity, entities: CircleEntity[], dt: number): void {
  if (!isActive(entity) || entity.isFrozen) return
  for (const emitter of entities) {
    if (!isEmitterBursting(emitter)) continue
    const kind = roleToResourceKind(emitter.avatarRole)
    if (!kind) continue
    applyResourceToReceiver(entity, emitter, kind, dt)
  }
}

export function emitterArriveRadius(emitter: CircleEntity): number {
  return Math.max(28, emitterRadius(emitter) * 0.38)
}

export function drawResourceRays(
  ctx: CanvasRenderingContext2D,
  entities: CircleEntity[],
  time: number,
): void {
  for (const emitter of entities) {
    if (!isEmitterBursting(emitter)) continue
    const kind = roleToResourceKind(emitter.avatarRole)
    if (!kind) continue

    const radius = emitterRadius(emitter)
    const pulse = 0.82 + 0.18 * Math.sin(time * 4 + emitter.id)
    const color =
      kind === 'food'
        ? `rgba(143, 211, 255, ${0.14 * pulse})`
        : kind === 'knowledge'
          ? `rgba(130, 170, 255, ${0.14 * pulse})`
          : `rgba(255, 150, 210, ${0.14 * pulse})`

    ctx.beginPath()
    ctx.arc(emitter.x, emitter.y, radius * pulse, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    ctx.strokeStyle =
      kind === 'food'
        ? 'rgba(143, 211, 255, 0.35)'
        : kind === 'knowledge'
          ? 'rgba(130, 170, 255, 0.35)'
          : 'rgba(255, 150, 210, 0.35)'
    ctx.lineWidth = 2
    ctx.stroke()
  }
}
