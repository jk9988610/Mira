import type { CircleEntity } from './entity'
import { massToRadiusLogarithmic } from './physics'

export function avatarEntityRadius(entity: CircleEntity): number {
  return massToRadiusLogarithmic(entity.mass)
}

export function avatarChildRadius(mass: number): number {
  return massToRadiusLogarithmic(mass)
}
