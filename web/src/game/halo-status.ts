import { isHostileToFamily } from './pressure-field'
import { fortressHaloStrength, isFortressEmitter } from './fortress-ray'
import { zonesAtPoint } from './resource-zones'
import {
  isEmitterBursting,
  isOrderServiceEmitter,
  isStructureEmitter,
  resourceRayStrength,
  roleToResourceKind,
  transformKindToResourceKind,
} from './resource-ray'
import type { CircleEntity } from './entity'
import { isActive } from './entity'

export type HaloKind =
  | 'food'
  | 'knowledge'
  | 'joy'
  | 'fortress_armor'
  | 'fortress_damage'
  | 'zone_food'
  | 'zone_knowledge'
  | 'zone_joy'

export interface ActiveHalo {
  kind: HaloKind
  label: string
  strength: number
}

const HALO_LABELS: Record<HaloKind, string> = {
  food: '农场光环',
  knowledge: '校园光环',
  joy: '乐园光环',
  fortress_armor: '堡垒护甲光环',
  fortress_damage: '堡垒伤害光环',
  zone_food: '食物地块光环',
  zone_knowledge: '知识地块光环',
  zone_joy: '快乐地块光环',
}

function getFamilyId(entity: CircleEntity): number {
  return entity.familyId || entity.id
}

function pushHalo(out: ActiveHalo[], kind: HaloKind, strength: number): void {
  if (strength <= 0.02) return
  const existing = out.find((h) => h.kind === kind)
  if (existing) {
    existing.strength = Math.max(existing.strength, strength)
    return
  }
  out.push({ kind, label: HALO_LABELS[kind], strength })
}

export function getActiveHalosOnEntity(
  entity: CircleEntity,
  entities: CircleEntity[],
): ActiveHalo[] {
  const halos: ActiveHalo[] = []
  if (!isActive(entity) || entity.isFrozen) return halos

  const myFamily = getFamilyId(entity)

  for (const emitter of entities) {
    if (!isEmitterBursting(emitter)) continue

    if (isStructureEmitter(emitter)) {
      const kind = roleToResourceKind(emitter.avatarRole)
      if (!kind) continue
      const strength = resourceRayStrength(emitter, entity, kind)
      pushHalo(halos, kind, strength)
      continue
    }

    if (isOrderServiceEmitter(emitter)) {
      const kind = transformKindToResourceKind(emitter.orderServiceKind as 'farm' | 'school' | 'park')
      const strength = resourceRayStrength(emitter, entity, kind)
      pushHalo(halos, kind, strength)
    }
  }

  for (const fortress of entities) {
    if (!isFortressEmitter(fortress)) continue
    const strength = fortressHaloStrength(fortress, entity)
    if (strength <= 0.02) continue
    const ownerFamily = getFamilyId(fortress)
    if (ownerFamily === myFamily) {
      pushHalo(halos, 'fortress_armor', strength)
    } else if (isHostileToFamily(ownerFamily, myFamily)) {
      pushHalo(halos, 'fortress_damage', strength)
    }
  }

  for (const zone of zonesAtPoint(entity.x, entity.y)) {
    if (zone.kind === 'food') pushHalo(halos, 'zone_food', 1)
    else if (zone.kind === 'knowledge') pushHalo(halos, 'zone_knowledge', 1)
    else pushHalo(halos, 'zone_joy', 1)
  }

  return halos
}

export function formatHaloList(halos: ActiveHalo[]): string {
  if (halos.length === 0) return '无光环'
  return halos.map((h) => h.label).join(' · ')
}
