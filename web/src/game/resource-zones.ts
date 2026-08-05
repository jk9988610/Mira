import {
  JOY_CAP,
  KNOWLEDGE_CAP,
  RESOURCE_ZONE_COUNT_FOOD,
  RESOURCE_ZONE_COUNT_JOY,
  RESOURCE_ZONE_COUNT_KNOWLEDGE,
  RESOURCE_ZONE_EFFECT_RATE,
  RESOURCE_ZONE_MAX_SIZE,
  RESOURCE_ZONE_MIN_SIZE,
  SATIETY_CAP,
} from './avatar-config'
import type { CircleEntity } from './entity'
import { isActive } from './entity'
import type { ViewBounds } from './viewport'
import { WORLD_HEIGHT, WORLD_WIDTH } from './world'

export type ZoneKind = 'food' | 'knowledge' | 'joy'

export interface ResourceZone {
  id: number
  kind: ZoneKind
  x: number
  y: number
  width: number
  height: number
}

let zones: ResourceZone[] = []
let zoneIdSeq = 1

function hash01(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function spawnZone(kind: ZoneKind, seed: number): ResourceZone {
  const w = RESOURCE_ZONE_MIN_SIZE + hash01(seed) * (RESOURCE_ZONE_MAX_SIZE - RESOURCE_ZONE_MIN_SIZE)
  const h = RESOURCE_ZONE_MIN_SIZE + hash01(seed + 1.7) * (RESOURCE_ZONE_MAX_SIZE - RESOURCE_ZONE_MIN_SIZE)
  const margin = 80
  const x = margin + hash01(seed + 3.1) * (WORLD_WIDTH - w - margin * 2)
  const y = margin + hash01(seed + 5.3) * (WORLD_HEIGHT - h - margin * 2)
  return { id: zoneIdSeq++, kind, x, y, width: w, height: h }
}

export function generateResourceZones(): ResourceZone[] {
  zones = []
  zoneIdSeq = 1
  let seed = 42
  for (let i = 0; i < RESOURCE_ZONE_COUNT_FOOD; i++) zones.push(spawnZone('food', seed++))
  for (let i = 0; i < RESOURCE_ZONE_COUNT_KNOWLEDGE; i++) zones.push(spawnZone('knowledge', seed++))
  for (let i = 0; i < RESOURCE_ZONE_COUNT_JOY; i++) zones.push(spawnZone('joy', seed++))
  return zones
}

export function getResourceZones(): ResourceZone[] {
  return zones
}

export function resetResourceZones(): void {
  zones = []
  zoneIdSeq = 1
}

export function pointInZone(zone: ResourceZone, x: number, y: number): boolean {
  return x >= zone.x && x <= zone.x + zone.width && y >= zone.y && y <= zone.y + zone.height
}

export function zonesAtPoint(x: number, y: number): ResourceZone[] {
  return zones.filter((z) => pointInZone(z, x, y))
}

export function tickResourceZones(entities: CircleEntity[], dt: number): void {
  if (zones.length === 0) return
  for (const entity of entities) {
    if (!isActive(entity) || entity.isFrozen) continue
    if (entity.avatarRole === 'farm' || entity.avatarRole === 'school' || entity.avatarRole === 'park' || entity.avatarRole === 'fortress') continue

    for (const zone of zones) {
      if (!pointInZone(zone, entity.x, entity.y)) continue
      const gain = RESOURCE_ZONE_EFFECT_RATE * dt
      if (zone.kind === 'food' && entity.satiety < SATIETY_CAP * 0.96) {
        entity.satiety = Math.min(SATIETY_CAP, entity.satiety + gain)
      } else if (zone.kind === 'knowledge' && entity.knowledge < KNOWLEDGE_CAP * 0.96) {
        entity.knowledge = Math.min(KNOWLEDGE_CAP, entity.knowledge + gain)
      } else if (zone.kind === 'joy' && entity.joy < JOY_CAP * 0.96) {
        entity.joy = Math.min(JOY_CAP, entity.joy + gain)
      }
    }
  }
}

const ZONE_COLORS: Record<ZoneKind, { fill: string; stroke: string }> = {
  food: { fill: 'rgba(140, 220, 150, 0.22)', stroke: 'rgba(120, 200, 130, 0.45)' },
  knowledge: { fill: 'rgba(190, 160, 235, 0.22)', stroke: 'rgba(170, 140, 220, 0.45)' },
  joy: { fill: 'rgba(150, 195, 255, 0.22)', stroke: 'rgba(130, 175, 240, 0.45)' },
}

export function drawResourceZones(
  ctx: CanvasRenderingContext2D,
  view: ViewBounds,
): void {
  for (const zone of zones) {
    if (zone.x + zone.width < view.minX || zone.x > view.maxX) continue
    if (zone.y + zone.height < view.minY || zone.y > view.maxY) continue
    const colors = ZONE_COLORS[zone.kind]
    ctx.fillStyle = colors.fill
    ctx.fillRect(zone.x, zone.y, zone.width, zone.height)
    ctx.strokeStyle = colors.stroke
    ctx.lineWidth = 1.5
    ctx.strokeRect(zone.x, zone.y, zone.width, zone.height)
  }
}
