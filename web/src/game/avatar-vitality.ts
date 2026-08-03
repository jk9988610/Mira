import {
  ABSORPTION_PAUSE_MASS,
  ABSORPTION_RESUME_MASS,
  CIRCLE_LIFESPAN_SEC,
  METABOLISM_COLD_MULT,
  METABOLISM_IDLE_RATE,
  METABOLISM_MOVE_RATE,
  TEMPERATURE_IDLE_RECOVERY,
  TEMPERATURE_MOVE_DRAIN,
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
    entity.temperature = Math.max(0, entity.temperature - TEMPERATURE_MOVE_DRAIN * dt)
  } else {
    entity.temperature = Math.min(1, entity.temperature + TEMPERATURE_IDLE_RECOVERY * dt)
  }

  let drain = METABOLISM_IDLE_RATE * dt
  if (isMoving) drain += METABOLISM_MOVE_RATE * dt
  if (entity.temperature < 0.45) drain *= METABOLISM_COLD_MULT

  entity.mass = Math.max(PLAYER_START_MASS * 0.35, entity.mass - drain)
  entity.lifespanSec = Math.max(0, entity.lifespanSec - dt)
}

export function isAvatarLifeExpired(entity: CircleEntity): boolean {
  return entity.lifespanSec <= 0 && !entity.isFrozen
}

export function temperatureLabel(temp: number): string {
  if (temp >= 0.75) return '温暖'
  if (temp >= 0.45) return '适宜'
  return '寒冷'
}
