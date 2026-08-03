import { NPC_ARRIVE_DIST, NPC_JITTER_DIST, NPC_TARGET_CACHE_SEC } from './avatar-config'
import { pickWeightedNeed, pickWeightedTransformKind, type NeedKind } from './avatar-needs'
import { beginProductionPair, tryPairProduction } from './avatar-reproduction'
import { avatarEntityRadius, clampAvatarEntityToWorld } from './avatar-radius'
import { syncEntityGeo } from './geo'
import type { CircleEntity, TransformKind } from './entity'
import type { PelletGrid } from './pellet-grid'
import type { PelletKind } from './pellet'
import { speedForMass } from './movement'
import { WORLD_HEIGHT, WORLD_WIDTH } from './world'

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
  if (entity.avatarTransformCooldown > 0 || entity.productionStage !== 'none') return null
  return pickWeightedTransformKind(
    entity,
    countStructures(entities),
    entity.id * 2.11 + now * 0.23 + entity.transformHistory.length,
  )
}

export function recordTransformHistory(entity: CircleEntity, kind: TransformKind): void {
  entity.transformHistory.push(kind)
  if (entity.transformHistory.length > 12) entity.transformHistory.splice(0, entity.transformHistory.length - 12)
}

export function intentLabel(entity: CircleEntity): string {
  if (entity.productionStage === 'mating') return '生产·交配'
  if (entity.productionStage === 'pregnant') return entity.gender === 'female' ? '生产·怀孕' : '生产·陪护'
  const map: Record<NeedKind | 'idle', string> = {
    eat: '觅食',
    learn: '吸收知识',
    play: '吸收快乐',
    mate: '生产',
    idle: '闲逛',
  }
  return map[entity.aiIntent] ?? '闲逛'
}

function pelletKindForNeed(need: NeedKind): PelletKind {
  if (need === 'learn') return 'knowledge'
  if (need === 'play') return 'joy'
  return 'food'
}

function moveToward(entity: CircleEntity, tx: number, ty: number, dt: number, mult = 1): void {
  const dx = tx - entity.x
  const dy = ty - entity.y
  const dist = Math.hypot(dx, dy)
  if (dist <= NPC_ARRIVE_DIST || dist < NPC_JITTER_DIST) return
  const speed = speedForMass(entity.mass) * mult
  entity.x += (dx / dist) * speed * dt
  entity.y += (dy / dist) * speed * dt
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
  const candidates = grid.findNearestCandidates(entity.x, entity.y, 2200, 10, kind)
  if (candidates.length === 0) return null
  entity.aiPelletTargetId = candidates[0].id
  entity.aiPelletTargetTimer = NPC_TARGET_CACHE_SEC
  return { x: candidates[0].x, y: candidates[0].y, id: candidates[0].id }
}

function circlesTouch(a: CircleEntity, b: CircleEntity): boolean {
  const dist = Math.hypot(a.x - b.x, a.y - b.y)
  return dist < avatarEntityRadius(a) + avatarEntityRadius(b)
}

export function updateNpcIntent(
  entity: CircleEntity,
  entities: CircleEntity[],
  grid: PelletGrid,
  dt: number,
  now = 0,
): { moving: boolean; sleeping: boolean } {
  entity.aiPelletTargetTimer = Math.max(0, entity.aiPelletTargetTimer - dt)

  if (entity.productionStage !== 'none') {
    entity.aiIntent = 'mate'
    return { moving: true, sleeping: false }
  }

  if (entity.aiPelletTargetTimer <= 0.05) {
    entity.aiIntent = pickWeightedNeed(
      entity,
      entity.id * 1.31 + Math.floor(now * 0.4) + entity.transformHistory.length * 1.7,
    )
  }

  const need = entity.aiIntent

  if (need === 'mate') {
    const mate = tryPairProduction(entity, entities)
    if (mate) {
      const male = entity.gender === 'male' ? entity : mate
      const female = entity.gender === 'female' ? entity : mate
      if (circlesTouch(entity, mate)) beginProductionPair(male, female)
      else moveToward(entity, mate.x, mate.y, dt, 0.85)
      return { moving: true, sleeping: false }
    }
    entity.aiIntent = 'eat'
  }

  let activeNeed = entity.aiIntent
  if (activeNeed === 'idle') activeNeed = 'eat'

  if (activeNeed === 'eat' || activeNeed === 'learn' || activeNeed === 'play') {
    const pellet = pickPelletTarget(entity, grid, pelletKindForNeed(activeNeed))
    if (pellet) {
      moveToward(entity, pellet.x, pellet.y, dt, 0.95)
      return { moving: true, sleeping: false }
    }
  }

  return { moving: false, sleeping: false }
}
