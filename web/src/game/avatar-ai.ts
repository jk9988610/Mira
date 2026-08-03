import {
  DAY_DURATION_SEC,
  DAY_SLEEP_SEC,
  DAY_WORK_SEC,
  FARM_BUILD_COST,
  NPC_ARRIVE_DIST,
  NPC_JITTER_DIST,
  NPC_TARGET_CACHE_SEC,
  PARK_BUILD_COST,
  PARK_UNLOCK_JOY,
  RANCH_BUILD_COST,
  RANCH_MOMENT_FARM_STREAK,
  SCHOOL_BUILD_COST,
  SCHOOL_UNLOCK_KNOWLEDGE,
  WEEKDAY_COUNT,
} from './avatar-config'
import { isAdultEntity } from './avatar-traits'
import { clampAvatarEntityToWorld } from './avatar-radius'
import type { CircleEntity, TransformKind } from './entity'
import { isActive } from './entity'
import type { PelletGrid } from './pellet-grid'
import type { PelletKind } from './pellet'
import { speedForMass } from './movement'
import { WORLD_HEIGHT, WORLD_WIDTH } from './world'

export type NpcSchedulePhase = 'work' | 'learn' | 'sleep' | 'forage' | 'play' | 'weekend'

export function isWeekend(dayNumber: number): boolean {
  return dayNumber % 7 >= WEEKDAY_COUNT
}

export function getDayPhase(entity: CircleEntity): 'work' | 'learn' | 'sleep' | 'forage' {
  const t = ((entity.dayTimeSec % DAY_DURATION_SEC) + DAY_DURATION_SEC) % DAY_DURATION_SEC
  if (t < DAY_WORK_SEC) return isAdultEntity(entity) ? 'work' : 'learn'
  if (t < DAY_WORK_SEC + DAY_SLEEP_SEC) return 'sleep'
  return 'forage'
}

export function initNpcSchedule(entity: CircleEntity, dayOffsetSec = 0): void {
  entity.dayTimeSec = dayOffsetSec % DAY_DURATION_SEC
  entity.dayNumber = 0
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
  if (isWeekend(entity.dayNumber)) return 'play'
  return getDayPhase(entity)
}

export function tickNpcDayClock(entity: CircleEntity, dt: number): void {
  entity.dayTimeSec += dt
  while (entity.dayTimeSec >= DAY_DURATION_SEC) {
    entity.dayTimeSec -= DAY_DURATION_SEC
    entity.dayNumber++
  }
  entity.aiSchedulePhase = resolveNpcSchedulePhase(entity)
}

function canTransformKind(entity: CircleEntity, kind: TransformKind): boolean {
  if (!isAdultEntity(entity)) return false
  if (entity.mass < buildCost(kind)) return false
  if (kind === 'school' && entity.knowledge < SCHOOL_UNLOCK_KNOWLEDGE) return false
  if (kind === 'park' && entity.joy < PARK_UNLOCK_JOY) return false
  return true
}

function buildCost(kind: TransformKind): number {
  switch (kind) {
    case 'farm':
      return FARM_BUILD_COST
    case 'ranch':
      return RANCH_BUILD_COST
    case 'school':
      return SCHOOL_BUILD_COST
    case 'park':
      return PARK_BUILD_COST
  }
}

/** 根据知识/快乐与工作经历决定化身 */
export function decideNpcTransformKind(
  entity: CircleEntity,
  _entities: CircleEntity[],
): TransformKind | null {
  if (entity.avatarTransformCooldown > 0) return null
  if (entity.aiSchedulePhase !== 'work') return null
  if (!isAdultEntity(entity)) return null

  const history = entity.transformHistory
  const last = history[history.length - 1]
  const recentFarms =
    history.length >= RANCH_MOMENT_FARM_STREAK &&
    history.slice(-RANCH_MOMENT_FARM_STREAK).every((k) => k === 'farm')

  const options: TransformKind[] = []
  if (entity.knowledge >= SCHOOL_UNLOCK_KNOWLEDGE && canTransformKind(entity, 'school')) options.push('school')
  if (entity.joy >= PARK_UNLOCK_JOY && canTransformKind(entity, 'park')) options.push('park')
  if (canTransformKind(entity, 'farm')) options.push('farm')
  if (canTransformKind(entity, 'ranch')) options.push('ranch')
  if (options.length === 0) return null

  if (recentFarms && options.includes('ranch')) return 'ranch'
  if (last === 'ranch' && options.includes('farm')) return 'farm'
  if (last === 'farm' && options.includes('ranch')) return 'ranch'
  if (entity.knowledge >= 0.7 && options.includes('school')) return 'school'
  if (entity.joy >= 0.7 && options.includes('park')) return 'park'
  if (entity.knowledge > entity.joy + 0.12 && options.includes('school')) return 'school'
  if (entity.joy > entity.knowledge + 0.12 && options.includes('park')) return 'park'

  return options[entity.id % options.length]
}

export function recordTransformHistory(entity: CircleEntity, kind: TransformKind): void {
  entity.transformHistory.push(kind)
  if (entity.transformHistory.length > 12) {
    entity.transformHistory.splice(0, entity.transformHistory.length - 12)
  }
}

export function schedulePhaseLabel(entity: CircleEntity): string {
  const juvenile = !isAdultEntity(entity)
  switch (entity.aiSchedulePhase) {
    case 'work':
      return '工作日·工作'
    case 'learn':
      return '未成年·学习'
    case 'sleep':
      return juvenile ? '未成年·休息' : '工作日·睡眠'
    case 'forage':
      return juvenile ? '未成年·觅食' : '工作日·觅食'
    case 'play':
      return '周末·娱乐'
    case 'weekend':
      return '周末·娱乐'
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

export { isAdultEntity }
