import {
  FAMILY_NEED_POST_THRESHOLD,
  FARM_TRANSFORM_WEIGHT,
  JOY_CAP,
  KNOWLEDGE_CAP,
  MALE_POST_PRODUCTION_FARM_MULT,
  PARK_TRANSFORM_WEIGHT,
  SATIETY_CAP,
  SATIETY_LOW_THRESHOLD,
  SCHOOL_TRANSFORM_WEIGHT,
  TRANSFORM_REPEAT_PENALTY,
  TRANSFORM_SKIP_CHANCE,
} from './avatar-config'
import { currentSchedulePhase, isTransformPhase } from './avatar-schedule'
import { PLAYER_START_MASS } from './physics'
import type { CircleEntity, TransformKind } from './entity'
import { isActive, isAdult, isJuvenile } from './entity'
import { isActivelySeekingMate } from './avatar-reproduction'

/** 移动圆通过吸收颗粒满足的个人需求，与化身产出无关 */
export type NeedKind = 'eat' | 'learn' | 'play'

export interface NeedWeights {
  eat: number
  learn: number
  play: number
}

const EAT_NEED_MULT = 1.15
const LEARN_NEED_MULT = 0.1
const PLAY_NEED_MULT = 0.08

const JUVENILE_EAT_MULT = 2.8
const JUVENILE_LEARN_MULT = 0.4
const JUVENILE_PLAY_MULT = 0.32
const SEEKING_TRANSFORM_PENALTY = 0.38

function hash01(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

export function needEat(entity: CircleEntity): number {
  return 1 - Math.min(1, entity.satiety / SATIETY_CAP)
}

export function needLearn(entity: CircleEntity): number {
  return 1 - Math.min(1, entity.knowledge / KNOWLEDGE_CAP)
}

export function needPlay(entity: CircleEntity): number {
  return 1 - Math.min(1, entity.joy / JOY_CAP)
}

export function computeNeedWeights(entity: CircleEntity, gameTimeSec = 0): NeedWeights {
  const eat = needEat(entity)
  const hungerBoost = entity.satiety <= SATIETY_LOW_THRESHOLD ? 0.5 : 0
  if (isJuvenile(entity, gameTimeSec)) {
    return {
      eat: (eat + hungerBoost) * JUVENILE_EAT_MULT,
      learn: needLearn(entity) * JUVENILE_LEARN_MULT,
      play: needPlay(entity) * JUVENILE_PLAY_MULT,
    }
  }
  return {
    eat: (eat + hungerBoost) * EAT_NEED_MULT,
    learn: needLearn(entity) * LEARN_NEED_MULT,
    play: needPlay(entity) * PLAY_NEED_MULT,
  }
}

export function pickWeightedNeed(entity: CircleEntity, seed: number, gameTimeSec = 0): NeedKind {
  const w = computeNeedWeights(entity, gameTimeSec)
  const items: { kind: NeedKind; value: number }[] = [
    { kind: 'eat', value: w.eat },
    { kind: 'learn', value: w.learn },
    { kind: 'play', value: w.play },
  ]
  const total = items.reduce((sum, item) => sum + item.value, 0)
  if (total <= 0.05) return 'eat'
  let roll = hash01(seed) * total
  for (const item of items) {
    roll -= item.value
    if (roll <= 0) return item.kind
  }
  return 'eat'
}

export function canConsiderTransform(
  entity: CircleEntity,
  gameTimeSec: number,
  seekingMate = false,
): boolean {
  if (!isAdult(entity, gameTimeSec)) return false
  if (entity.productionStage !== 'none' || entity.isFrozen) return false
  const phase = currentSchedulePhase(entity, gameTimeSec, seekingMate)
  if (!isTransformPhase(phase)) return false
  if (needEat(entity) > 0.62) return false
  if (entity.satiety < SATIETY_CAP * 0.38) return false
  return true
}

const TRANSFORM_WEIGHT: Record<TransformKind, number> = {
  farm: FARM_TRANSFORM_WEIGHT,
  school: SCHOOL_TRANSFORM_WEIGHT,
  park: PARK_TRANSFORM_WEIGHT,
  fortress: 0,
}

export function findJuvenileOffspring(
  parent: CircleEntity,
  entities: CircleEntity[],
  gameTimeSec: number,
): CircleEntity[] {
  const out: CircleEntity[] = []
  for (const e of entities) {
    if (!isActive(e) || !isJuvenile(e, gameTimeSec)) continue
    if (parent.gender === 'male' && e.fatherId === parent.id) out.push(e)
    else if (parent.gender === 'female' && e.motherId === parent.id) out.push(e)
  }
  return out
}

/** 家族调查：按平均饱食/知识/快乐比例选择最急需的化身类型 */
export function chooseAvatarKindToBuild(
  foodRatio: number,
  knowledgeRatio: number,
  happinessRatio: number,
): TransformKind | null {
  const eat = 1 - foodRatio
  const learn = 1 - knowledgeRatio
  const play = 1 - happinessRatio
  if (
    eat < FAMILY_NEED_POST_THRESHOLD &&
    learn < FAMILY_NEED_POST_THRESHOLD &&
    play < FAMILY_NEED_POST_THRESHOLD
  ) {
    return null
  }
  if (eat >= learn && eat >= play) return 'farm'
  if (learn >= play) return 'school'
  return 'park'
}

export function hasJuvenileOffspringToPlan(
  entity: CircleEntity,
  entities: CircleEntity[],
  gameTimeSec: number,
): boolean {
  return findJuvenileOffspring(entity, entities, gameTimeSec).length > 0
}

export function offspringPlanTransformKind(offspring: CircleEntity[]): TransformKind {
  let eat = 0
  let learn = 0
  let play = 0
  for (const child of offspring) {
    eat += needEat(child)
    learn += needLearn(child)
    play += needPlay(child)
  }
  if (offspring.length === 0) return 'farm'
  if (eat >= learn && eat >= play) return 'farm'
  if (learn >= play) return 'school'
  return 'park'
}

/** 化身产出颗粒：饱腹时在觅食/闲逛时段进行，农场为主 */
export function pickWeightedTransformKind(
  entity: CircleEntity,
  structureCounts: { farm: number; school: number; park: number },
  seed: number,
  gameTimeSec: number,
  entities: CircleEntity[] = [],
): TransformKind | null {
  if (isJuvenile(entity, gameTimeSec)) return null
  const seeking = isActivelySeekingMate(entity, gameTimeSec)
  if (!canConsiderTransform(entity, gameTimeSec, seeking)) return null

  if (seeking && hash01(seed + entity.id * 0.41) > 0.52) return null

  const offspring = findJuvenileOffspring(entity, entities, gameTimeSec)
  if (offspring.length > 0 && hash01(seed + entity.id * 1.07) < 0.78) {
    return offspringPlanTransformKind(offspring)
  }

  const last = entity.transformHistory[entity.transformHistory.length - 1]
  const kinds: TransformKind[] = ['farm', 'school', 'park']
  const scarcity = {
    farm: 1 / (1 + structureCounts.farm * 0.45),
    school: 1 / (1 + structureCounts.school),
    park: 1 / (1 + structureCounts.park),
    fortress: 1,
  }
  const values = kinds.map((kind) => {
    let base = TRANSFORM_WEIGHT[kind] * scarcity[kind]
    const penalty = kind === last ? TRANSFORM_REPEAT_PENALTY : 1
    if (seeking) base *= SEEKING_TRANSFORM_PENALTY
    if (entity.gender === 'male' && entity.productionCooldown > 0 && kind === 'farm') {
      base *= MALE_POST_PRODUCTION_FARM_MULT
    }
    return base * penalty
  })
  const total = values.reduce((a, b) => a + b, 0)
  if (total < 0.05) return null
  if (hash01(seed + entity.id) < TRANSFORM_SKIP_CHANCE) return null
  let roll = hash01(seed) * total
  for (let i = 0; i < kinds.length; i++) {
    roll -= values[i]
    if (roll <= 0) return kinds[i]
  }
  return 'farm'
}

export function massLabel(mass: number): string {
  const ref = PLAYER_START_MASS
  if (mass >= ref * 3.5) return '壮硕'
  if (mass >= ref * 2) return '结实'
  if (mass >= ref * 1.1) return '匀称'
  if (mass >= ref * 0.7) return '偏轻'
  return '幼小'
}

export function satietyEvalLabel(entity: CircleEntity): string {
  const ratio = entity.satiety / SATIETY_CAP
  if (ratio >= 0.85) return '饱足'
  if (ratio >= 0.55) return '适宜'
  if (ratio > 0.15) return '偏饥'
  return '饥竭'
}
