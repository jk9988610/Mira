import {
  CIRCLE_LIFESPAN_SEC,
  HEALTH_CAP,
  HEALTH_DECAY_LOW_SATIETY,
  HEALTH_DECAY_LOW_TRAIT,
  HEALTH_DECAY_STARVE,
  HEALTH_RECOVER_RATE,
  JOY_CAP,
  KNOWLEDGE_CAP,
  LIFESPAN_AVATAR_TRANS_THRESHOLD,
  LIFESPAN_EVAL_INTERVAL_SEC,
  LOW_MASS_PENALTY_SEC,
  PRODUCTION_COOLDOWN_SEC,
  SATIETY_ABSORB_PAUSE_RATIO,
  SATIETY_ABSORB_RESUME_RATIO,
  SATIETY_CAP,
  SATIETY_GAIN_PER_MASS,
  SATIETY_IDLE_DECAY,
  SATIETY_LOW_THRESHOLD,
  SATIETY_MOVE_DECAY,
  SATIETY_STARVE_MASS_DRAIN,
  TRAIT_IDLE_DECAY,
  TRAIT_LOW_THRESHOLD,
  TRAIT_SLEEP_DECAY,
  SATIETY_SLEEP_DECAY,
} from './avatar-config'
import {
  clampHealth,
  drainBodyMass,
  initEntityMass,
  remainingIntakeRoom,
  tickDigestion,
} from './avatar-mass'
import type { CircleEntity } from './entity'
import { isActive } from './entity'
import { PLAYER_START_MASS } from './physics'
import { tickTraitDigestion } from './avatar-traits'

export function initAvatarVitality(entity: CircleEntity, birthGameTimeSec = 0): void {
  initEntityMass(entity, entity.mass, HEALTH_CAP * 0.85)
  entity.lifespanSec = CIRCLE_LIFESPAN_SEC
  entity.satiety = SATIETY_CAP * 0.55
  entity.absorptionPaused = false
  entity.structureProduceCount = 0
  entity.lowMassSec = 0
  entity.lowSatietySec = 0
  entity.restSec = 0
  entity.workSec = 0
  entity.avatarTransformCount = 0
  entity.feedRegularity = 0.5
  entity.lifespanEvalTimer = LIFESPAN_EVAL_INTERVAL_SEC
  entity.transformHistory = []
  entity.knowledge = PLAYER_START_MASS * 0.72
  entity.knowledgeIntake = 0
  entity.joy = PLAYER_START_MASS * 0.72
  entity.joyIntake = 0
  entity.visualScale = 1
  entity.avatarTransformTimer = 0
  entity.birthGameTimeSec = birthGameTimeSec
  entity.productionCooldown = Math.random() * PRODUCTION_COOLDOWN_SEC * 0.72
}

export function initOptimalAvatarState(entity: CircleEntity, birthGameTimeSec = 0): void {
  initAvatarVitality(entity, birthGameTimeSec)
  entity.satiety = SATIETY_CAP * 0.62
  entity.lifespanSec = CIRCLE_LIFESPAN_SEC
  entity.feedRegularity = 0.85
  entity.health = HEALTH_CAP * 0.9
  entity.knowledge = PLAYER_START_MASS * 0.7
  entity.joy = PLAYER_START_MASS * 0.7
}

function inStructureOrProduction(entity: CircleEntity): boolean {
  return (
    entity.avatarRole === 'farm' ||
    entity.avatarRole === 'school' ||
    entity.avatarRole === 'park' ||
    entity.productionStage !== 'none'
  )
}

export function updateSatietyAbsorption(entity: CircleEntity): void {
  if (entity.isFrozen) return
  if (inStructureOrProduction(entity)) return
  if (entity.satiety >= SATIETY_CAP * SATIETY_ABSORB_PAUSE_RATIO || remainingIntakeRoom(entity) <= 0) {
    entity.absorptionPaused = true
  } else if (entity.satiety <= SATIETY_CAP * SATIETY_ABSORB_RESUME_RATIO) {
    entity.absorptionPaused = false
  }
}

export function canAbsorbFoodPellets(entity: CircleEntity): boolean {
  if (!isActive(entity) || entity.isFrozen) return false
  if (inStructureOrProduction(entity)) return false
  updateSatietyAbsorption(entity)
  if (entity.absorptionPaused) return false
  return remainingIntakeRoom(entity) > 0
}

/** @deprecated 使用 canAbsorbFoodPellets */
export function canAvatarAbsorbPellets(entity: CircleEntity): boolean {
  return canAbsorbFoodPellets(entity)
}

export function onAvatarPelletAbsorbed(entity: CircleEntity, absorbedMass: number): void {
  entity.satiety = Math.min(SATIETY_CAP, entity.satiety + absorbedMass * SATIETY_GAIN_PER_MASS)
  if (entity.satiety > SATIETY_LOW_THRESHOLD) {
    entity.feedRegularity = Math.min(1, entity.feedRegularity + 0.06)
  }
}

export function knowledgeEvalLabel(knowledge: number): string {
  const ratio = knowledge / KNOWLEDGE_CAP
  if (ratio >= 0.85) return '博学'
  if (ratio >= 0.55) return '充实'
  if (ratio >= 0.25) return '入门'
  return '匮乏'
}

export function happinessEvalLabel(joy: number): string {
  const ratio = joy / JOY_CAP
  if (ratio >= 0.85) return '愉悦'
  if (ratio >= 0.55) return '满足'
  if (ratio >= 0.25) return '平淡'
  return '低落'
}

function tickHealth(entity: CircleEntity, dt: number): void {
  if (entity.satiety <= 0) {
    entity.health = clampHealth(entity.health - HEALTH_DECAY_STARVE * dt)
  } else if (entity.satiety <= SATIETY_LOW_THRESHOLD) {
    entity.health = clampHealth(entity.health - HEALTH_DECAY_LOW_SATIETY * dt)
  } else if (entity.knowledge <= TRAIT_LOW_THRESHOLD || entity.joy <= TRAIT_LOW_THRESHOLD) {
    entity.health = clampHealth(entity.health - HEALTH_DECAY_LOW_TRAIT * dt)
  } else if (
    entity.feedRegularity > 0.65 &&
    entity.satiety > SATIETY_CAP * 0.45 &&
    entity.knowledge > KNOWLEDGE_CAP * 0.25 &&
    entity.joy > JOY_CAP * 0.25
  ) {
    entity.health = clampHealth(entity.health + HEALTH_RECOVER_RATE * dt)
  }
}

function computeLifespanDrainMult(entity: CircleEntity): number {
  let mult = 1
  if (entity.lowMassSec >= LOW_MASS_PENALTY_SEC) mult *= 2
  const lowSatietyRatio = entity.lowSatietySec / Math.max(1, entity.restSec + entity.workSec)
  if (lowSatietyRatio > 0.35) mult += 0.35
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
  if (entity.feedRegularity > 0.75 && entity.lowSatietySec < 8) delta += 18
  else if (entity.lowSatietySec > 20) delta -= 22
  const activityTotal = entity.restSec + entity.workSec
  if (activityTotal > 15) {
    const workRatio = entity.workSec / activityTotal
    if (workRatio > 0.25 && workRatio < 0.68) delta += 10
    else if (workRatio > 0.9) delta -= 12
  }
  const excessTransforms = entity.avatarTransformCount - LIFESPAN_AVATAR_TRANS_THRESHOLD
  if (excessTransforms > 0) delta -= excessTransforms * 8
  entity.lifespanSec = Math.max(20, Math.min(720, entity.lifespanSec + delta))
  entity.lowSatietySec = 0
  entity.restSec = 0
  entity.workSec = 0
  entity.feedRegularity = Math.max(0.2, entity.feedRegularity * 0.85)
}

function tickLifespan(entity: CircleEntity, dt: number, isMoving: boolean): void {
  if (entity.mass < PLAYER_START_MASS) entity.lowMassSec += dt
  else entity.lowMassSec = 0
  if (entity.satiety <= SATIETY_LOW_THRESHOLD) {
    entity.lowSatietySec += dt
    entity.feedRegularity = Math.max(0, entity.feedRegularity - dt * 0.02)
  }
  if (isMoving) entity.workSec += dt
  else entity.restSec += dt
  entity.lifespanEvalTimer -= dt
  if (entity.lifespanEvalTimer <= 0) {
    entity.lifespanEvalTimer = LIFESPAN_EVAL_INTERVAL_SEC
    evaluateLifespanWindow(entity)
  }
  entity.lifespanSec = Math.max(0, entity.lifespanSec - dt * computeLifespanDrainMult(entity))
}

export function tickAvatarMetabolism(entity: CircleEntity, dt: number, isMoving: boolean): void {
  if (!isActive(entity) || entity.isFrozen) return
  if (entity.avatarRole === 'farm' || entity.avatarRole === 'school' || entity.avatarRole === 'park') return

  tickDigestion(entity, dt)
  tickTraitDigestion(entity, dt)

  let decay = SATIETY_IDLE_DECAY * dt
  let traitDecay = TRAIT_IDLE_DECAY * dt
  if (entity.aiIntent === 'sleep') {
    decay = SATIETY_SLEEP_DECAY * dt
    traitDecay = TRAIT_SLEEP_DECAY * dt
  } else if (isMoving) {
    decay += SATIETY_MOVE_DECAY * dt
  }
  entity.satiety = Math.max(0, entity.satiety - decay)

  entity.knowledge = Math.max(0, entity.knowledge - traitDecay)
  entity.joy = Math.max(0, entity.joy - traitDecay)

  if (entity.satiety <= 0) drainBodyMass(entity, SATIETY_STARVE_MASS_DRAIN * dt)
  tickHealth(entity, dt)
  tickLifespan(entity, dt, isMoving)
}

export function tickAvatarTransformLifespan(entity: CircleEntity, dt: number): void {
  if (!isActive(entity)) return
  if (entity.avatarRole !== 'farm' && entity.avatarRole !== 'school' && entity.avatarRole !== 'park') return
  entity.lifespanEvalTimer -= dt
  if (entity.lifespanEvalTimer <= 0) {
    entity.lifespanEvalTimer = LIFESPAN_EVAL_INTERVAL_SEC
    const excessTransforms = entity.avatarTransformCount - LIFESPAN_AVATAR_TRANS_THRESHOLD
    if (excessTransforms > 0) entity.lifespanSec = Math.max(20, entity.lifespanSec - excessTransforms * 6)
  }
  entity.lifespanSec = Math.max(0, entity.lifespanSec - dt)
}

export function isAvatarLifeExpired(entity: CircleEntity): boolean {
  return entity.lifespanSec <= 0
}

export function satietyLabel(satiety: number): string {
  const ratio = satiety / SATIETY_CAP
  if (ratio >= 0.8) return '饱足'
  if (ratio > SATIETY_LOW_THRESHOLD / SATIETY_CAP) return '适宜'
  if (satiety > 0) return '饥饿'
  return '饥竭'
}
