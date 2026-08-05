import { DEFENDER_ROLL_CHANCE, DEFENDER_ROLL_INTERVAL_SEC } from './avatar-config'
import { isFamilyChief } from './family-market'
import type { CircleEntity } from './entity'
import { isActive, isAdult } from './entity'

function hash01(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

/** 将圆登记为保卫者（可化身为堡垒） */
export function registerDefender(entity: CircleEntity): void {
  entity.isDefender = true
}

/** 成年圆周期性掷骰，有一定概率成为保卫者 */
export function tickDefenderEnrollment(
  entities: CircleEntity[],
  gameTimeSec: number,
  dt: number,
): void {
  for (const entity of entities) {
    if (!isActive(entity) || !isAdult(entity, gameTimeSec)) continue
    if (entity.isDefender || isFamilyChief(entity)) continue

    entity.defenderRollTimer -= dt
    if (entity.defenderRollTimer > 0) continue
    entity.defenderRollTimer = DEFENDER_ROLL_INTERVAL_SEC

    const roll = hash01(entity.id * 5.17 + Math.floor(gameTimeSec / DEFENDER_ROLL_INTERVAL_SEC))
    if (roll < DEFENDER_ROLL_CHANCE) {
      entity.isDefender = true
    }
  }
}
