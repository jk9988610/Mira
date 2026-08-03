import { isActivelySeekingMate } from './avatar-reproduction'
import type { CircleEntity } from './entity'
import { isActive } from './entity'
import { WORLD_WIDTH } from './world'

const MATE_WAIT_RADIUS = WORLD_WIDTH * 0.42
const GROUP_SCAN_RADIUS = WORLD_WIDTH * 0.88
const GROUP_STAY_RADIUS = WORLD_WIDTH * 0.34
const GROUP_SEEK_RADIUS = WORLD_WIDTH * 0.46

export function nearbyGroupCenter(
  entity: CircleEntity,
  entities: CircleEntity[],
  radius = GROUP_SCAN_RADIUS,
): { x: number; y: number } | null {
  let sumX = 0
  let sumY = 0
  let count = 0
  for (const other of entities) {
    if (other.id === entity.id || !isActive(other) || other.isFrozen) continue
    if (other.avatarRole !== 'none' && other.avatarRole !== 'ally') continue
    const d = distanceTo(entity, other)
    if (d > radius) continue
    sumX += other.x
    sumY += other.y
    count++
  }
  if (count === 0) return null
  return { x: sumX / count, y: sumY / count }
}

export function groupCohesionTarget(
  entity: CircleEntity,
  entities: CircleEntity[],
  seekingMate = false,
): { x: number; y: number } | null {
  const center = nearbyGroupCenter(entity, entities)
  if (!center) return null
  const maxDist = seekingMate ? GROUP_SEEK_RADIUS : GROUP_STAY_RADIUS
  const dist = Math.hypot(center.x - entity.x, center.y - entity.y)
  if (dist > maxDist) return center
  if (dist > maxDist * 0.55 && Math.random() < 0.18) return center
  return null
}

export function distanceTo(entity: CircleEntity, other: CircleEntity): number {
  return Math.hypot(other.x - entity.x, other.y - entity.y)
}

/** 雌性感受到正在朝自己走来的求偶雄性（已锁定自己为目标） */
export function hasNearbyApproachingSuitor(
  female: CircleEntity,
  entities: CircleEntity[],
  now = 0,
): boolean {
  if (female.gender !== 'female' || !isActivelySeekingMate(female, now)) return false
  for (const other of entities) {
    if (other.id === female.id || !isActive(other) || other.isFrozen) continue
    if (other.gender !== 'male' || !isActivelySeekingMate(other, now)) continue
    if (other.aiMateTargetId !== female.id) continue
    if (distanceTo(female, other) <= MATE_WAIT_RADIUS) return true
  }
  return false
}

/** @deprecated 使用 hasNearbyApproachingSuitor */
export function hasNearbySeekingMate(entity: CircleEntity, entities: CircleEntity[], now = 0): boolean {
  return hasNearbyApproachingSuitor(entity, entities, now)
}

export function shouldFemaleWaitForSuitor(
  female: CircleEntity,
  entities: CircleEntity[],
  now = 0,
): boolean {
  return hasNearbyApproachingSuitor(female, entities, now)
}
