import { JOY_CAP, KNOWLEDGE_CAP, SATIETY_CAP } from './avatar-config'
import { PLAYER_START_MASS } from './physics'
import type { CircleEntity } from './entity'
import { isAdult } from './entity'

export type NeedKind = 'eat' | 'learn' | 'play' | 'mate' | 'work'

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
  return Math.min(1, 0.35 + needLearn(entity) * 0.25 + needPlay(entity) * 0.2)
}

export function dominantNeed(entity: CircleEntity): NeedKind {
  const needs: { kind: NeedKind; value: number }[] = [
    { kind: 'eat', value: needEat(entity) },
    { kind: 'learn', value: needLearn(entity) },
    { kind: 'play', value: needPlay(entity) },
    { kind: 'mate', value: needMate(entity) },
    { kind: 'work', value: needWork(entity) },
  ]
  needs.sort((a, b) => b.value - a.value)
  return needs[0].value > 0.15 ? needs[0].kind : 'eat'
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
