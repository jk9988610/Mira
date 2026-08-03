import { AVATAR_BASE_RADIUS } from './avatar-config'
import type { CircleEntity } from './entity'

export function avatarEntityRadius(entity: CircleEntity): number {
  return AVATAR_BASE_RADIUS * entity.visualScale
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
