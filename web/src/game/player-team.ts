import type { CircleEntity } from './entity'
import { clampEntityToWorld, createCircle, entityRadius, isActive } from './entity'
import {
  MAX_HUMAN_CLONES,
  MERGE_INSIDE_RATIO,
  MIN_SPLIT_MASS_RATIO,
  RESPAWN_DELAY_SEC,
  SWALLOW_INSIDE_RATIO,
} from './match-config'
import { massToRadius, PLAYER_START_MASS } from './physics'
import { PLAYER_ROSTER } from './roster'
import { WORLD_HEIGHT, WORLD_WIDTH } from './world'
import { speedForMass } from './movement'

const CENTER_PULL_SPEED = 280
const GATHER_SPEED = 320
const DETECTION_FACTOR = 11
const SPLIT_LAUNCH_SPEED = 520
const SPLIT_RECOIL = 0.38
const IMPULSE_DECAY = 4.8
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

/** 多分身时的质量中心：Σ(mᵢ·pᵢ) / Σmᵢ，用于相机与聚拢目标 */
export function getHumanCenterOfMass(
  entities: CircleEntity[],
): { x: number; y: number; totalMass: number } | null {
  const humans = getActiveHumans(entities)
  if (humans.length === 0) return null

  let totalMass = 0
  let x = 0
  let y = 0
  for (const h of humans) {
    totalMass += h.mass
    x += h.mass * h.x
    y += h.mass * h.y
  }
  return { x: x / totalMass, y: y / totalMass, totalMass }
}

export function getHumanCameraFocus(
  entities: CircleEntity[],
): { x: number; y: number; mass: number } {
  const center = getHumanCenterOfMass(entities)
  if (center) return { x: center.x, y: center.y, mass: center.totalMass }
  return { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2, mass: PLAYER_START_MASS }
}

function insideOverlap(
  largerMass: number,
  smallerMass: number,
  dist: number,
  insideRatio: number,
): boolean {
  if (largerMass <= smallerMass) return false
  const rLarge = massToRadius(largerMass)
  const rSmall = massToRadius(smallerMass)
  return dist < rLarge - rSmall * (1 - insideRatio)
}

export function canSwallowCircle(
  largerMass: number,
  smallerMass: number,
  dist: number,
): boolean {
  return insideOverlap(largerMass, smallerMass, dist, SWALLOW_INSIDE_RATIO)
}

export function canMergeCircles(
  largerMass: number,
  smallerMass: number,
  dist: number,
): boolean {
  return insideOverlap(largerMass, smallerMass, dist, MERGE_INSIDE_RATIO)
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

export function applyEntityImpulse(entity: CircleEntity, dt: number): void {
  if (Math.abs(entity.impulseX) < 0.5 && Math.abs(entity.impulseY) < 0.5) {
    entity.impulseX = 0
    entity.impulseY = 0
    return
  }
  entity.x += entity.impulseX * dt
  entity.y += entity.impulseY * dt
  const decay = Math.exp(-IMPULSE_DECAY * dt)
  entity.impulseX *= decay
  entity.impulseY *= decay
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

  const clone = createCircle(target.x, target.y, half, true, PLAYER_ROSTER)
  const sep = entityRadius(target) + entityRadius(clone) + 4
  clone.x = target.x + dx * sep
  clone.y = target.y + dy * sep
  clone.impulseX = dx * SPLIT_LAUNCH_SPEED
  clone.impulseY = dy * SPLIT_LAUNCH_SPEED
  target.impulseX = -dx * SPLIT_LAUNCH_SPEED * SPLIT_RECOIL
  target.impulseY = -dy * SPLIT_LAUNCH_SPEED * SPLIT_RECOIL

  clampEntityToWorld(clone, WORLD_WIDTH, WORLD_HEIGHT)
  clampEntityToWorld(target, WORLD_WIDTH, WORLD_HEIGHT)
  return clone
}

/** 按住 E：各分身朝自身探测范围内质量最大的圆移动 */
export function updateHumanGather(
  humans: CircleEntity[],
  allEntities: CircleEntity[],
  dt: number,
): void {
  for (const human of humans) {
    const vision = entityRadius(human) * DETECTION_FACTOR
    let target: CircleEntity | null = null
    let bestMass = -1

    for (const other of allEntities) {
      if (other.id === human.id || !isActive(other)) continue
      const dist = Math.hypot(other.x - human.x, other.y - human.y)
      if (dist > vision || other.mass <= bestMass) continue
      bestMass = other.mass
      target = other
    }

    if (!target) continue
    const dx = target.x - human.x
    const dy = target.y - human.y
    const dist = Math.hypot(dx, dy)
    if (dist < 1) continue
    human.x += (dx / dist) * GATHER_SPEED * dt
    human.y += (dy / dist) * GATHER_SPEED * dt
    clampEntityToWorld(human, WORLD_WIDTH, WORLD_HEIGHT)
  }
}

/** 分身之间保持碰撞体积，不互相覆盖 */
export function separateHumanClones(entities: CircleEntity[]): void {
  const humans = getActiveHumans(entities)
  for (let i = 0; i < humans.length; i++) {
    for (let j = i + 1; j < humans.length; j++) {
      const a = humans[i]
      const b = humans[j]
      const dx = b.x - a.x
      const dy = b.y - a.y
      let dist = Math.hypot(dx, dy)
      const minDist = entityRadius(a) + entityRadius(b)
      if (dist >= minDist - 0.5) continue
      if (dist < 0.001) dist = 0.001
      const overlap = minDist - dist
      const nx = dx / dist
      const ny = dy / dist
      const push = overlap * 0.5
      a.x -= nx * push
      a.y -= ny * push
      b.x += nx * push
      b.y += ny * push
      clampEntityToWorld(a, WORLD_WIDTH, WORLD_HEIGHT)
      clampEntityToWorld(b, WORLD_WIDTH, WORLD_HEIGHT)
    }
  }
}

/** 多分身时朝质量中心聚拢（非按键触发） */
export function updateHumanCenterPull(entities: CircleEntity[], dt: number): void {
  const humans = getActiveHumans(entities)
  if (humans.length < 2) return

  const center = getHumanCenterOfMass(entities)
  if (!center) return

  for (const human of humans) {
    const dx = center.x - human.x
    const dy = center.y - human.y
    const dist = Math.hypot(dx, dy)
    if (dist < 1) continue
    human.x += (dx / dist) * CENTER_PULL_SPEED * dt
    human.y += (dy / dist) * CENTER_PULL_SPEED * dt
    clampEntityToWorld(human, WORLD_WIDTH, WORLD_HEIGHT)
  }
}

/** 重叠达 2/3 时合体，保留较大分身 */
export function resolveHumanMerges(entities: CircleEntity[]): CircleEntity[] {
  const humans = getActiveHumans(entities)
  if (humans.length < 2) return entities

  const toRemove = new Set<number>()

  for (let i = 0; i < humans.length; i++) {
    for (let j = i + 1; j < humans.length; j++) {
      const a = humans[i]
      const b = humans[j]
      if (toRemove.has(a.id) || toRemove.has(b.id)) continue

      const larger = a.mass >= b.mass ? a : b
      const smaller = a.mass >= b.mass ? b : a
      const dist = Math.hypot(larger.x - smaller.x, larger.y - smaller.y)

      if (canMergeCircles(larger.mass, smaller.mass, dist)) {
        larger.mass += smaller.mass
        toRemove.add(smaller.id)
      }
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

/** 被摄取的分身永久消失；仅当所有分身都死亡时才整体复活 */
export function applyHumanDeaths(
  entities: CircleEntity[],
  eatenIds: Iterable<number>,
): CircleEntity[] {
  const eaten = new Set(eatenIds)
  if (eaten.size === 0) return entities

  const surviving = getActiveHumans(entities).filter((h) => !eaten.has(h.id))
  if (surviving.length > 0) {
    return entities.filter((e) => !eaten.has(e.id))
  }

  const eatenHumans = getHumanEntities(entities).filter((h) => eaten.has(h.id))
  if (eatenHumans.length === 0) return entities

  const respawnTarget = eatenHumans.reduce((best, e) => (e.mass > best.mass ? e : best))
  respawnTarget.respawnTimer = RESPAWN_DELAY_SEC

  return entities.filter((e) => !e.isPlayer || e.id === respawnTarget.id)
}
