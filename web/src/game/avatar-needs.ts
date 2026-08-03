import {
  JOY_CAP,
  KNOWLEDGE_CAP,
  SATIETY_CAP,
  SATIETY_LOW_THRESHOLD,
  TRANSFORM_REPEAT_PENALTY,
} from './avatar-config'
import { currentSchedulePhase } from './avatar-schedule'
import { isSeekingMate } from './avatar-reproduction'
import { PLAYER_START_MASS } from './physics'
import type { CircleEntity, TransformKind } from './entity'
import { isAdult } from './entity'

/** 移动圆通过吸收颗粒满足的个人需求，与化身产出无关 */
export type NeedKind = 'eat' | 'learn' | 'play'

export interface NeedWeights {
  eat: number
  learn: number
  play: number
}

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

export function computeNeedWeights(entity: CircleEntity): NeedWeights {
  const eat = needEat(entity)
  const hungerBoost = entity.satiety <= SATIETY_LOW_THRESHOLD ? 0.45 : 0
  return {
    eat: eat + hungerBoost,
    learn: needLearn(entity),
    play: needPlay(entity),
  }
}

export function pickWeightedNeed(entity: CircleEntity, seed: number): NeedKind {
  const w = computeNeedWeights(entity)
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
  return items[items.length - 1].kind
}

export function canConsiderTransform(entity: CircleEntity, gameTimeSec: number): boolean {
  if (!isAdult(entity)) return false
  if (entity.productionStage !== 'none' || entity.isFrozen) return false
  if (isSeekingMate(entity)) return false
  if (needEat(entity) > 0.55) return false
  if (entity.satiety < SATIETY_CAP * 0.45) return false
  if (currentSchedulePhase(entity, gameTimeSec) !== 'wander') return false
  return true
}

/** 化身产出颗粒：仅在闲逛时段、成年且生活无忧时偶尔进行 */
export function pickWeightedTransformKind(
  entity: CircleEntity,
  structureCounts: { farm: number; school: number; park: number },
  seed: number,
  gameTimeSec: number,
): TransformKind | null {
  if (!canConsiderTransform(entity, gameTimeSec)) return null

  const last = entity.transformHistory[entity.transformHistory.length - 1]
  const kinds: TransformKind[] = ['farm', 'school', 'park']
  const scarcity = {
    farm: 1 / (1 + structureCounts.farm),
    school: 1 / (1 + structureCounts.school),
    park: 1 / (1 + structureCounts.park),
  }
  const values = kinds.map((kind) => {
    const base = scarcity[kind]
    const penalty = kind === last ? TRANSFORM_REPEAT_PENALTY : 1
    return base * penalty
  })
  const total = values.reduce((a, b) => a + b, 0)
  if (total < 0.05) return null
  if (hash01(seed + entity.id) < 0.55) return null
  let roll = hash01(seed) * total
  for (let i = 0; i < kinds.length; i++) {
    roll -= values[i]
    if (roll <= 0) return kinds[i]
  }
  return kinds[kinds.length - 1]
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
