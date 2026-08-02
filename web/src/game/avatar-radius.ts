import {
  FARM_STRUCTURE_MASS,
  RANCH_STRUCTURE_MASS,
} from './avatar-config'
import type { CircleEntity } from './entity'
import { entityRadius } from './entity'
import { massToRadiusLogarithmic } from './physics'

export function avatarEntityRadius(entity: CircleEntity): number {
  if (entity.avatarRole === 'farm') {
    return entityRadius({ ...entity, mass: FARM_STRUCTURE_MASS })
  }
  if (entity.avatarRole === 'ranch') {
    return entityRadius({ ...entity, mass: RANCH_STRUCTURE_MASS })
  }
  return massToRadiusLogarithmic(entity.mass)
}

export function avatarChildRadius(mass: number): number {
  return massToRadiusLogarithmic(mass)
}
