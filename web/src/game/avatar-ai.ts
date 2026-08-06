import {
  NPC_ARRIVE_DIST,
  NPC_JITTER_DIST,
  NPC_TARGET_CACHE_SEC,
} from './avatar-config'
import { pickWeightedNeed, type NeedKind } from './avatar-needs'
import { currentSchedulePhase, schedulePhaseLabel } from './avatar-schedule'
import {
  isActivelySeekingMate,
  isPursuingMate,
  updateMatePursuit,
} from './avatar-reproduction'
import {
  emitterArriveRadius,
  pickBestEmitterTarget,
  type EmitterTarget,
} from './resource-ray'
import { clampAvatarEntityToWorld } from './avatar-radius'
import { syncEntityGeo } from './geo'
import type { CircleEntity, TransformKind } from './entity'
import { isActive, isJuvenile } from './entity'
import { speedForMass } from './movement'
import { WORLD_HEIGHT, WORLD_WIDTH } from './world'

export function decideNpcTransformKind(
  _entity: CircleEntity,
  _entities: CircleEntity[],
  _now = 0,
): TransformKind | null {
  return null
}

export function recordTransformHistory(entity: CircleEntity, kind: TransformKind): void {
  entity.transformHistory.push(kind)
  if (entity.transformHistory.length > 12) entity.transformHistory.splice(0, entity.transformHistory.length - 12)
}

export function intentLabel(entity: CircleEntity, gameTimeSec = 0): string {
  if (entity.productionStage === 'active') return '生产'
  if (entity.marketContractOrderId > 0) {
    if (entity.orderServiceTimer > 0) {
      return `履约·展开光环 →(${Math.round(entity.x)},${Math.round(entity.y)}) ${entity.orderServiceTimer.toFixed(1)}s`
    }
    const eta =
      entity.intentEtaSec > 0
        ? ` ${entity.intentEtaSec.toFixed(1)}s`
        : ''
    return `履约·前往订单 →(${Math.round(entity.intentTargetX)},${Math.round(entity.intentTargetY)})${eta}`
  }
  if (entity.pendingAvatarKind !== 'none') {
    return entity.avatarTransformCooldown > 0 ? '等待·化身冷却' : '等待·化身'
  }
  if (entity.productionCooldown > 0) {
    return `冷却·${schedulePhaseLabel(currentSchedulePhase(entity, gameTimeSec, false))}`
  }

  if (isPursuingMate(entity, gameTimeSec)) {
    if (entity.spouseId > 0) return '奔赴·配偶'
    return '奔赴·求偶'
  }

  const seeking = isActivelySeekingMate(entity, gameTimeSec)
  const phase = currentSchedulePhase(entity, gameTimeSec, seeking && entity.spouseId === 0)
  let base =
    phase === 'sleep'
      ? '睡觉'
      : entity.aiIntent === 'eat'
        ? '接收食物光环'
        : entity.aiIntent === 'learn'
          ? '接收知识光环'
          : entity.aiIntent === 'play'
            ? '接收快乐光环'
            : schedulePhaseLabel(phase)

  if (entity.intentEtaSec > 0) {
    base = `${base} →(${Math.round(entity.intentTargetX)},${Math.round(entity.intentTargetY)}) ${entity.intentEtaSec.toFixed(1)}s`
  }

  if (isJuvenile(entity, gameTimeSec)) return base
  if (entity.spouseId > 0) return `配偶·${base}`
  if (seeking) return `求偶·${base}`
  return base
}

function moveToward(
  entity: CircleEntity,
  tx: number,
  ty: number,
  dt: number,
  mult = 1,
  arriveDist = NPC_ARRIVE_DIST,
): void {
  const dx = tx - entity.x
  const dy = ty - entity.y
  const dist = Math.hypot(dx, dy)
  if (dist <= arriveDist || dist < NPC_JITTER_DIST) return
  const speed = speedForMass(entity.mass) * mult
  entity.x += (dx / dist) * speed * dt
  entity.y += (dy / dist) * speed * dt
  clampAvatarEntityToWorld(entity, WORLD_WIDTH, WORLD_HEIGHT)
  syncEntityGeo(entity)
}

function applyIntentTarget(entity: CircleEntity, target: EmitterTarget | null, need: NeedKind): void {
  if (!target) {
    entity.intentTargetX = 0
    entity.intentTargetY = 0
    entity.intentEtaSec = 0
    entity.aiEmitterTargetId = 0
    return
  }
  entity.intentTargetX = target.x
  entity.intentTargetY = target.y
  entity.intentEtaSec = target.etaSec
  entity.aiEmitterTargetId = target.emitterId
  entity.aiIntent = need
}

function pickEmitterTarget(
  entity: CircleEntity,
  entities: CircleEntity[],
  need: NeedKind,
): EmitterTarget | null {
  if (entity.aiPelletTargetTimer > 0 && entity.aiEmitterTargetId > 0) {
    const cached = entities.find((e) => e.id === entity.aiEmitterTargetId && isActive(e))
    if (cached) {
      const target = pickBestEmitterTarget(entity, entities, need)
      if (target && target.emitterId === cached.id) return target
    }
  }
  const target = pickBestEmitterTarget(entity, entities, need)
  if (target) {
    entity.aiEmitterTargetId = target.emitterId
    entity.aiPelletTargetTimer = NPC_TARGET_CACHE_SEC
  }
  return target
}

function pursueScheduleNeed(
  entity: CircleEntity,
  entities: CircleEntity[],
  need: NeedKind,
  dt: number,
): boolean {
  const emitter = pickEmitterTarget(entity, entities, need)
  if (!emitter) {
    applyIntentTarget(entity, null, need)
    return false
  }
  applyIntentTarget(entity, emitter, need)
  const arrive = emitterArriveRadius(
    entities.find((e) => e.id === emitter.emitterId) ?? entity,
  )
  moveToward(entity, emitter.x, emitter.y, dt, 0.92, arrive)
  entity.intentEtaSec = Math.max(0, entity.intentEtaSec - dt)
  return true
}

export function updateNpcIntent(
  entity: CircleEntity,
  entities: CircleEntity[],
  dt: number,
  now = 0,
): { moving: boolean; sleeping: boolean } {
  entity.aiPelletTargetTimer = Math.max(0, entity.aiPelletTargetTimer - dt)

  if (entity.productionStage === 'active') {
    entity.aiIntent = 'wait'
    entity.intentEtaSec = 0
    return { moving: false, sleeping: false }
  }

  if (isPursuingMate(entity, now)) {
    entity.aiIntent = 'wait'
    entity.intentEtaSec = 0
    updateMatePursuit(entity, entities, dt, now)
    return { moving: true, sleeping: false }
  }

  const seeking = isActivelySeekingMate(entity, now)
  const phase = currentSchedulePhase(entity, now, seeking && entity.spouseId === 0)

  if (phase === 'sleep') {
    entity.aiIntent = 'sleep'
    entity.intentEtaSec = 0
    entity.intentTargetX = entity.x
    entity.intentTargetY = entity.y
    return { moving: false, sleeping: true }
  }

  let activeNeed: NeedKind
  if (phase === 'eat' || phase === 'learn' || phase === 'play') {
    activeNeed = phase
  } else {
    activeNeed = pickWeightedNeed(entity, entity.id * 1.31 + Math.floor(now * 0.4), now)
  }
  entity.aiIntent = activeNeed

  if (pursueScheduleNeed(entity, entities, activeNeed, dt)) {
    return { moving: true, sleeping: false }
  }

  entity.intentEtaSec = 0
  return { moving: false, sleeping: false }
}
