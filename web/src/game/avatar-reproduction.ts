import {
  MATING_OVERLAP_SEC,
  PREGNANCY_SEC,
  PRODUCTION_ESCORT_MULT,
  SPAWN_CLEARANCE,
} from './avatar-config'
import { avatarEntityRadius, clampAvatarEntityToWorld } from './avatar-radius'
import { initAvatarVitality, onOffspringBorn } from './avatar-vitality'
import { inheritPalette } from './color-genetics'
import { syncEntityGeo } from './geo'
import { offspringName } from './naming'
import type { CircleEntity, Gender } from './entity'
import { createCircle, isActive, isAdult } from './entity'
import { PLAYER_START_MASS } from './physics'
import { WORLD_HEIGHT, WORLD_WIDTH } from './world'

function circlesOverlap(a: CircleEntity, b: CircleEntity): boolean {
  const dist = Math.hypot(a.x - b.x, a.y - b.y)
  return dist < avatarEntityRadius(a) + avatarEntityRadius(b) - 4
}

function hasProductionSpace(male: CircleEntity, female: CircleEntity, entities: CircleEntity[]): boolean {
  const cx = (male.x + female.x) / 2
  const cy = (male.y + female.y) / 2
  const needR = avatarEntityRadius(male) + avatarEntityRadius(female) + SPAWN_CLEARANCE * 2
  for (const other of entities) {
    if (other.id === male.id || other.id === female.id || !isActive(other)) continue
    if (other.avatarRole === 'work' || other.avatarRole === 'learn' || other.avatarRole === 'play') continue
    const d = Math.hypot(other.x - cx, other.y - cy)
    if (d < needR + avatarEntityRadius(other)) return false
  }
  return true
}

export function canStartProduction(
  male: CircleEntity,
  female: CircleEntity,
  entities: CircleEntity[],
): boolean {
  if (!isAdult(male) || !isAdult(female)) return false
  if (male.gender !== 'male' || female.gender !== 'female') return false
  if (male.productionStage !== 'none' || female.productionStage !== 'none') return false
  if (male.isFrozen || female.isFrozen) return false
  return hasProductionSpace(male, female, entities)
}

export function beginProductionPair(male: CircleEntity, female: CircleEntity): void {
  male.productionStage = 'mating'
  female.productionStage = 'mating'
  male.productionTimer = 0
  female.productionTimer = 0
  male.productionPartnerId = female.id
  female.productionPartnerId = male.id
  male.countProduceTransforms++
  female.countProduceTransforms++
  male.countProductionSessions++
  female.countProductionSessions++
}

function findPartner(entities: CircleEntity[], entity: CircleEntity): CircleEntity | null {
  const id = entity.productionPartnerId
  if (!id) return null
  return entities.find((e) => e.id === id && isActive(e)) ?? null
}

function spawnChild(
  entities: CircleEntity[],
  mother: CircleEntity,
  father: CircleEntity,
  birthGameTimeSec: number,
): CircleEntity[] {
  const gender: Gender = Math.random() < 0.5 ? 'male' : 'female'
  const childName = offspringName(father.name, mother.name, gender)
  const palette = inheritPalette(
    { colorLight: father.colorLight, colorDark: father.colorDark, strokeColor: father.strokeColor },
    { colorLight: mother.colorLight, colorDark: mother.colorDark, strokeColor: mother.strokeColor },
    mother.id * 1000 + father.id + Math.floor(birthGameTimeSec),
  )
  const roster = {
    name: childName,
    ...palette,
  }
  const angle = Math.random() * Math.PI * 2
  const dist = avatarEntityRadius(mother) + 40
  const child = createCircle(
    mother.x + Math.cos(angle) * dist,
    mother.y + Math.sin(angle) * dist,
    PLAYER_START_MASS,
    false,
    roster,
    {
      gender,
      generation: mother.generation + 1,
      motherId: mother.id,
      fatherId: father.id,
      familyId: mother.familyId || mother.id,
      birthGameTimeSec,
    },
  )
  child.avatarRole = 'ally'
  initAvatarVitality(child, birthGameTimeSec)
  clampAvatarEntityToWorld(child, WORLD_WIDTH, WORLD_HEIGHT)
  syncEntityGeo(child)
  mother.childrenCount++
  father.childrenCount++
  return [...entities, child]
}

function endProductionPair(male: CircleEntity, female: CircleEntity): void {
  for (const e of [male, female]) {
    e.productionStage = 'none'
    e.productionTimer = 0
    e.productionPartnerId = 0
    e.mateDrive = Math.max(0, e.mateDrive - 0.35)
  }
}

export function updateProductionPairs(
  entities: CircleEntity[],
  dt: number,
  birthGameTimeSec: number,
): CircleEntity[] {
  let next = entities
  const processed = new Set<number>()

  for (const entity of entities) {
    if (!isActive(entity) || entity.productionStage === 'none' || processed.has(entity.id)) continue
    const partner = findPartner(entities, entity)
    if (!partner) {
      entity.productionStage = 'none'
      entity.productionPartnerId = 0
      entity.productionTimer = 0
      continue
    }

    const male = entity.gender === 'male' ? entity : partner
    const female = entity.gender === 'female' ? entity : partner
    processed.add(male.id)
    processed.add(female.id)

    if (male.productionStage === 'mating') {
      if (circlesOverlap(male, female)) male.productionTimer += dt
      else male.productionTimer = Math.max(0, male.productionTimer - dt * 0.5)

      const escortDist = (avatarEntityRadius(male) + avatarEntityRadius(female)) * PRODUCTION_ESCORT_MULT
      const dx = female.x - male.x
      const dy = female.y - male.y
      const d = Math.hypot(dx, dy)
      if (d > escortDist * 0.5) {
        const speed = 120
        male.x += (dx / d) * speed * dt * 0.6
        male.y += (dy / d) * speed * dt * 0.6
        clampAvatarEntityToWorld(male, WORLD_WIDTH, WORLD_HEIGHT)
        syncEntityGeo(male)
      }

      if (male.productionTimer >= MATING_OVERLAP_SEC) {
        male.productionStage = 'pregnant'
        female.productionStage = 'pregnant'
        male.productionTimer = PREGNANCY_SEC
        female.productionTimer = PREGNANCY_SEC
      }
      continue
    }

    if (male.productionStage === 'pregnant') {
      const escortDist = (avatarEntityRadius(male) + avatarEntityRadius(female)) * PRODUCTION_ESCORT_MULT
      const dx = female.x - male.x
      const dy = female.y - male.y
      const d = Math.hypot(dx, dy)
      if (d > escortDist) {
        const speed = 140
        male.x += (dx / d) * speed * dt
        male.y += (dy / d) * speed * dt
        clampAvatarEntityToWorld(male, WORLD_WIDTH, WORLD_HEIGHT)
        syncEntityGeo(male)
      }

      male.productionTimer -= dt
      female.productionTimer -= dt
      if (male.productionTimer <= 0) {
        next = spawnChild(next, female, male, birthGameTimeSec)
        onOffspringBorn(male)
        onOffspringBorn(female)
        endProductionPair(male, female)
      }
    }
  }

  return next
}

export function tryPairProduction(
  seeker: CircleEntity,
  entities: CircleEntity[],
): CircleEntity | null {
  if (seeker.productionStage !== 'none' || !isAdult(seeker)) return null
  const wantFemale = seeker.gender === 'male'
  const wantMale = seeker.gender === 'female'
  if (!wantFemale && !wantMale) return null

  let best: CircleEntity | null = null
  let bestD = Infinity
  for (const other of entities) {
    if (other.id === seeker.id || !isActive(other) || other.isFrozen) continue
    if (other.productionStage !== 'none') continue
    if (wantFemale && other.gender !== 'female') continue
    if (wantMale && other.gender !== 'male') continue
    if (!isAdult(other)) continue
    if (!hasProductionSpace(wantFemale ? seeker : other, wantFemale ? other : seeker, entities)) continue
    const d = Math.hypot(other.x - seeker.x, other.y - seeker.y)
    if (d < bestD) {
      bestD = d
      best = other
    }
  }
  return best
}
