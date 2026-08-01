import type { CircleEntity } from './entity'
import { entityRadius, isActive } from './entity'
import {
  MAX_HUMAN_CLONES,
  MIN_SPLIT_MASS_RATIO,
  SWALLOW_INSIDE_RATIO,
} from './match-config'
import { massToRadius, PLAYER_START_MASS } from './physics'
import { PLAYER_ROSTER } from './roster'
import { createCircle } from './entity'
import { clampEntityToWorld } from './entity'
import { WORLD_HEIGHT, WORLD_WIDTH } from './world'
import { speedForMass } from './movement'

const MERGE_SPEED = 360
const MIN_SPLIT_MASS = PLAYER_START_MASS * MIN_SPLIT_MASS_RATIO

export function getHumanEntities(entities: CircleEntity[]): CircleEntity[] {
  return entities.filter((e) => e.isPlayer)
}

export function getActiveHumans(entities: CircleEntity[]): CircleEntity[] {
  return getHumanEntities(entities).filter(isActive)
}

export function getLargestHuman(entities: CircleEntity[]): CircleEntity | null {
  const humans = getActiveHumans(entities)
  if (humans.length === 0) return null
  return humans.reduce((best, e) => (e.mass > best.mass ? e : best))
}

export function getHumanTotalMass(entities: CircleEntity[]): number {
  return getHumanEntities(entities).reduce((sum, e) => sum + (isActive(e) ? e.mass : 0), 0)
}

export function canSwallowCircle(
  largerMass: number,
  smallerMass: number,
  dist: number,
): boolean {
  if (largerMass <= smallerMass) return false
  const rLarge = massToRadius(largerMass)
  const rSmall = massToRadius(smallerMass)
  return dist < rLarge - rSmall * (1 - SWALLOW_INSIDE_RATIO)
}

export function applyMovement(
  entity: CircleEntity,
  moveX: number,
  moveY: number,
  dt: number,
): void {
  const len = Math.hypot(moveX, moveY)
  if (len < 0.1) return
  const speed = speedForMass(entity.mass)
  entity.x += (moveX / len) * speed * dt
  entity.y += (moveY / len) * speed * dt
  clampEntityToWorld(entity, WORLD_WIDTH, WORLD_HEIGHT)
}

export function trySplitHuman(
  entities: CircleEntity[],
  moveX: number,
  moveY: number,
): CircleEntity | null {
  const humans = getActiveHumans(entities)
  if (humans.length >= MAX_HUMAN_CLONES) return null

  const target = humans.reduce((best, e) => (e.mass > best.mass ? e : best))
  if (target.mass < MIN_SPLIT_MASS) return null

  const half = target.mass / 2
  target.mass = half

  const dirLen = Math.hypot(moveX, moveY)
  const dx = dirLen > 0.1 ? moveX / dirLen : 1
  const dy = dirLen > 0.1 ? moveY / dirLen : 0
  const offset = entityRadius(target) * 0.85

  const clone = createCircle(
    target.x + dx * offset,
    target.y + dy * offset,
    half,
    true,
    PLAYER_ROSTER,
  )
  clampEntityToWorld(clone, WORLD_WIDTH, WORLD_HEIGHT)
  return clone
}

export function updateHumanMerge(
  entities: CircleEntity[],
  dt: number,
): CircleEntity[] {
  const primary = getLargestHuman(entities)
  if (!primary) return entities

  const toRemove = new Set<number>()

  for (const clone of getActiveHumans(entities)) {
    if (clone.id === primary.id) continue

    const dx = primary.x - clone.x
    const dy = primary.y - clone.y
    const dist = Math.hypot(dx, dy)
    const touchDist = entityRadius(primary) + entityRadius(clone) * 0.55

    if (dist < touchDist) {
      primary.mass += clone.mass
      toRemove.add(clone.id)
    } else if (dist > 0.01) {
      clone.x += (dx / dist) * MERGE_SPEED * dt
      clone.y += (dy / dist) * MERGE_SPEED * dt
      clampEntityToWorld(clone, WORLD_WIDTH, WORLD_HEIGHT)
    }
  }

  if (toRemove.size === 0) return entities
  return entities.filter((e) => !toRemove.has(e.id))
}

export function allHumansDead(entities: CircleEntity[]): boolean {
  const humans = getHumanEntities(entities)
  return humans.length > 0 && humans.every((e) => !isActive(e))
}

export function soonestHumanRespawn(entities: CircleEntity[]): number {
  const timers = getHumanEntities(entities)
    .filter((e) => !isActive(e))
    .map((e) => e.respawnTimer)
  return timers.length > 0 ? Math.min(...timers) : 0
}
