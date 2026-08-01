import type { CircleEntity } from './entity'
import { entityRadius } from './entity'
import { addMass } from './physics'
import type { Pellet } from './pellet'
import { canAbsorbPellet } from './pellet'

const SWALLOW_ALPHA = 0.6

export function absorbPelletsForEntity(
  entity: CircleEntity,
  pellets: Pellet[],
): Pellet[] {
  const radius = entityRadius(entity)
  const absorbed: Pellet[] = []

  for (const pellet of pellets) {
    if (!canAbsorbPellet(entity.x, entity.y, radius, pellet)) continue
    entity.mass = addMass(entity.mass, pellet.mass)
    absorbed.push(pellet)
  }

  return absorbed
}

export function resolveCircleCollisions(entities: CircleEntity[]): CircleEntity[] {
  const removed = new Set<number>()

  for (let i = 0; i < entities.length; i++) {
    const a = entities[i]
    if (removed.has(a.id)) continue
    const ra = entityRadius(a)

    for (let j = i + 1; j < entities.length; j++) {
      const b = entities[j]
      if (removed.has(b.id)) continue
      const rb = entityRadius(b)
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.hypot(dx, dy)

      if (a.mass > b.mass && dist < ra - SWALLOW_ALPHA * rb) {
        a.mass = addMass(a.mass, b.mass)
        removed.add(b.id)
      } else if (b.mass > a.mass && dist < rb - SWALLOW_ALPHA * ra) {
        b.mass = addMass(b.mass, a.mass)
        removed.add(a.id)
        break
      }
    }
  }

  return entities.filter((e) => !removed.has(e.id))
}
