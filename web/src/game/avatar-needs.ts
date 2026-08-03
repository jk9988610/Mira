import { JOY_CAP, KNOWLEDGE_CAP, SATIETY_CAP, SATIETY_LOW_THRESHOLD, TRANSFORM_REPEAT_PENALTY } from './avatar-config'
import { PLAYER_START_MASS } from './physics'
import type { CircleEntity, TransformKind } from './entity'
import { isAdult } from './entity'

export type NeedKind = 'eat' | 'learn' | 'play' | 'mate' | 'work'

export interface NeedWeights {
  eat: number
  learn: number
  play: number
  mate: number
  work: number
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

export function needMate(entity: CircleEntity): number {
  if (!isAdult(entity) || entity.productionStage !== 'none') return 0
  return Math.min(1, entity.mateDrive)
}

export function needWork(entity: CircleEntity): number {
  const hunger = needEat(entity)
  return Math.min(1, 0.2 + hunger * 0.45 + needLearn(entity) * 0.15 + needPlay(entity) * 0.12)
}

export function computeNeedWeights(entity: CircleEntity): NeedWeights {
  const eat = needEat(entity)
  const learn = needLearn(entity)
  const play = needPlay(entity)
  const mate = needMate(entity)
  const work = needWork(entity)
  const hungerBoost = entity.satiety <= SATIETY_LOW_THRESHOLD ? 0.35 : 0
  return {
    eat: eat + hungerBoost,
    learn: learn * 0.92,
    play: play * 0.92,
    mate,
    work,
  }
}

export function pickWeightedNeed(entity: CircleEntity, seed: number): NeedKind {
  const w = computeNeedWeights(entity)
  const items: { kind: NeedKind; value: number }[] = [
    { kind: 'eat', value: w.eat },
    { kind: 'learn', value: w.learn },
    { kind: 'play', value: w.play },
    { kind: 'mate', value: w.mate },
    { kind: 'work', value: w.work },
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

export function pickWeightedTransformKind(entity: CircleEntity, seed: number): TransformKind | null {
  const w = computeNeedWeights(entity)
  const last = entity.transformHistory[entity.transformHistory.length - 1]
  const kinds: TransformKind[] = ['work', 'learn', 'play']
  const values = kinds.map((kind) => {
    const base = kind === 'work' ? w.work : kind === 'learn' ? w.learn : w.play
    const penalty = kind === last ? TRANSFORM_REPEAT_PENALTY : 1
    return base * penalty
  })
  const total = values.reduce((a, b) => a + b, 0)
  if (total < 0.1) return null
  let roll = hash01(seed) * total
  for (let i = 0; i < kinds.length; i++) {
    roll -= values[i]
    if (roll <= 0) return kinds[i]
  }
  return kinds[kinds.length - 1]
}

/** @deprecated 使用 pickWeightedNeed */
export function dominantNeed(entity: CircleEntity): NeedKind {
  return pickWeightedNeed(entity, entity.id * 1.7 + entity.transformHistory.length * 2.3)
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
