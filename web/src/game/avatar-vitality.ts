import {
  ABSORPTION_PAUSE_MASS,
  ABSORPTION_RESUME_MASS,
  CIRCLE_LIFESPAN_SEC,
  METABOLISM_COLD_MULT,
  METABOLISM_IDLE_RATE,
  METABOLISM_MOVE_RATE,
  TEMPERATURE_DEATH_THRESHOLD,
  TEMPERATURE_IDLE_DECAY,
  TEMPERATURE_MAINTENANCE_RATE,
  TEMPERATURE_METABOLIC_HEAT,
  TEMPERATURE_MOVE_GAIN,
} from './avatar-config'
import type { CircleEntity } from './entity'
import { isActive } from './entity'
import { PLAYER_START_MASS } from './physics'

export function initAvatarVitality(entity: CircleEntity): void {
  entity.lifespanSec = CIRCLE_LIFESPAN_SEC
  entity.temperature = 1
  entity.absorptionPaused = false
  entity.structureProduceCount = 0
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

export function tickAvatarMetabolism(
  entity: CircleEntity,
  dt: number,
  isMoving: boolean,
): void {
  if (!isActive(entity) || entity.isFrozen) return
  if (entity.avatarRole === 'farm' || entity.avatarRole === 'ranch') return

  if (isMoving) {
    entity.temperature = Math.min(1, entity.temperature + TEMPERATURE_MOVE_GAIN * dt)
  } else {
    entity.temperature = Math.max(0, entity.temperature - TEMPERATURE_IDLE_DECAY * dt)
  }

  let drain = METABOLISM_IDLE_RATE * dt
  if (isMoving) drain += METABOLISM_MOVE_RATE * dt

  const tempDeficit = Math.max(0, 0.55 - entity.temperature)
  if (tempDeficit > 0) {
    drain += tempDeficit * TEMPERATURE_MAINTENANCE_RATE * dt
    entity.temperature = Math.min(
      1,
      entity.temperature + tempDeficit * TEMPERATURE_METABOLIC_HEAT * dt,
    )
  }

  if (entity.temperature < 0.45) drain *= METABOLISM_COLD_MULT

  entity.mass = Math.max(PLAYER_START_MASS * 0.35, entity.mass - drain)
  entity.lifespanSec = Math.max(0, entity.lifespanSec - dt)
}

/** 化身状态下仅流逝寿命，质量与体温不变 */
export function tickAvatarTransformLifespan(entity: CircleEntity, dt: number): void {
  if (!isActive(entity)) return
  if (entity.avatarRole !== 'farm' && entity.avatarRole !== 'ranch') return
  entity.lifespanSec = Math.max(0, entity.lifespanSec - dt)
}

export function isAvatarLifeExpired(entity: CircleEntity): boolean {
  if (entity.lifespanSec <= 0) return true
  if (entity.avatarRole === 'farm' || entity.avatarRole === 'ranch') return false
  return isAvatarColdDeath(entity)
}

export function isAvatarColdDeath(entity: CircleEntity): boolean {
  if (entity.isFrozen) return false
  return entity.temperature < TEMPERATURE_DEATH_THRESHOLD
}

export function temperatureLabel(temp: number): string {
  if (temp >= 0.75) return '温暖'
  if (temp >= 0.45) return '适宜'
  if (temp >= TEMPERATURE_DEATH_THRESHOLD) return '寒冷'
  return '濒死'
}
