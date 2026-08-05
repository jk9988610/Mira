import {
  FORTRESS_ARMOR_CAP,
  FORTRESS_ARMOR_GAIN_RATE,
  FORTRESS_ARMOR_DECAY_RATE,
  FORTRESS_DAMAGE_RATE,
} from './avatar-config'
import { applyCombatDamage } from './avatar-mass'
import { isHostileToFamily } from './pressure-field'
import { emitterRadius } from './resource-ray'
import type { CircleEntity } from './entity'
import { isActive } from './entity'

function getFamilyId(entity: CircleEntity): number {
  return entity.familyId || entity.id
}

function distanceBetween(a: CircleEntity, b: CircleEntity): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export function isFortressEmitter(entity: CircleEntity): boolean {
  if (entity.emitBurstSec <= 0) return false
  if (entity.isFrozen && entity.avatarRole === 'fortress') return true
  return entity.orderServiceTimer > 0 && entity.orderServiceKind === 'fortress'
}

export function fortressHaloStrength(fortress: CircleEntity, target: CircleEntity): number {
  if (!isFortressEmitter(fortress)) return 0
  const radius = emitterRadius(fortress)
  const dist = distanceBetween(fortress, target)
  if (dist > radius) return 0
  const t = dist / radius
  return (1 - t) * (1 - t)
}

export function tickFortressHalos(entities: CircleEntity[], dt: number): void {
  const fortresses = entities.filter(isFortressEmitter)
  if (fortresses.length === 0) {
    for (const entity of entities) {
      if (entity.fortressArmor > 0) {
        entity.fortressArmor = Math.max(0, entity.fortressArmor - FORTRESS_ARMOR_DECAY_RATE * dt)
      }
    }
    return
  }

  for (const fortress of fortresses) {
    const ownerFamily = getFamilyId(fortress)
    for (const target of entities) {
      if (!isActive(target) || target.isFrozen) continue
      const strength = fortressHaloStrength(fortress, target)
      if (strength <= 0.01) continue

      const targetFamily = getFamilyId(target)
      if (targetFamily === ownerFamily) {
        target.fortressArmor = Math.min(
          FORTRESS_ARMOR_CAP,
          target.fortressArmor + FORTRESS_ARMOR_GAIN_RATE * strength * dt,
        )
        continue
      }

      if (!isHostileToFamily(ownerFamily, targetFamily)) continue

      const rawDamage = FORTRESS_DAMAGE_RATE * strength * dt
      const mitigated = Math.max(0, rawDamage - target.fortressArmor)
      target.fortressArmor = Math.max(0, target.fortressArmor - rawDamage * 0.35)
      if (mitigated > 0) applyCombatDamage(target, mitigated)
    }
  }

  for (const entity of entities) {
    if (entity.fortressArmor > 0) {
      entity.fortressArmor = Math.max(0, entity.fortressArmor - FORTRESS_ARMOR_DECAY_RATE * dt)
    }
  }
}

export function drawFortressHalos(
  ctx: CanvasRenderingContext2D,
  entities: CircleEntity[],
  time: number,
): void {
  for (const fortress of entities) {
    if (!isFortressEmitter(fortress)) continue
    const radius = emitterRadius(fortress)
    const pulse = 0.82 + 0.18 * Math.sin(time * 3.5 + fortress.id)
    ctx.beginPath()
    ctx.arc(fortress.x, fortress.y, radius * pulse, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255, 170, 90, ${0.12 * pulse})`
    ctx.fill()
    ctx.strokeStyle = `rgba(255, 140, 60, ${0.38 * pulse})`
    ctx.lineWidth = 2
    ctx.stroke()
  }
}
