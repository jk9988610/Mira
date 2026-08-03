import {
  DAY_DURATION_SEC,
  DAY_SLEEP_SEC,
  DAY_WORK_SEC,
  HEALTH_CAP,
  JOY_CAP,
  NPC_ARRIVE_DIST,
  NPC_JITTER_DIST,
  NPC_TARGET_CACHE_SEC,
  TRANSFORM_REPEAT_PENALTY,
} from './avatar-config'
import { clampAvatarEntityToWorld } from './avatar-radius'
import type { CircleEntity, TransformKind } from './entity'
import { isActive } from './entity'
import type { PelletGrid } from './pellet-grid'
import type { PelletKind } from './pellet'
import { speedForMass } from './movement'
import { PLAYER_START_MASS } from './physics'
import { WORLD_HEIGHT, WORLD_WIDTH } from './world'

export type NpcSchedulePhase = 'work' | 'learn' | 'sleep' | 'forage' | 'play' | 'weekend'

const TRANSFORM_KINDS: TransformKind[] = ['farm', 'ranch', 'school', 'park']

function hash01(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

export function rollDayMode(entity: CircleEntity): 'routine' | 'leisure' {
  const joyFactor = entity.joy / JOY_CAP
  const healthFactor = entity.health / HEALTH_CAP
  const leisureChance = Math.min(0.78, Math.max(0.12, 0.22 + joyFactor * 0.42 + (1 - healthFactor) * 0.18))
  const roll = hash01(entity.id * 17.3 + entity.dayNumber * 3.1)
  return roll < leisureChance ? 'leisure' : 'routine'
}

function rollActivePhase(entity: CircleEntity): 'work' | 'learn' | 'play' {
  if (entity.aiDayMode === 'leisure') return 'play'
  const massFactor = Math.min(1.2, entity.mass / (PLAYER_START_MASS * 2.5))
  const workChance = Math.min(0.72, 0.28 + massFactor * 0.28)
  const learnChance = Math.min(0.55, 0.22 + (1 - massFactor) * 0.3)
  const roll = hash01(entity.id * 5.7 + entity.dayNumber * 11.9 + entity.dayTimeSec)
  if (roll < workChance) return 'work'
  if (roll < workChance + learnChance) return 'learn'
  return 'play'
}

export function getDayPhase(entity: CircleEntity): NpcSchedulePhase {
  const t = ((entity.dayTimeSec % DAY_DURATION_SEC) + DAY_DURATION_SEC) % DAY_DURATION_SEC
  if (t < DAY_WORK_SEC) return rollActivePhase(entity)
  if (t < DAY_WORK_SEC + DAY_SLEEP_SEC) return 'sleep'
  return 'forage'
}

export function initNpcSchedule(entity: CircleEntity, dayOffsetSec = 0): void {
  entity.dayTimeSec = dayOffsetSec % DAY_DURATION_SEC
  entity.dayNumber = 0
  entity.aiDayMode = rollDayMode(entity)
  entity.transformHistory = []
  entity.aiPelletTargetId = 0
  entity.aiPelletTargetTimer = 0
  entity.aiAnchorX = entity.x
  entity.aiAnchorY = entity.y
  entity.aiAnchorTimer = 2 + (entity.id % 5)
  entity.aiSleeping = false
  entity.aiSchedulePhase = resolveNpcSchedulePhase(entity)
}

function resolveNpcSchedulePhase(entity: CircleEntity): NpcSchedulePhase {
  return getDayPhase(entity)
}

export function tickNpcDayClock(entity: CircleEntity, dt: number): void {
  const prevDay = entity.dayNumber
  entity.dayTimeSec += dt
  while (entity.dayTimeSec >= DAY_DURATION_SEC) {
    entity.dayTimeSec -= DAY_DURATION_SEC
    entity.dayNumber++
  }
  if (entity.dayNumber !== prevDay) {
    entity.aiDayMode = rollDayMode(entity)
  }
  entity.aiSchedulePhase = resolveNpcSchedulePhase(entity)
}

export function pickWeightedTransformKind(entity: CircleEntity): TransformKind {
  const last = entity.transformHistory[entity.transformHistory.length - 1]
  const weights = TRANSFORM_KINDS.map((kind) => {
    let w = 1
    if (kind === last) w *= TRANSFORM_REPEAT_PENALTY
    return w
  })
  const total = weights.reduce((a, b) => a + b, 0)
  let roll = hash01(entity.id * 2.17 + entity.dayNumber * 7.3 + entity.transformHistory.length * 1.9) * total
  for (let i = 0; i < TRANSFORM_KINDS.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return TRANSFORM_KINDS[i]
  }
  return TRANSFORM_KINDS[TRANSFORM_KINDS.length - 1]
}

export function decideNpcTransformKind(entity: CircleEntity, _entities: CircleEntity[]): TransformKind | null {
  if (entity.avatarTransformCooldown > 0) return null
  if (entity.aiSchedulePhase !== 'work') return null
  const tryChance = 0.55 + (entity.health / HEALTH_CAP) * 0.2
  if (hash01(entity.id + entity.dayTimeSec * 13) > tryChance) return null
  return pickWeightedTransformKind(entity)
}

export function recordTransformHistory(entity: CircleEntity, kind: TransformKind): void {
  entity.transformHistory.push(kind)
  if (entity.transformHistory.length > 12) {
    entity.transformHistory.splice(0, entity.transformHistory.length - 12)
  }
}

export function schedulePhaseLabel(entity: CircleEntity): string {
  const dayTag = entity.aiDayMode === 'leisure' ? '休闲日' : '常规日'
  switch (entity.aiSchedulePhase) {
    case 'work':
      return `${dayTag}·工作`
    case 'learn':
      return `${dayTag}·学习`
    case 'sleep':
      return `${dayTag}·休息`
    case 'forage':
      return `${dayTag}·觅食`
    case 'play':
      return `${dayTag}·娱乐`
    case 'weekend':
      return `${dayTag}·娱乐`
  }
}

function pickRestAnchor(entity: CircleEntity): void {
  const angle = (entity.id * 1.17) % (Math.PI * 2)
  const dist = 120 + (entity.id % 3) * 30
  entity.aiAnchorX = Math.max(80, Math.min(WORLD_WIDTH - 80, entity.x + Math.cos(angle) * dist))
  entity.aiAnchorY = Math.max(80, Math.min(WORLD_HEIGHT - 80, entity.y + Math.sin(angle) * dist))
  entity.aiAnchorTimer = 6 + (entity.id % 4)
}

function pelletKindForPhase(phase: NpcSchedulePhase): PelletKind | 'any' {
  if (phase === 'learn') return 'knowledge'
  if (phase === 'play') return 'joy'
  return 'food'
}

function moveToward(
  entity: CircleEntity,
  targetX: number,
  targetY: number,
  dt: number,
  speedMult = 1,
): void {
  const dx = targetX - entity.x
  const dy = targetY - entity.y
  const dist = Math.hypot(dx, dy)
  if (dist <= NPC_ARRIVE_DIST) return
  if (dist < NPC_JITTER_DIST) return
  const speed = speedForMass(entity.mass) * speedMult
  entity.x += (dx / dist) * speed * dt
  entity.y += (dy / dist) * speed * dt
  clampAvatarEntityToWorld(entity, WORLD_WIDTH, WORLD_HEIGHT)
}

function pickPelletTarget(
  entity: CircleEntity,
  entities: CircleEntity[],
  grid: PelletGrid,
  kind: PelletKind | 'any',
): { x: number; y: number; id: number } | null {
  if (entity.aiPelletTargetTimer > 0 && entity.aiPelletTargetId > 0) {
    const cached = grid.getById(entity.aiPelletTargetId)
    if (cached && (kind === 'any' || cached.kind === kind)) {
      return { x: cached.x, y: cached.y, id: cached.id }
    }
  }
  const candidates = grid.findNearestCandidates(entity.x, entity.y, 2200, 10, kind === 'any' ? undefined : kind)
  if (candidates.length === 0) return null
  let best = candidates[0]
  let bestScore = scorePelletTarget(entity, entities, best.x, best.y, best.id)
  for (let i = 1; i < candidates.length; i++) {
    const p = candidates[i]
    const score = scorePelletTarget(entity, entities, p.x, p.y, p.id)
    if (score > bestScore) {
      bestScore = score
      best = p
    }
  }
  entity.aiPelletTargetId = best.id
  entity.aiPelletTargetTimer = NPC_TARGET_CACHE_SEC
  return { x: best.x, y: best.y, id: best.id }
}

function scorePelletTarget(
  entity: CircleEntity,
  entities: CircleEntity[],
  px: number,
  py: number,
  pelletId: number,
): number {
  const dist = Math.hypot(px - entity.x, py - entity.y)
  let crowd = 0
  for (const other of entities) {
    if (other.id === entity.id || !isActive(other) || other.isPlayer) continue
    if (other.aiPelletTargetId === pelletId) crowd += 1.5
    const d = Math.hypot(other.x - px, other.y - py)
    if (d < 120) crowd += (120 - d) / 60
  }
  return -dist - crowd * 20 + (entity.id % 7) * 2
}

export function tickNpcTargetTimers(entity: CircleEntity, dt: number): void {
  entity.aiPelletTargetTimer = Math.max(0, entity.aiPelletTargetTimer - dt)
  entity.aiAnchorTimer = Math.max(0, entity.aiAnchorTimer - dt)
  if (entity.aiPelletTargetTimer <= 0) entity.aiPelletTargetId = 0
}

export function updateNpcIntent(
  entity: CircleEntity,
  entities: CircleEntity[],
  grid: PelletGrid,
  dt: number,
): { targetX: number; targetY: number; moving: boolean; sleeping: boolean } {
  tickNpcDayClock(entity, dt)
  tickNpcTargetTimers(entity, dt)
  const phase = entity.aiSchedulePhase
  entity.aiSleeping = phase === 'sleep'

  if (phase === 'sleep') {
    if (entity.aiAnchorTimer <= 0) pickRestAnchor(entity)
    moveToward(entity, entity.aiAnchorX, entity.aiAnchorY, dt, 0.12)
    return { targetX: entity.aiAnchorX, targetY: entity.aiAnchorY, moving: false, sleeping: true }
  }

  if (phase === 'play') {
    const pellet = pickPelletTarget(entity, entities, grid, 'joy')
    if (pellet) {
      moveToward(entity, pellet.x, pellet.y, dt, 0.7)
      return { targetX: pellet.x, targetY: pellet.y, moving: true, sleeping: false }
    }
    if (entity.aiAnchorTimer <= 0) pickRestAnchor(entity)
    moveToward(entity, entity.aiAnchorX, entity.aiAnchorY, dt, 0.45)
    return { targetX: entity.aiAnchorX, targetY: entity.aiAnchorY, moving: true, sleeping: false }
  }

  if (phase === 'learn') {
    const pellet = pickPelletTarget(entity, entities, grid, 'knowledge')
    if (pellet) {
      moveToward(entity, pellet.x, pellet.y, dt, 0.9)
      return { targetX: pellet.x, targetY: pellet.y, moving: true, sleeping: false }
    }
  }

  if (phase === 'forage' || phase === 'learn') {
    const kind = pelletKindForPhase(phase)
    const pellet = pickPelletTarget(entity, entities, grid, kind)
    if (pellet) {
      moveToward(entity, pellet.x, pellet.y, dt, 0.95)
      return { targetX: pellet.x, targetY: pellet.y, moving: true, sleeping: false }
    }
    if (entity.aiAnchorTimer <= 0) pickRestAnchor(entity)
    moveToward(entity, entity.aiAnchorX, entity.aiAnchorY, dt, 0.5)
    return { targetX: entity.aiAnchorX, targetY: entity.aiAnchorY, moving: true, sleeping: false }
  }

  return { targetX: entity.x, targetY: entity.y, moving: false, sleeping: false }
}
