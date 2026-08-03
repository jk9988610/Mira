import {
  NPC_ARRIVE_DIST,
  NPC_JITTER_DIST,
  NPC_TARGET_CACHE_SEC,
  WANDER_INTERVAL_MAX_SEC,
  WANDER_INTERVAL_MIN_SEC,
} from './avatar-config'
import { avatarEntityRadius } from './avatar-radius'
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
import { isActive, isJuvenile } from './entity'
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
  if (isJuvenile(entity, now)) return null
  if (entity.pendingAvatarKind !== 'none') return null
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
  if (entity.pendingAvatarKind !== 'none') {
    return entity.avatarTransformCooldown > 0 ? '等待·化身冷却' : '等待·化身'
  }
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

  if (isJuvenile(entity, gameTimeSec)) return base
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

function wander(entity: CircleEntity, dt: number, seekingMate = false): void {
  entity.wanderTimer -= dt
  if (entity.wanderTimer <= 0) {
    const angle = Math.random() * Math.PI * 2
    const newDirX = Math.cos(angle)
    const newDirY = Math.sin(angle)
    const blend = 0.38
    entity.wanderDirX = entity.wanderDirX * (1 - blend) + newDirX * blend
    entity.wanderDirY = entity.wanderDirY * (1 - blend) + newDirY * blend
    const len = Math.hypot(entity.wanderDirX, entity.wanderDirY) || 1
    entity.wanderDirX /= len
    entity.wanderDirY /= len
    const span = WANDER_INTERVAL_MAX_SEC - WANDER_INTERVAL_MIN_SEC
    entity.wanderTimer =
      WANDER_INTERVAL_MIN_SEC + Math.random() * span + (seekingMate ? 0.8 : 0)
  }

  const speed = speedForMass(entity.mass) * (seekingMate ? 0.42 : 0.35)
  entity.x += entity.wanderDirX * speed * dt
  entity.y += entity.wanderDirY * speed * dt
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
    entity.aiIntent = 'wait'
    return { moving: false, sleeping: false }
  }

  if (entity.motherBondTimer > 0) {
    entity.motherBondTimer = Math.max(0, entity.motherBondTimer - dt)
    const mother = entities.find((e) => e.id === entity.motherId && isActive(e))
    if (mother) {
      const dx = mother.x - entity.x
      const dy = mother.y - entity.y
      const dist = Math.hypot(dx, dy)
      const orbit = avatarEntityRadius(mother) + avatarEntityRadius(entity) + 26
      if (dist > orbit) {
        moveToward(entity, mother.x, mother.y, dt, 0.62, orbit)
      } else {
        wander(entity, dt * 0.4, false)
      }
      entity.aiIntent = 'wander'
      return { moving: true, sleeping: false }
    }
  }

  if (isPursuingMate(entity, now)) {
    entity.aiIntent = 'wander'
    updateMatePursuit(entity, entities, dt, now)
    return { moving: true, sleeping: false }
  }

  const juvenile = isJuvenile(entity, now)
  const seeking = isActivelySeekingMate(entity, now)
  let phase = currentSchedulePhase(entity, now, seeking)

  if (phase === 'sleep') {
    entity.aiIntent = 'sleep'
    return { moving: false, sleeping: true }
  }

  if (juvenile && phase === 'wander') {
    phase = 'eat'
  }

  if (phase === 'wander') {
    entity.aiIntent = 'wander'
    wander(entity, dt, seeking)
  } else if (phase === 'eat' || phase === 'learn' || phase === 'play') {
    entity.aiIntent = phase
  } else if (entity.aiPelletTargetTimer <= 0.05) {
    entity.aiIntent = pickWeightedNeed(entity, entity.id * 1.31 + Math.floor(now * 0.4), now)
  }

  const activeNeed = entity.aiIntent
  if (activeNeed === 'eat' || activeNeed === 'learn' || activeNeed === 'play') {
    const pellet = pickPelletTarget(entity, grid, pelletKindForNeed(activeNeed))
    if (pellet) {
      const absorbArrive = Math.max(8, avatarEntityRadius(entity) * 0.42)
      moveToward(entity, pellet.x, pellet.y, dt, 0.92, absorbArrive)
      return { moving: true, sleeping: false }
    }
    if (!juvenile && phase === 'wander') wander(entity, dt * 0.5, seeking)
    return { moving: !juvenile && phase === 'wander', sleeping: false }
  }

  if (activeNeed === 'wander') {
    return { moving: true, sleeping: false }
  }

  return { moving: false, sleeping: false }
}
