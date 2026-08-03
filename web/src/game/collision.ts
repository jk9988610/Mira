import type { CircleEntity } from './entity'
import { entityRadius, isActive, isInvincible } from './entity'
import type { PelletGrid } from './pellet-grid'
import { canSwallowCircle } from './player-team'
import { addMass } from './physics'
import type { Pellet } from './pellet'
import { canAbsorbPellet } from './pellet'

export interface EatEvent {
  winner: CircleEntity
  loser: CircleEntity
}

export function absorbPelletsForEntity(
  entity: CircleEntity,
  pellets: Pellet[],
  grid?: PelletGrid,
): Pellet[] {
  if (!isActive(entity)) return []

  const radius = entityRadius(entity)
  const absorbed: Pellet[] = []
  const collect = (pellet: Pellet) => {
    if (!canAbsorbPellet(entity.x, entity.y, radius, pellet)) return
    entity.mass = addMass(entity.mass, pellet.mass)
    absorbed.push(pellet)
  }

  if (grid) {
    grid.forEachInRadius(entity.x, entity.y, radius, collect)
  } else {
    for (const pellet of pellets) collect(pellet)
  }

  return absorbed
}

export function resolveCircleCollisions(entities: CircleEntity[]): EatEvent[] {
  const events: EatEvent[] = []
  const eaten = new Set<number>()

  for (let i = 0; i < entities.length; i++) {
    const a = entities[i]
    if (!isActive(a) || isInvincible(a) || eaten.has(a.id)) continue

    for (let j = i + 1; j < entities.length; j++) {
      const b = entities[j]
      if (!isActive(b) || isInvincible(b) || eaten.has(b.id)) continue
      if (a.isPlayer && b.isPlayer) continue

      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.hypot(dx, dy)

      if (canSwallowCircle(a.mass, b.mass, dist)) {
        a.mass = addMass(a.mass, b.mass)
        eaten.add(b.id)
        events.push({ winner: a, loser: b })
      } else if (canSwallowCircle(b.mass, a.mass, dist)) {
        b.mass = addMass(b.mass, a.mass)
        eaten.add(a.id)
        events.push({ winner: b, loser: a })
        break
      }
    }
  }

  return events
}
