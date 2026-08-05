import {
  BODY_MASS_CAP_BASE,
  DIGEST_BASE_RATE,
  HEALTH_CAP,
  HEALTH_FLOOR,
  INTAKE_MASS_CAP_BASE,
  SATIETY_CAP,
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
  const healthFactor = Math.max(0.35, entity.health / HEALTH_CAP)
  const bodyCap = BODY_MASS_CAP_BASE * healthFactor
  const intakeCap = INTAKE_MASS_CAP_BASE * healthFactor
  return { bodyCap, intakeCap, totalCap: bodyCap + intakeCap }
}

export function clampHealth(health: number): number {
  if (!Number.isFinite(health)) return HEALTH_CAP
  return Math.max(HEALTH_FLOOR, Math.min(HEALTH_CAP, health))
}

export function initEntityMass(entity: CircleEntity, totalMass: number, health = HEALTH_CAP * 0.85): void {
  entity.bodyMass = Math.max(0, totalMass)
  entity.intakeMass = 0
  entity.health = clampHealth(health)
  syncEntityMass(entity)
}

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

export function tickDigestion(entity: CircleEntity, dt: number): void {
  if (entity.intakeMass <= 0) return

  const healthFactor = Math.max(0.35, entity.health / HEALTH_CAP)
  let budget = DIGEST_BASE_RATE * healthFactor * dt

  if (entity.satiety < SATIETY_CAP && entity.intakeMass > 0 && budget > 0) {
    const satietyRoom = SATIETY_CAP - entity.satiety
    const massNeeded = satietyRoom / SATIETY_PER_INTAKE_MASS
    const used = Math.min(budget, entity.intakeMass, massNeeded)
    entity.intakeMass -= used
    entity.satiety += used * SATIETY_PER_INTAKE_MASS
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

export function drainBodyMass(entity: CircleEntity, amount: number): void {
  if (amount <= 0) return
  entity.bodyMass = Math.max(PLAYER_START_MASS * 0.3, entity.bodyMass - amount)
  syncEntityMass(entity)
}

/** 战斗伤害：直接削减质量，质量归零则死亡 */
export function applyCombatDamage(entity: CircleEntity, amount: number): void {
  if (amount <= 0) return
  entity.bodyMass = Math.max(0, entity.bodyMass - amount)
  entity.intakeMass = Math.max(0, entity.intakeMass - amount * 0.5)
  syncEntityMass(entity)
  if (entity.mass <= 0) {
    entity.mass = 0
    entity.lifespanSec = 0
  }
}

export function remainingIntakeRoom(entity: CircleEntity): number {
  const caps = getMassCaps(entity)
  return Math.max(0, Math.min(caps.intakeCap - entity.intakeMass, caps.totalCap - entity.mass))
}

export function healthLabel(health: number): string {
  const ratio = health / HEALTH_CAP
  if (ratio >= 0.85) return '健康'
  if (ratio >= 0.6) return '良好'
  if (ratio >= 0.4) return '欠佳'
  return '虚弱'
}
