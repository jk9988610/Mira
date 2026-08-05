import {
  AVATAR_PRACTITIONER_ROLL_CHANCE,
  AVATAR_PRACTITIONER_ROLL_INTERVAL_SEC,
  FORTRESS_PRACTITIONER_ROLL_CHANCE,
  FORTRESS_PRACTITIONER_ROLL_INTERVAL_SEC,
} from './avatar-config'
import { isFamilyChief } from './family-market'
import type { CircleEntity, TransformKind } from './entity'
import { isActive, isAdult } from './entity'

export const PRACTITIONER_KIND_LABEL: Record<TransformKind, string> = {
  farm: '农场化身者',
  school: '校园化身者',
  park: '乐园化身者',
  fortress: '堡垒化身者',
}

const PATROL_BOOST_MULT = 3.4
const PATROL_BOOST_CAP = 0.82

const PRACTITIONER_FLAGS: Record<TransformKind, keyof CircleEntity> = {
  farm: 'practitionerFarm',
  school: 'practitionerSchool',
  park: 'practitionerPark',
  fortress: 'practitionerFortress',
}

const PRACTITIONER_ROLL_TIMERS: Record<TransformKind, keyof CircleEntity> = {
  farm: 'practitionerFarmRollTimer',
  school: 'practitionerSchoolRollTimer',
  park: 'practitionerParkRollTimer',
  fortress: 'practitionerFortressRollTimer',
}

const PRACTITIONER_REG_COUNTS: Record<TransformKind, keyof CircleEntity> = {
  farm: 'countFarmPractitionerRegs',
  school: 'countSchoolPractitionerRegs',
  park: 'countParkPractitionerRegs',
  fortress: 'countFortressPractitionerRegs',
}

const ENROLLMENT_KINDS: TransformKind[] = ['farm', 'school', 'park', 'fortress']

function hash01(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function getFamilyId(entity: CircleEntity): number {
  return entity.familyId || entity.id
}

export function isPractitioner(entity: CircleEntity, kind: TransformKind): boolean {
  return Boolean(entity[PRACTITIONER_FLAGS[kind]])
}

/** 将成年圆登记为指定类型的化身者（仅首次入册时累计次数） */
export function registerPractitioner(entity: CircleEntity, kind: TransformKind): void {
  const wasRegistered = isPractitioner(entity, kind)
  ;(entity[PRACTITIONER_FLAGS[kind]] as boolean) = true
  if (!wasRegistered) {
    ;(entity[PRACTITIONER_REG_COUNTS[kind]] as number)++
  }
}

/** 履约结束或订单失效后注销该类型化身者身份 */
export function unregisterPractitioner(entity: CircleEntity, kind: TransformKind): void {
  ;(entity[PRACTITIONER_FLAGS[kind]] as boolean) = false
}

function rollInterval(kind: TransformKind): number {
  return kind === 'fortress'
    ? FORTRESS_PRACTITIONER_ROLL_INTERVAL_SEC
    : AVATAR_PRACTITIONER_ROLL_INTERVAL_SEC
}

function rollChance(kind: TransformKind): number {
  return kind === 'fortress' ? FORTRESS_PRACTITIONER_ROLL_CHANCE : AVATAR_PRACTITIONER_ROLL_CHANCE
}

/** 成年圆周期性掷骰，按类型分别入册化身者；巡检缺口会提高对应类型入册概率 */
export function tickPractitionerEnrollment(
  entities: CircleEntity[],
  gameTimeSec: number,
  dt: number,
  familyBoosts: ReadonlyMap<number, TransformKind> = new Map(),
): void {
  for (const entity of entities) {
    if (!isActive(entity) || !isAdult(entity, gameTimeSec)) continue
    if (isFamilyChief(entity)) continue
    if (entity.marketContractOrderId > 0 || entity.orderServiceTimer > 0) continue

    const familyId = getFamilyId(entity)
    const boostKind = familyBoosts.get(familyId)

    for (const kind of ENROLLMENT_KINDS) {
      if (isPractitioner(entity, kind)) continue

      const timerKey = PRACTITIONER_ROLL_TIMERS[kind]
      let timer = entity[timerKey] as number
      timer -= dt
      if (timer > 0) {
        ;(entity[timerKey] as number) = timer
        continue
      }
      ;(entity[timerKey] as number) = rollInterval(kind)

      const interval = rollInterval(kind)
      let chance = rollChance(kind)
      if (boostKind === kind) {
        chance = Math.min(PATROL_BOOST_CAP, chance * PATROL_BOOST_MULT)
      }

      const roll = hash01(
        entity.id * (kind === 'fortress' ? 5.17 : 7.31) +
          Math.floor(gameTimeSec / interval) +
          ENROLLMENT_KINDS.indexOf(kind) * 1.9,
      )
      if (roll < chance) {
        registerPractitioner(entity, kind)
      }
    }
  }
}
