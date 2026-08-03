import { AVATAR_BASE_RADIUS } from './avatar-config'
import type { CircleEntity } from './entity'
import { PLAYER_START_MASS } from './physics'

const ABSORB_RADIUS_MIN_RATIO = 0.3

export function avatarEntityRadius(entity: CircleEntity): number {
  return AVATAR_BASE_RADIUS * entity.visualScale
}

/** 质量越大摄取范围越大，上限为自身半径 */
export function absorbRadiusForEntity(entity: CircleEntity): number {
  const bodyRadius = avatarEntityRadius(entity)
  const massRatio = Math.min(1, entity.mass / (PLAYER_START_MASS * 3))
  const ratio = ABSORB_RADIUS_MIN_RATIO + (1 - ABSORB_RADIUS_MIN_RATIO) * massRatio
  return Math.min(bodyRadius, bodyRadius * ratio)
}

export function avatarChildRadius(_mass: number): number {
  return AVATAR_BASE_RADIUS
}

export function clampAvatarEntityToWorld(
  entity: CircleEntity,
  width: number,
  height: number,
): void {
  const r = avatarEntityRadius(entity)
  entity.x = Math.max(r, Math.min(width - r, entity.x))
  entity.y = Math.max(r, Math.min(height - r, entity.y))
}
