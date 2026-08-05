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

export function isPractitioner(entity: CircleEntity, kind: TransformKind): boolean {
  return Boolean(entity[PRACTITIONER_FLAGS[kind]])
}

/** 将成年圆登记为指定类型的化身者 */
export function registerPractitioner(entity: CircleEntity, kind: TransformKind): void {
  if (!isPractitioner(entity, kind)) {
    ;(entity[PRACTITIONER_FLAGS[kind]] as boolean) = true
  }
  ;(entity[PRACTITIONER_REG_COUNTS[kind]] as number)++
}

function rollInterval(kind: TransformKind): number {
  return kind === 'fortress'
    ? FORTRESS_PRACTITIONER_ROLL_INTERVAL_SEC
    : AVATAR_PRACTITIONER_ROLL_INTERVAL_SEC
}

function rollChance(kind: TransformKind): number {
  return kind === 'fortress' ? FORTRESS_PRACTITIONER_ROLL_CHANCE : AVATAR_PRACTITIONER_ROLL_CHANCE
}

/** 成年圆周期性掷骰，按类型分别入册化身者 */
export function tickPractitionerEnrollment(
  entities: CircleEntity[],
  gameTimeSec: number,
  dt: number,
): void {
  for (const entity of entities) {
    if (!isActive(entity) || !isAdult(entity, gameTimeSec)) continue
    if (isFamilyChief(entity)) continue

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
      const roll = hash01(
        entity.id * (kind === 'fortress' ? 5.17 : 7.31) +
          Math.floor(gameTimeSec / interval) +
          ENROLLMENT_KINDS.indexOf(kind) * 1.9,
      )
      if (roll < rollChance(kind)) {
        registerPractitioner(entity, kind)
      }
    }
  }
}

/** @deprecated 使用 registerPractitioner(entity, kind) */
export function registerAvatarPractitioner(entity: CircleEntity): void {
  registerPractitioner(entity, 'farm')
  registerPractitioner(entity, 'school')
  registerPractitioner(entity, 'park')
}
