import {
  ABSORPTION_PAUSE_MASS,
  ABSORPTION_RESUME_MASS,
  CIRCLE_LIFESPAN_SEC,
  HUNGER_IDLE_RATE,
  HUNGER_MOVE_RATE,
  HUNGER_RELIEF_PER_START_MASS,
  HUNGER_STARVE_MASS_DRAIN,
  HUNGER_WARN_THRESHOLD,
  LIFESPAN_AVATAR_TRANS_THRESHOLD,
  LIFESPAN_EVAL_INTERVAL_SEC,
  LOW_MASS_PENALTY_SEC,
} from './avatar-config'
import type { CircleEntity } from './entity'
import { isActive } from './entity'
import { PLAYER_START_MASS } from './physics'

export function initAvatarVitality(entity: CircleEntity): void {
  entity.lifespanSec = CIRCLE_LIFESPAN_SEC
  entity.hunger = 0
  entity.absorptionPaused = false
  entity.structureProduceCount = 0
  entity.lowMassSec = 0
  entity.hungerHighSec = 0
  entity.restSec = 0
  entity.workSec = 0
  entity.avatarTransformCount = 0
  entity.feedRegularity = 0.5
  entity.lifespanEvalTimer = LIFESPAN_EVAL_INTERVAL_SEC
}

/** 开局最佳状态：低饥饿、充足寿命、可立即化身 */
export function initOptimalAvatarState(entity: CircleEntity): void {
  initAvatarVitality(entity)
  entity.hunger = 0
  entity.lifespanSec = CIRCLE_LIFESPAN_SEC
  entity.feedRegularity = 0.85
}

/** 质量过大时暂停摄取；回落后恢复 */
export function updateAbsorptionPause(entity: CircleEntity): void {
  if (entity.isFrozen || entity.avatarRole === 'farm' || entity.avatarRole === 'ranch') return
  if (entity.mass >= ABSORPTION_PAUSE_MASS) {
    entity.absorptionPaused = true
  } else if (entity.mass <= ABSORPTION_RESUME_MASS) {
    entity.absorptionPaused = false
  }
}

export function canAvatarAbsorbPellets(entity: CircleEntity): boolean {
  if (!isActive(entity) || entity.isFrozen) return false
  if (entity.avatarRole === 'farm' || entity.avatarRole === 'ranch') return false
  updateAbsorptionPause(entity)
  return !entity.absorptionPaused
}

export function onAvatarPelletAbsorbed(entity: CircleEntity, pelletMass: number): void {
  const relief = (pelletMass / PLAYER_START_MASS) * HUNGER_RELIEF_PER_START_MASS
  entity.hunger = Math.max(0, entity.hunger - relief)
  if (entity.hunger < HUNGER_WARN_THRESHOLD) {
    entity.feedRegularity = Math.min(1, entity.feedRegularity + 0.06)
  }
}

function computeLifespanDrainMult(entity: CircleEntity): number {
  let mult = 1

  if (entity.lowMassSec >= LOW_MASS_PENALTY_SEC) mult *= 2

  const hungerRatio = entity.hungerHighSec / Math.max(1, entity.restSec + entity.workSec)
  if (hungerRatio > 0.35) mult += 0.35
  else if (entity.feedRegularity > 0.7) mult -= 0.2

  const activityTotal = entity.restSec + entity.workSec
  if (activityTotal > 10) {
    const workRatio = entity.workSec / activityTotal
    if (workRatio > 0.82) mult += 0.15
    else if (workRatio > 0.25 && workRatio < 0.7) mult -= 0.12
  }

  const excessTransforms = entity.avatarTransformCount - LIFESPAN_AVATAR_TRANS_THRESHOLD
  if (excessTransforms > 0) mult += excessTransforms * 0.12

  return Math.max(0.35, mult)
}

function evaluateLifespanWindow(entity: CircleEntity): void {
  let delta = 0

  if (entity.feedRegularity > 0.75 && entity.hungerHighSec < 8) delta += 18
  else if (entity.hungerHighSec > 20) delta -= 22

  const activityTotal = entity.restSec + entity.workSec
  if (activityTotal > 15) {
    const workRatio = entity.workSec / activityTotal
    if (workRatio > 0.25 && workRatio < 0.68) delta += 10
    else if (workRatio > 0.9) delta -= 12
  }

  const excessTransforms = entity.avatarTransformCount - LIFESPAN_AVATAR_TRANS_THRESHOLD
  if (excessTransforms > 0) delta -= excessTransforms * 8

  entity.lifespanSec = Math.max(20, Math.min(720, entity.lifespanSec + delta))

  entity.hungerHighSec = 0
  entity.restSec = 0
  entity.workSec = 0
  entity.feedRegularity = Math.max(0.2, entity.feedRegularity * 0.85)
}

function tickLifespan(entity: CircleEntity, dt: number, isMoving: boolean): void {
  if (entity.mass < PLAYER_START_MASS) {
    entity.lowMassSec += dt
  } else {
    entity.lowMassSec = 0
  }

  if (entity.hunger >= HUNGER_WARN_THRESHOLD) {
    entity.hungerHighSec += dt
    entity.feedRegularity = Math.max(0, entity.feedRegularity - dt * 0.02)
  }

  if (isMoving) entity.workSec += dt
  else entity.restSec += dt

  entity.lifespanEvalTimer -= dt
  if (entity.lifespanEvalTimer <= 0) {
    entity.lifespanEvalTimer = LIFESPAN_EVAL_INTERVAL_SEC
    evaluateLifespanWindow(entity)
  }

  const drainMult = computeLifespanDrainMult(entity)
  entity.lifespanSec = Math.max(0, entity.lifespanSec - dt * drainMult)
}

export function tickAvatarMetabolism(
  entity: CircleEntity,
  dt: number,
  isMoving: boolean,
): void {
  if (!isActive(entity) || entity.isFrozen) return
  if (entity.avatarRole === 'farm' || entity.avatarRole === 'ranch') return

  let hungerGain = HUNGER_IDLE_RATE * dt
  if (isMoving) hungerGain += HUNGER_MOVE_RATE * dt
  entity.hunger = Math.min(1, entity.hunger + hungerGain)

  if (entity.hunger >= 1) {
    entity.mass = Math.max(PLAYER_START_MASS * 0.3, entity.mass - HUNGER_STARVE_MASS_DRAIN * dt)
  }

  tickLifespan(entity, dt, isMoving)
}

/** 化身状态下仅流逝寿命，质量与饥饿不变 */
export function tickAvatarTransformLifespan(entity: CircleEntity, dt: number): void {
  if (!isActive(entity)) return
  if (entity.avatarRole !== 'farm' && entity.avatarRole !== 'ranch') return

  entity.lifespanEvalTimer -= dt
  if (entity.lifespanEvalTimer <= 0) {
    entity.lifespanEvalTimer = LIFESPAN_EVAL_INTERVAL_SEC
    const excessTransforms = entity.avatarTransformCount - LIFESPAN_AVATAR_TRANS_THRESHOLD
    if (excessTransforms > 0) {
      entity.lifespanSec = Math.max(20, entity.lifespanSec - excessTransforms * 6)
    }
  }

  entity.lifespanSec = Math.max(0, entity.lifespanSec - dt)
}

export function isAvatarLifeExpired(entity: CircleEntity): boolean {
  return entity.lifespanSec <= 0
}

export function hungerLabel(hunger: number): string {
  if (hunger <= 0.2) return '饱足'
  if (hunger <= HUNGER_WARN_THRESHOLD) return '适宜'
  if (hunger < 1) return '饥饿'
  return '饥竭'
}
