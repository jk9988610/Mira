import {
  BODY_MASS_CAP_BASE,
  DIGEST_BASE_RATE,
  HEALTH_MAX,
  HEALTH_MIN,
  INTAKE_MASS_CAP_BASE,
  SATIETY_PER_INTAKE_MASS,
} from './avatar-config'
import type { CircleEntity } from './entity'
import { PLAYER_START_MASS } from './physics'

export interface MassCaps {
  bodyCap: number
  intakeCap: number
  totalCap: number
}

export function syncEntityMass(entity: CircleEntity): void {
  entity.mass = Math.max(0, entity.bodyMass + entity.intakeMass)
}

export function getMassCaps(entity: CircleEntity): MassCaps {
  const health = clampHealth(entity.health)
  const bodyCap = BODY_MASS_CAP_BASE * health
  const intakeCap = INTAKE_MASS_CAP_BASE * health
  return { bodyCap, intakeCap, totalCap: bodyCap + intakeCap }
}

export function clampHealth(health: number): number {
  if (!Number.isFinite(health)) return HEALTH_MAX
  return Math.max(HEALTH_MIN, Math.min(HEALTH_MAX, health))
}

export function initEntityMass(entity: CircleEntity, totalMass: number, health = HEALTH_MAX): void {
  entity.bodyMass = Math.max(0, totalMass)
  entity.intakeMass = 0
  entity.health = clampHealth(health)
  syncEntityMass(entity)
}

/** 将颗粒质量加入摄入质量，返回实际吸收量 */
export function addIntakeMass(entity: CircleEntity, pelletMass: number): number {
  const caps = getMassCaps(entity)
  const intakeRoom = Math.max(0, caps.intakeCap - entity.intakeMass)
  const totalRoom = Math.max(0, caps.totalCap - entity.mass)
  const gain = Math.min(pelletMass, intakeRoom, totalRoom)
  if (gain <= 0) return 0
  entity.intakeMass += gain
  syncEntityMass(entity)
  return gain
}

/** 消化：摄入质量优先维持饱食度，剩余转化为本体质量 */
export function tickDigestion(entity: CircleEntity, dt: number): void {
  if (entity.intakeMass <= 0) return

  const health = clampHealth(entity.health)
  let budget = DIGEST_BASE_RATE * health * dt

  if (entity.satiety < 1 && entity.intakeMass > 0 && budget > 0) {
    const satietyDeficit = 1 - entity.satiety
    const massNeeded = satietyDeficit / SATIETY_PER_INTAKE_MASS
    const used = Math.min(budget, entity.intakeMass, massNeeded)
    entity.intakeMass -= used
    entity.satiety = Math.min(1, entity.satiety + used * SATIETY_PER_INTAKE_MASS)
    budget -= used
  }

  if (budget > 0 && entity.intakeMass > 0) {
    const caps = getMassCaps(entity)
    const bodyRoom = Math.max(0, caps.bodyCap - entity.bodyMass)
    const converted = Math.min(budget, entity.intakeMass, bodyRoom)
    entity.intakeMass -= converted
    entity.bodyMass += converted
  }

  syncEntityMass(entity)
}

/** 饥竭时消耗本体质量（不动摄入质量） */
export function drainBodyMass(entity: CircleEntity, amount: number): void {
  if (amount <= 0) return
  entity.bodyMass = Math.max(PLAYER_START_MASS * 0.3, entity.bodyMass - amount)
  syncEntityMass(entity)
}

export function remainingIntakeRoom(entity: CircleEntity): number {
  const caps = getMassCaps(entity)
  return Math.max(0, Math.min(caps.intakeCap - entity.intakeMass, caps.totalCap - entity.mass))
}

export function healthLabel(health: number): string {
  const pct = Math.round(clampHealth(health) * 100)
  if (pct >= 85) return '健康'
  if (pct >= 60) return '良好'
  if (pct >= 40) return '欠佳'
  return '虚弱'
}
