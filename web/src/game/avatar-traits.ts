import {
  ADULT_MASS_THRESHOLD,
  JOY_ABSORB_PAUSE,
  JOY_ABSORB_RESUME,
  KNOWLEDGE_ABSORB_PAUSE,
  KNOWLEDGE_ABSORB_RESUME,
  TRAIT_DIGEST_RATE,
  TRAIT_INTAKE_CAP,
  TRAIT_PER_INTAKE,
} from './avatar-config'
import type { CircleEntity } from './entity'
import type { PelletKind } from './pellet'

export function workEfficiency(entity: CircleEntity): number {
  return 0.55 + entity.knowledge * 0.25 + entity.joy * 0.2
}

export function isAdultEntity(entity: CircleEntity): boolean {
  return entity.mass >= ADULT_MASS_THRESHOLD
}

export function remainingKnowledgeIntakeRoom(entity: CircleEntity): number {
  return Math.max(0, TRAIT_INTAKE_CAP - entity.knowledgeIntake)
}

export function remainingJoyIntakeRoom(entity: CircleEntity): number {
  return Math.max(0, TRAIT_INTAKE_CAP - entity.joyIntake)
}

export function updateTraitAbsorption(entity: CircleEntity): void {
  if (entity.isFrozen) return
  if (entity.knowledge >= KNOWLEDGE_ABSORB_PAUSE || remainingKnowledgeIntakeRoom(entity) <= 0) {
    entity.knowledgeAbsorbPaused = true
  } else if (entity.knowledge <= KNOWLEDGE_ABSORB_RESUME) {
    entity.knowledgeAbsorbPaused = false
  }
  if (entity.joy >= JOY_ABSORB_PAUSE || remainingJoyIntakeRoom(entity) <= 0) {
    entity.joyAbsorbPaused = true
  } else if (entity.joy <= JOY_ABSORB_RESUME) {
    entity.joyAbsorbPaused = false
  }
}

export function canAbsorbPelletKind(entity: CircleEntity, kind: PelletKind): boolean {
  if (kind === 'food') return true
  updateTraitAbsorption(entity)
  if (kind === 'knowledge') return !entity.knowledgeAbsorbPaused && remainingKnowledgeIntakeRoom(entity) > 0
  return !entity.joyAbsorbPaused && remainingJoyIntakeRoom(entity) > 0
}

export function addTraitIntake(entity: CircleEntity, kind: 'knowledge' | 'joy', amount: number): number {
  const room = kind === 'knowledge' ? remainingKnowledgeIntakeRoom(entity) : remainingJoyIntakeRoom(entity)
  const gain = Math.min(amount, room)
  if (gain <= 0) return 0
  if (kind === 'knowledge') entity.knowledgeIntake += gain
  else entity.joyIntake += gain
  return gain
}

export function tickTraitDigestion(entity: CircleEntity, dt: number): void {
  const rate = TRAIT_DIGEST_RATE * entity.health * dt

  if (entity.knowledgeIntake > 0 && entity.knowledge < 1) {
    const deficit = 1 - entity.knowledge
    const need = deficit / TRAIT_PER_INTAKE
    const used = Math.min(rate, entity.knowledgeIntake, need)
    entity.knowledgeIntake -= used
    entity.knowledge = Math.min(1, entity.knowledge + used * TRAIT_PER_INTAKE)
  }

  if (entity.joyIntake > 0 && entity.joy < 1) {
    const deficit = 1 - entity.joy
    const need = deficit / TRAIT_PER_INTAKE
    const used = Math.min(rate, entity.joyIntake, need)
    entity.joyIntake -= used
    entity.joy = Math.min(1, entity.joy + used * TRAIT_PER_INTAKE)
  }
}

export function traitLabel(value: number): string {
  if (value >= 0.8) return '充沛'
  if (value >= 0.55) return '良好'
  if (value >= 0.25) return '一般'
  return '匮乏'
}
