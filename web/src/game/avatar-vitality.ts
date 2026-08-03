import {
  CIRCLE_LIFESPAN_SEC,
  HEALTH_DECAY_LOW_SATIETY,
  HEALTH_DECAY_STARVE,
  HEALTH_MAX,
  HEALTH_RECOVER_RATE,
  LIFESPAN_AVATAR_TRANS_THRESHOLD,
  LIFESPAN_EVAL_INTERVAL_SEC,
  LOW_MASS_PENALTY_SEC,
  SATIETY_ABSORB_PAUSE,
  SATIETY_ABSORB_RESUME,
  SATIETY_GAIN_PER_START_MASS,
  SATIETY_IDLE_DECAY,
  SATIETY_LOW_THRESHOLD,
  SATIETY_MOVE_DECAY,
  SATIETY_SLEEP_DECAY,
  SATIETY_STARVE_MASS_DRAIN,
  TRAIT_IDLE_DECAY,
  TRAIT_LOW_THRESHOLD,
  TRAIT_SLEEP_DECAY,
  HEALTH_DECAY_LOW_TRAIT,
  VISUAL_SCALE_DEFAULT,
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
import { initNpcSchedule } from './avatar-ai'
import { DAY_DURATION_SEC } from './avatar-config'
import { tickTraitDigestion } from './avatar-traits'

export function initAvatarVitality(entity: CircleEntity): void {
  initEntityMass(entity, entity.mass, HEALTH_MAX)
  entity.lifespanSec = CIRCLE_LIFESPAN_SEC
  entity.satiety = 1
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
  entity.knowledge = entity.isPlayer ? 0.4 : 0.3 + (entity.id % 5) * 0.04
  entity.knowledgeIntake = 0
  entity.joy = entity.isPlayer ? 0.4 : 0.3 + (entity.id % 4) * 0.05
  entity.joyIntake = 0
  entity.knowledgeAbsorbPaused = false
  entity.joyAbsorbPaused = false
  entity.visualScale = VISUAL_SCALE_DEFAULT
  entity.avatarTransformTimer = 0
  if (!entity.isPlayer) {
    initNpcSchedule(entity, (entity.id * 5) % DAY_DURATION_SEC)
  }
}

/** 开局最佳状态：高饱食、充足寿命、可立即化身 */
export function initOptimalAvatarState(entity: CircleEntity): void {
  initAvatarVitality(entity)
  entity.satiety = 1
  entity.lifespanSec = CIRCLE_LIFESPAN_SEC
  entity.feedRegularity = 0.85
  entity.health = HEALTH_MAX
}

/** 饱食度过高或摄入已满时暂停摄取；回落后恢复 */
export function updateSatietyAbsorption(entity: CircleEntity): void {
  if (entity.isFrozen) return
  if (
    entity.avatarRole === 'farm' ||
    entity.avatarRole === 'ranch' ||
    entity.avatarRole === 'school' ||
    entity.avatarRole === 'park'
  ) {
    return
  }
  if (entity.satiety >= SATIETY_ABSORB_PAUSE || remainingIntakeRoom(entity) <= 0) {
    entity.absorptionPaused = true
  } else if (entity.satiety <= SATIETY_ABSORB_RESUME) {
    entity.absorptionPaused = false
  }
}

export function canAvatarAbsorbPellets(entity: CircleEntity): boolean {
  if (!isActive(entity) || entity.isFrozen) return false
  if (
    entity.avatarRole === 'farm' ||
    entity.avatarRole === 'ranch' ||
    entity.avatarRole === 'school' ||
    entity.avatarRole === 'park'
  ) {
    return false
  }
  updateSatietyAbsorption(entity)
  if (entity.absorptionPaused) return false
  return remainingIntakeRoom(entity) > 0
}

export function onAvatarPelletAbsorbed(entity: CircleEntity, absorbedMass: number): void {
  const gain = (absorbedMass / PLAYER_START_MASS) * SATIETY_GAIN_PER_START_MASS
  entity.satiety = Math.min(1, entity.satiety + gain)
  if (entity.satiety > SATIETY_LOW_THRESHOLD) {
    entity.feedRegularity = Math.min(1, entity.feedRegularity + 0.06)
  }
}

function tickHealth(entity: CircleEntity, dt: number): void {
  if (entity.satiety <= 0) {
    entity.health = clampHealth(entity.health - HEALTH_DECAY_STARVE * dt)
  } else if (entity.satiety <= SATIETY_LOW_THRESHOLD) {
    entity.health = clampHealth(entity.health - HEALTH_DECAY_LOW_SATIETY * dt)
  } else if (entity.knowledge <= TRAIT_LOW_THRESHOLD || entity.joy <= TRAIT_LOW_THRESHOLD) {
    entity.health = clampHealth(entity.health - HEALTH_DECAY_LOW_TRAIT * dt)
  } else if (entity.feedRegularity > 0.65 && entity.satiety > 0.55 && entity.knowledge > 0.4 && entity.joy > 0.4) {
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
  if (entity.mass < PLAYER_START_MASS) {
    entity.lowMassSec += dt
  } else {
    entity.lowMassSec = 0
  }

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

  const drainMult = computeLifespanDrainMult(entity)
  entity.lifespanSec = Math.max(0, entity.lifespanSec - dt * drainMult)
}

export function tickAvatarMetabolism(
  entity: CircleEntity,
  dt: number,
  isMoving: boolean,
): void {
  if (!isActive(entity) || entity.isFrozen) return
  if (entity.avatarRole === 'farm' || entity.avatarRole === 'ranch' || entity.avatarRole === 'school' || entity.avatarRole === 'park') return

  tickDigestion(entity, dt)
  tickTraitDigestion(entity, dt)

  let decay = entity.aiSleeping ? SATIETY_SLEEP_DECAY * dt : SATIETY_IDLE_DECAY * dt
  if (!entity.aiSleeping && isMoving) decay += SATIETY_MOVE_DECAY * dt
  entity.satiety = Math.max(0, entity.satiety - decay)

  let traitDecay = entity.aiSleeping ? TRAIT_SLEEP_DECAY * dt : TRAIT_IDLE_DECAY * dt
  entity.knowledge = Math.max(0, entity.knowledge - traitDecay)
  entity.joy = Math.max(0, entity.joy - traitDecay)

  if (entity.satiety <= 0) {
    drainBodyMass(entity, SATIETY_STARVE_MASS_DRAIN * dt)
  }

  tickHealth(entity, dt)
  tickLifespan(entity, dt, isMoving)
}

/** 化身状态下仅流逝寿命，质量与饱食度不变 */
export function tickAvatarTransformLifespan(entity: CircleEntity, dt: number): void {
  if (!isActive(entity)) return
  if (entity.avatarRole !== 'farm' && entity.avatarRole !== 'ranch' && entity.avatarRole !== 'school' && entity.avatarRole !== 'park') return

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

export function satietyLabel(satiety: number): string {
  if (satiety >= 0.8) return '饱足'
  if (satiety > SATIETY_LOW_THRESHOLD) return '适宜'
  if (satiety > 0) return '饥饿'
  return '饥竭'
}
