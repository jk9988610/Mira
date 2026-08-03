import { NPC_ARRIVE_DIST, NPC_JITTER_DIST, NPC_TARGET_CACHE_SEC, TRANSFORM_REPEAT_PENALTY } from './avatar-config'
import { dominantNeed, type NeedKind } from './avatar-needs'
import { beginProductionPair, tryPairProduction } from './avatar-reproduction'
import { avatarEntityRadius, clampAvatarEntityToWorld } from './avatar-radius'
import { syncEntityGeo } from './geo'
import type { CircleEntity, TransformKind } from './entity'
import type { PelletGrid } from './pellet-grid'
import type { PelletKind } from './pellet'
import { speedForMass } from './movement'
import { WORLD_HEIGHT, WORLD_WIDTH } from './world'

const TRANSFORM_KINDS: TransformKind[] = ['work', 'learn', 'play']

function hash01(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

export function pickWeightedTransformKind(entity: CircleEntity): TransformKind {
  const last = entity.transformHistory[entity.transformHistory.length - 1]
  const weights = TRANSFORM_KINDS.map((kind) => (kind === last ? TRANSFORM_REPEAT_PENALTY : 1))
  const total = weights.reduce((a, b) => a + b, 0)
  let roll = hash01(entity.id * 2.17 + entity.transformHistory.length * 1.9) * total
  for (let i = 0; i < TRANSFORM_KINDS.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return TRANSFORM_KINDS[i]
  }
  return TRANSFORM_KINDS[0]
}

export function decideNpcTransformKind(entity: CircleEntity, _entities: CircleEntity[]): TransformKind | null {
  if (entity.avatarTransformCooldown > 0 || entity.productionStage !== 'none') return null
  const need = dominantNeed(entity)
  if (need === 'eat' || need === 'mate') return null
  if (need === 'learn') return 'learn'
  if (need === 'play') return 'play'
  if (need === 'work' && hash01(entity.id + entity.aiPelletTargetTimer) < 0.65) {
    return pickWeightedTransformKind(entity)
  }
  return null
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
    learn: '学习',
    play: '娱乐',
    mate: '生产',
    work: '上班',
    idle: '闲逛',
  }
  return map[entity.aiIntent] ?? '闲逛'
}

function pelletKindForNeed(need: NeedKind): PelletKind | 'any' {
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
  kind: PelletKind | 'any',
): { x: number; y: number; id: number } | null {
  if (entity.aiPelletTargetTimer > 0 && entity.aiPelletTargetId > 0) {
    const cached = grid.getById(entity.aiPelletTargetId)
    if (cached && (kind === 'any' || cached.kind === kind)) return { x: cached.x, y: cached.y, id: cached.id }
  }
  const candidates = grid.findNearestCandidates(entity.x, entity.y, 2200, 10, kind === 'any' ? undefined : kind)
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
): { moving: boolean; sleeping: boolean } {
  entity.aiPelletTargetTimer = Math.max(0, entity.aiPelletTargetTimer - dt)

  if (entity.productionStage !== 'none') {
    entity.aiIntent = 'mate'
    return { moving: true, sleeping: false }
  }

  const need = dominantNeed(entity)
  entity.aiIntent = need === 'work' ? 'work' : need

  if (need === 'mate') {
    const mate = tryPairProduction(entity, entities)
    if (mate) {
      const male = entity.gender === 'male' ? entity : mate
      const female = entity.gender === 'female' ? entity : mate
      if (circlesTouch(entity, mate)) beginProductionPair(male, female)
      else moveToward(entity, mate.x, mate.y, dt, 0.85)
      return { moving: true, sleeping: false }
    }
  }

  const pellet = pickPelletTarget(entity, grid, pelletKindForNeed(need))
  if (pellet && (need === 'eat' || need === 'learn' || need === 'play')) {
    moveToward(entity, pellet.x, pellet.y, dt, 0.95)
    return { moving: true, sleeping: false }
  }

  return { moving: false, sleeping: false }
}
