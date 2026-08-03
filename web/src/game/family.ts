import type { CircleEntity } from './entity'
import { isActive } from './entity'
import { WORLD_WIDTH } from './world'

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

export function distanceTo(entity: CircleEntity, other: CircleEntity): number {
  return Math.hypot(other.x - entity.x, other.y - entity.y)
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
