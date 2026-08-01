import { addMass, massToRadius } from './physics'
import { canAbsorbPellet, type Pellet } from './pellet'

export function absorbPellets(
  playerX: number,
  playerY: number,
  playerMass: number,
  pellets: Pellet[],
): { mass: number; absorbed: Pellet[] } {
  const radius = massToRadius(playerMass)
  const absorbed: Pellet[] = []
  let mass = playerMass

  for (const pellet of pellets) {
    if (!canAbsorbPellet(playerX, playerY, radius, pellet)) continue
    mass = addMass(mass, pellet.mass)
    absorbed.push(pellet)
  }

  return { mass, absorbed }
}
