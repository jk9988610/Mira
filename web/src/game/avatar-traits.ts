import {
  HEALTH_CAP,
  JOY_CAP,
  KNOWLEDGE_CAP,
  TRAIT_DIGEST_RATE,
  TRAIT_INTAKE_CAP,
} from './avatar-config'
import type { CircleEntity } from './entity'
import type { PelletKind } from './pellet'

export function workEfficiency(entity: CircleEntity): number {
  const k = entity.knowledge / KNOWLEDGE_CAP
  const j = entity.joy / JOY_CAP
  return 0.55 + k * 0.25 + j * 0.2
}

export function remainingKnowledgeIntakeRoom(entity: CircleEntity): number {
  return Math.max(0, TRAIT_INTAKE_CAP - entity.knowledgeIntake)
}

export function remainingJoyIntakeRoom(entity: CircleEntity): number {
  return Math.max(0, TRAIT_INTAKE_CAP - entity.joyIntake)
}

export function canAbsorbPelletKind(entity: CircleEntity, kind: PelletKind): boolean {
  if (kind === 'food') return true
  if (kind === 'knowledge') {
    return entity.knowledge < KNOWLEDGE_CAP * 0.88 && remainingKnowledgeIntakeRoom(entity) > 0
  }
  return entity.joy < JOY_CAP * 0.88 && remainingJoyIntakeRoom(entity) > 0
}

export function addTraitIntake(entity: CircleEntity, kind: 'knowledge' | 'joy', amount: number): number {
  const room = kind === 'knowledge' ? remainingKnowledgeIntakeRoom(entity) : remainingJoyIntakeRoom(entity)
  const gain = Math.min(amount * 1.35, room)
  if (gain <= 0) return 0
  if (kind === 'knowledge') entity.knowledgeIntake += gain
  else entity.joyIntake += gain
  return gain
}

export function tickTraitDigestion(entity: CircleEntity, dt: number): void {
  const healthFactor = Math.max(0.35, entity.health / HEALTH_CAP)
  const rate = TRAIT_DIGEST_RATE * healthFactor * dt

  if (entity.knowledgeIntake > 0 && entity.knowledge < KNOWLEDGE_CAP) {
    const room = KNOWLEDGE_CAP - entity.knowledge
    const used = Math.min(rate, entity.knowledgeIntake, room)
    entity.knowledgeIntake -= used
    entity.knowledge += used
  }

  if (entity.joyIntake > 0 && entity.joy < JOY_CAP) {
    const room = JOY_CAP - entity.joy
    const used = Math.min(rate, entity.joyIntake, room)
    entity.joyIntake -= used
    entity.joy += used
  }
}

export function traitLabel(value: number, cap: number): string {
  const ratio = value / cap
  if (ratio >= 0.8) return '充沛'
  if (ratio >= 0.55) return '良好'
  if (ratio >= 0.25) return '一般'
  return '匮乏'
}
