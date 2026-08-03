import { NPC_ARRIVE_DIST, NPC_JITTER_DIST, NPC_TARGET_CACHE_SEC } from './avatar-config'
import { avatarEntityRadius } from './avatar-radius'
import { groupCohesionTarget } from './family'
import { pickWeightedNeed, pickWeightedTransformKind, type NeedKind } from './avatar-needs'
import { currentSchedulePhase, schedulePhaseLabel } from './avatar-schedule'
import {
  isActivelySeekingMate,
  isPursuingMate,
  updateMatePursuit,
} from './avatar-reproduction'
import { clampAvatarEntityToWorld } from './avatar-radius'
import { syncEntityGeo } from './geo'
import type { CircleEntity, TransformKind } from './entity'
import { isJuvenile } from './entity'
import type { PelletGrid } from './pellet-grid'
import type { PelletKind } from './pellet'
import { speedForMass } from './movement'
import { WORLD_HEIGHT, WORLD_WIDTH } from './world'

const PELLET_SEEK_RADIUS = Math.hypot(WORLD_WIDTH, WORLD_HEIGHT) * 0.95

function countStructures(entities: CircleEntity[]): { farm: number; school: number; park: number } {
  let farm = 0
  let school = 0
  let park = 0
  for (const e of entities) {
    if (e.avatarRole === 'farm') farm++
    if (e.avatarRole === 'school') school++
    if (e.avatarRole === 'park') park++
  }
  return { farm, school, park }
}

export function decideNpcTransformKind(
  entity: CircleEntity,
  entities: CircleEntity[],
  now = 0,
): TransformKind | null {
  if (isJuvenile(entity)) return null
  if (entity.avatarTransformCooldown > 0 || entity.productionStage !== 'none') return null
  if (isPursuingMate(entity, now)) return null
  return pickWeightedTransformKind(
    entity,
    countStructures(entities),
    entity.id * 2.11 + now * 0.23 + entity.transformHistory.length,
    now,
    entities,
  )
}

export function recordTransformHistory(entity: CircleEntity, kind: TransformKind): void {
  entity.transformHistory.push(kind)
  if (entity.transformHistory.length > 12) entity.transformHistory.splice(0, entity.transformHistory.length - 12)
}

export function intentLabel(
  entity: CircleEntity,
  gameTimeSec = 0,
): string {
  if (entity.productionStage === 'active') return '生产'
  if (entity.productionCooldown > 0) {
    return `冷却·${schedulePhaseLabel(currentSchedulePhase(entity, gameTimeSec))}`
  }

  if (isPursuingMate(entity, gameTimeSec)) return '奔赴·求偶'

  const seeking = isActivelySeekingMate(entity, gameTimeSec)
  const phase = currentSchedulePhase(entity, gameTimeSec, seeking)
  const base =
    phase === 'sleep'
      ? '睡觉'
      : phase === 'wander'
        ? '闲逛'
        : entity.aiIntent === 'eat'
          ? '觅食'
          : entity.aiIntent === 'learn'
            ? '吸收知识'
            : entity.aiIntent === 'play'
              ? '吸收快乐'
              : schedulePhaseLabel(phase)

  if (isJuvenile(entity)) return base
  if (seeking) return `求偶·${base}`
  return base
}

function pelletKindForNeed(need: NeedKind): PelletKind {
  if (need === 'learn') return 'knowledge'
  if (need === 'play') return 'joy'
  return 'food'
}

function moveToward(
  entity: CircleEntity,
  tx: number,
  ty: number,
  dt: number,
  mult = 1,
  arriveDist = NPC_ARRIVE_DIST,
): void {
  const dx = tx - entity.x
  const dy = ty - entity.y
  const dist = Math.hypot(dx, dy)
  if (dist <= arriveDist || dist < NPC_JITTER_DIST) return
  const speed = speedForMass(entity.mass) * mult
  entity.x += (dx / dist) * speed * dt
  entity.y += (dy / dist) * speed * dt
  clampAvatarEntityToWorld(entity, WORLD_WIDTH, WORLD_HEIGHT)
  syncEntityGeo(entity)
}

function wander(entity: CircleEntity, dt: number, entities: CircleEntity[] = [], seekingMate = false): void {
  const group = groupCohesionTarget(entity, entities, seekingMate)
  if (group) {
    moveToward(entity, group.x, group.y, dt, 0.62, avatarEntityRadius(entity) * 0.65)
    return
  }

  entity.wanderTimer -= dt
  if (entity.wanderTimer <= 0) {
    entity.wanderAngle += (Math.random() - 0.5) * (seekingMate ? 1.6 : 1.2)
    entity.wanderTimer = seekingMate ? 0.8 + Math.random() * 1.4 : 1.2 + Math.random() * 2
  }
  const speed = speedForMass(entity.mass) * (seekingMate ? 0.42 : 0.35)
  entity.x += Math.cos(entity.wanderAngle) * speed * dt
  entity.y += Math.sin(entity.wanderAngle) * speed * dt
  clampAvatarEntityToWorld(entity, WORLD_WIDTH, WORLD_HEIGHT)
  syncEntityGeo(entity)
}

function pickPelletTarget(
  entity: CircleEntity,
  grid: PelletGrid,
  kind: PelletKind,
): { x: number; y: number; id: number } | null {
  if (entity.aiPelletTargetTimer > 0 && entity.aiPelletTargetId > 0) {
    const cached = grid.getById(entity.aiPelletTargetId)
    if (cached && cached.kind === kind) return { x: cached.x, y: cached.y, id: cached.id }
  }
  const candidates = grid.findNearestCandidates(entity.x, entity.y, PELLET_SEEK_RADIUS, 10, kind)
  if (candidates.length === 0) return null
  entity.aiPelletTargetId = candidates[0].id
  entity.aiPelletTargetTimer = NPC_TARGET_CACHE_SEC
  return { x: candidates[0].x, y: candidates[0].y, id: candidates[0].id }
}

export function updateNpcIntent(
  entity: CircleEntity,
  entities: CircleEntity[],
  grid: PelletGrid,
  dt: number,
  now = 0,
): { moving: boolean; sleeping: boolean } {
  entity.aiPelletTargetTimer = Math.max(0, entity.aiPelletTargetTimer - dt)

  if (entity.productionStage === 'active') {
    return { moving: true, sleeping: false }
  }

  if (isPursuingMate(entity, now)) {
    entity.aiIntent = 'wander'
    updateMatePursuit(entity, entities, dt, now)
    return { moving: true, sleeping: false }
  }

  const seeking = isActivelySeekingMate(entity, now)
  const phase = currentSchedulePhase(entity, now, seeking)

  if (phase === 'sleep') {
    entity.aiIntent = 'sleep'
    return { moving: false, sleeping: true }
  }

  if (phase === 'wander') {
    entity.aiIntent = 'wander'
    wander(entity, dt, entities, seeking)
  } else if (phase === 'eat' || phase === 'learn' || phase === 'play') {
    entity.aiIntent = phase
  } else if (entity.aiPelletTargetTimer <= 0.05) {
    entity.aiIntent = pickWeightedNeed(entity, entity.id * 1.31 + Math.floor(now * 0.4))
  }

  const activeNeed = entity.aiIntent
  if (activeNeed === 'eat' || activeNeed === 'learn' || activeNeed === 'play') {
    const pellet = pickPelletTarget(entity, grid, pelletKindForNeed(activeNeed))
    if (pellet) {
      const absorbArrive = Math.max(8, avatarEntityRadius(entity) * 0.42)
      moveToward(entity, pellet.x, pellet.y, dt, 0.92, absorbArrive)
      return { moving: true, sleeping: false }
    }
    if (phase === 'wander') wander(entity, dt * 0.5, entities, seeking)
    return { moving: phase === 'wander', sleeping: false }
  }

  if (activeNeed === 'wander') {
    return { moving: true, sleeping: false }
  }

  return { moving: false, sleeping: false }
}
