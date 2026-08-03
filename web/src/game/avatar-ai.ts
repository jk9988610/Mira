import {
  DAY_DURATION_SEC,
  DAY_SLEEP_SEC,
  DAY_WORK_SEC,
  FARM_BUILD_COST,
  NPC_ARRIVE_DIST,
  NPC_SEPARATION_GAP,
  NPC_TARGET_CACHE_SEC,
  RANCH_BUILD_COST,
  RANCH_MOMENT_FARM_STREAK,
  WEEKDAY_COUNT,
} from './avatar-config'
import { avatarEntityRadius } from './avatar-radius'
import type { CircleEntity } from './entity'
import { clampEntityToWorld, isActive } from './entity'
import type { PelletGrid } from './pellet-grid'
import { speedForMass } from './movement'
import { WORLD_HEIGHT, WORLD_WIDTH } from './world'

export type NpcSchedulePhase = 'work' | 'sleep' | 'forage' | 'weekend'

export function isWeekend(dayNumber: number): boolean {
  return dayNumber % 7 >= WEEKDAY_COUNT
}

export function getDayPhase(dayTimeSec: number): 'work' | 'sleep' | 'forage' {
  const t = ((dayTimeSec % DAY_DURATION_SEC) + DAY_DURATION_SEC) % DAY_DURATION_SEC
  if (t < DAY_WORK_SEC) return 'work'
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
  if (isWeekend(entity.dayNumber)) return 'weekend'
  return getDayPhase(entity.dayTimeSec)
}

export function tickNpcDayClock(entity: CircleEntity, dt: number): void {
  entity.dayTimeSec += dt
  while (entity.dayTimeSec >= DAY_DURATION_SEC) {
    entity.dayTimeSec -= DAY_DURATION_SEC
    entity.dayNumber++
  }
  entity.aiSchedulePhase = resolveNpcSchedulePhase(entity)
}

/** 牧场时刻：根据工作经历决定下次化身类型 */
export function decideNpcTransformKind(
  entity: CircleEntity,
  _entities: CircleEntity[],
): 'farm' | 'ranch' | null {
  if (entity.avatarTransformCooldown > 0) return null
  if (entity.aiSchedulePhase !== 'work') return null

  const history = entity.transformHistory
  const last = history[history.length - 1]
  const recentFarms =
    history.length >= RANCH_MOMENT_FARM_STREAK &&
    history.slice(-RANCH_MOMENT_FARM_STREAK).every((k) => k === 'farm')

  let preferred: 'farm' | 'ranch'
  if (recentFarms) preferred = 'ranch'
  else if (last === 'ranch') preferred = 'farm'
  else if (last === 'farm') preferred = 'ranch'
  else preferred = entity.id % 2 === 0 ? 'ranch' : 'farm'

  const alt = preferred === 'farm' ? 'ranch' : 'farm'
  const canFarm = entity.mass >= FARM_BUILD_COST
  const canRanch = entity.mass >= RANCH_BUILD_COST

  if (preferred === 'farm' && canFarm) return 'farm'
  if (preferred === 'ranch' && canRanch) return 'ranch'
  if (alt === 'farm' && canFarm) return 'farm'
  if (alt === 'ranch' && canRanch) return 'ranch'
  return null
}

export function recordTransformHistory(entity: CircleEntity, kind: 'farm' | 'ranch'): void {
  entity.transformHistory.push(kind)
  if (entity.transformHistory.length > 12) {
    entity.transformHistory.splice(0, entity.transformHistory.length - 12)
  }
}

export function schedulePhaseLabel(entity: CircleEntity): string {
  switch (entity.aiSchedulePhase) {
    case 'work':
      return '工作日·化身'
    case 'sleep':
      return '工作日·睡眠'
    case 'forage':
      return '工作日·觅食'
    case 'weekend':
      return '周末·休息'
  }
}

function pickRestAnchor(entity: CircleEntity, entities: CircleEntity[]): void {
  let bestX = entity.x
  let bestY = entity.y
  let bestScore = -Infinity
  const samples = 10
  for (let i = 0; i < samples; i++) {
    const angle = (Math.PI * 2 * i) / samples + entity.id * 0.7
    const dist = 180 + (entity.id % 4) * 40
    const x = entity.x + Math.cos(angle) * dist
    const y = entity.y + Math.sin(angle) * dist
    const cx = Math.max(80, Math.min(WORLD_WIDTH - 80, x))
    const cy = Math.max(80, Math.min(WORLD_HEIGHT - 80, y))
    let score = 0
    for (const other of entities) {
      if (other.id === entity.id || !isActive(other)) continue
      const d = Math.hypot(other.x - cx, other.y - cy)
      score += Math.min(d, 400)
    }
    if (score > bestScore) {
      bestScore = score
      bestX = cx
      bestY = cy
    }
  }
  entity.aiAnchorX = bestX
  entity.aiAnchorY = bestY
  entity.aiAnchorTimer = 5 + (entity.id % 3) * 2
}

function applySeparation(entity: CircleEntity, entities: CircleEntity[], dt: number): void {
  let sx = 0
  let sy = 0
  const myR = avatarEntityRadius(entity)
  for (const other of entities) {
    if (other.id === entity.id || !isActive(other)) continue
    if (other.avatarRole === 'farm' || other.avatarRole === 'ranch') continue
    const dx = entity.x - other.x
    const dy = entity.y - other.y
    const dist = Math.hypot(dx, dy)
    const minDist = myR + avatarEntityRadius(other) + NPC_SEPARATION_GAP
    if (dist > 0 && dist < minDist) {
      const push = (minDist - dist) / minDist
      sx += (dx / dist) * push
      sy += (dy / dist) * push
    }
  }
  if (sx === 0 && sy === 0) return
  const len = Math.hypot(sx, sy)
  const speed = speedForMass(entity.mass) * 0.85
  entity.x += (sx / len) * speed * dt
  entity.y += (sy / len) * speed * dt
  clampEntityToWorld(entity, WORLD_WIDTH, WORLD_HEIGHT)
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
  const speed = speedForMass(entity.mass) * speedMult
  entity.x += (dx / dist) * speed * dt
  entity.y += (dy / dist) * speed * dt
  clampEntityToWorld(entity, WORLD_WIDTH, WORLD_HEIGHT)
}

function pickForagePellet(
  entity: CircleEntity,
  entities: CircleEntity[],
  grid: PelletGrid,
): { x: number; y: number; id: number } | null {
  if (entity.aiPelletTargetTimer > 0 && entity.aiPelletTargetId > 0) {
    const cached = grid.getById(entity.aiPelletTargetId)
    if (cached) return { x: cached.x, y: cached.y, id: cached.id }
  }

  const candidates = grid.findNearestCandidates(entity.x, entity.y, 2200, 8)
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
    if (other.aiPelletTargetId === pelletId) crowd += 2
    const d = Math.hypot(other.x - px, other.y - py)
    if (d < 160) crowd += (160 - d) / 40
  }
  return -dist - crowd * 35 + (entity.id % 7) * 3
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
  entity.aiSleeping = phase === 'sleep' || phase === 'weekend'

  if (phase === 'sleep' || phase === 'weekend') {
    if (entity.aiAnchorTimer <= 0) pickRestAnchor(entity, entities)
    moveToward(entity, entity.aiAnchorX, entity.aiAnchorY, dt, phase === 'weekend' ? 0.35 : 0.15)
    applySeparation(entity, entities, dt)
    return { targetX: entity.aiAnchorX, targetY: entity.aiAnchorY, moving: false, sleeping: true }
  }

  if (phase === 'forage') {
    const pellet = pickForagePellet(entity, entities, grid)
    if (pellet) {
      moveToward(entity, pellet.x, pellet.y, dt, 0.95)
      applySeparation(entity, entities, dt)
      return { targetX: pellet.x, targetY: pellet.y, moving: true, sleeping: false }
    }
    if (entity.aiAnchorTimer <= 0) pickRestAnchor(entity, entities)
    moveToward(entity, entity.aiAnchorX, entity.aiAnchorY, dt, 0.5)
    applySeparation(entity, entities, dt)
    return { targetX: entity.aiAnchorX, targetY: entity.aiAnchorY, moving: true, sleeping: false }
  }

  // work phase: movement handled by transform seek in avatar-system
  applySeparation(entity, entities, dt)
  return { targetX: entity.x, targetY: entity.y, moving: false, sleeping: false }
}
