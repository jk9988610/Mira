import { AVATAR_PRACTITIONER_ROLL_CHANCE, AVATAR_PRACTITIONER_ROLL_INTERVAL_SEC } from './avatar-config'
import { isFamilyChief } from './family-market'
import type { CircleEntity } from './entity'
import { isActive, isAdult } from './entity'

function hash01(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

/** 将圆登记为化身者（参与订单/化身工作） */
export function registerAvatarPractitioner(entity: CircleEntity): void {
  entity.isAvatarPractitioner = true
}

/** 成年圆周期性掷骰，有一定概率成为化身者 */
export function tickAvatarPractitionerEnrollment(
  entities: CircleEntity[],
  gameTimeSec: number,
  dt: number,
): void {
  for (const entity of entities) {
    if (!isActive(entity) || !isAdult(entity, gameTimeSec)) continue
    if (entity.isAvatarPractitioner || isFamilyChief(entity)) continue

    entity.practitionerRollTimer -= dt
    if (entity.practitionerRollTimer > 0) continue
    entity.practitionerRollTimer = AVATAR_PRACTITIONER_ROLL_INTERVAL_SEC

    const roll = hash01(entity.id * 7.31 + Math.floor(gameTimeSec / AVATAR_PRACTITIONER_ROLL_INTERVAL_SEC))
    if (roll < AVATAR_PRACTITIONER_ROLL_CHANCE) {
      entity.isAvatarPractitioner = true
    }
  }
}
