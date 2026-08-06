import {
  JOY_CAP,
  KNOWLEDGE_CAP,
  LOCAL_PRESSURE_ZONE_BIAS,
  RESOURCE_GRID_COLS,
  RESOURCE_GRID_ROWS,
  RESOURCE_ZONE_COUNT_FOOD,
  RESOURCE_ZONE_COUNT_JOY,
  RESOURCE_ZONE_COUNT_KNOWLEDGE,
  RESOURCE_ZONE_EFFECT_RATE,
  RESOURCE_ZONE_LIFETIME_SEC,
  SATIETY_CAP,
  ZONE_PREFER_MAX_DIST,
} from './avatar-config'
import type { CircleEntity } from './entity'
import { isActive } from './entity'
import type { NeedKind } from './avatar-needs'
import { pressureAtPoint } from './pressure-field'
import type { ViewBounds } from './viewport'
import { speedForMass } from './movement'
import { WORLD_HEIGHT, WORLD_WIDTH } from './world'

export type ZoneKind = 'food' | 'knowledge' | 'joy'

/** 各地块均提供三项资源，侧重点不同 */
const ZONE_EMPHASIS: Record<ZoneKind, { food: number; knowledge: number; joy: number }> = {
  food: { food: 1, knowledge: 0.28, joy: 0.28 },
  knowledge: { food: 0.28, knowledge: 1, joy: 0.28 },
  joy: { food: 0.28, knowledge: 0.28, joy: 1 },
}

const NEED_EMPHASIS_KEY: Record<NeedKind, keyof (typeof ZONE_EMPHASIS)['food']> = {
  eat: 'food',
  learn: 'knowledge',
  play: 'joy',
}

export interface ResourceZone {
  id: number
  kind: ZoneKind
  col: number
  row: number
  x: number
  y: number
  width: number
  height: number
  remainingSec: number
}

let zones: ResourceZone[] = []
let zoneIdSeq = 1

const CELL_WIDTH = WORLD_WIDTH / RESOURCE_GRID_COLS
const CELL_HEIGHT = WORLD_HEIGHT / RESOURCE_GRID_ROWS
const CELL_MARGIN = 6

function hash01(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function cellOrigin(col: number, row: number): { x: number; y: number } {
  return { x: col * CELL_WIDTH, y: row * CELL_HEIGHT }
}

function occupiedCells(): Set<string> {
  const set = new Set<string>()
  for (const zone of zones) set.add(`${zone.col},${zone.row}`)
  return set
}

function spawnZoneInCell(kind: ZoneKind, col: number, row: number, seed: number): ResourceZone {
  const origin = cellOrigin(col, row)
  const w = CELL_WIDTH - CELL_MARGIN * 2
  const h = CELL_HEIGHT - CELL_MARGIN * 2
  const jitterX = (hash01(seed) - 0.5) * CELL_MARGIN * 0.4
  const jitterY = (hash01(seed + 1.3) - 0.5) * CELL_MARGIN * 0.4
  return {
    id: zoneIdSeq++,
    kind,
    col,
    row,
    x: origin.x + CELL_MARGIN + jitterX,
    y: origin.y + CELL_MARGIN + jitterY,
    width: w,
    height: h,
    remainingSec: RESOURCE_ZONE_LIFETIME_SEC,
  }
}

function pickRandomEmptyCell(occupied: Set<string>, seed: number): { col: number; row: number } | null {
  const candidates: Array<{ col: number; row: number }> = []
  for (let row = 0; row < RESOURCE_GRID_ROWS; row++) {
    for (let col = 0; col < RESOURCE_GRID_COLS; col++) {
      if (!occupied.has(`${col},${row}`)) candidates.push({ col, row })
    }
  }
  if (candidates.length === 0) return null
  const idx = Math.floor(hash01(seed) * candidates.length) % candidates.length
  return candidates[idx]
}

function spawnZone(kind: ZoneKind, seed: number): ResourceZone | null {
  const occupied = occupiedCells()
  const cell = pickRandomEmptyCell(occupied, seed)
  if (!cell) return null
  return spawnZoneInCell(kind, cell.col, cell.row, seed)
}

function fillZoneQuota(kind: ZoneKind, targetCount: number, seedBase: number): void {
  let current = zones.filter((z) => z.kind === kind).length
  let seed = seedBase
  while (current < targetCount) {
    const zone = spawnZone(kind, seed++)
    if (!zone) break
    zones.push(zone)
    current++
  }
}

export function generateResourceZones(): ResourceZone[] {
  zones = []
  zoneIdSeq = 1
  let seed = 42
  fillZoneQuota('food', RESOURCE_ZONE_COUNT_FOOD, seed)
  seed += 20
  fillZoneQuota('knowledge', RESOURCE_ZONE_COUNT_KNOWLEDGE, seed)
  seed += 20
  fillZoneQuota('joy', RESOURCE_ZONE_COUNT_JOY, seed)
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

export function zoneCenter(zone: ResourceZone): { x: number; y: number } {
  return { x: zone.x + zone.width * 0.5, y: zone.y + zone.height * 0.5 }
}

export function findNearestActiveZone(
  kind: ZoneKind,
  x: number,
  y: number,
): { zone: ResourceZone; dist: number; cx: number; cy: number } | null {
  let best: { zone: ResourceZone; dist: number; cx: number; cy: number } | null = null
  for (const zone of zones) {
    if (zone.kind !== kind) continue
    const center = zoneCenter(zone)
    const dist = Math.hypot(center.x - x, center.y - y)
    if (!best || dist < best.dist) {
      best = { zone, dist, cx: center.x, cy: center.y }
    }
  }
  return best
}

/** 按需求、距离与局部压力综合选择地块 */
export function findBestZoneForNeed(
  need: NeedKind,
  entity: CircleEntity,
  entities: CircleEntity[],
): { zone: ResourceZone; dist: number; cx: number; cy: number } | null {
  const emphasisKey = NEED_EMPHASIS_KEY[need]
  const familyId = entity.familyId || entity.id
  let best: { zone: ResourceZone; dist: number; cx: number; cy: number; score: number } | null = null

  for (const zone of zones) {
    const center = zoneCenter(zone)
    const dist = Math.hypot(center.x - entity.x, center.y - entity.y)
    if (dist > ZONE_PREFER_MAX_DIST) continue

    const localPressure = pressureAtPoint(center.x, center.y, entities, familyId)
    const currentPressure = entity.pressureFelt
    const pressureRelief = Math.max(0, currentPressure - localPressure)
    const emphasis = ZONE_EMPHASIS[zone.kind][emphasisKey]
    const score =
      emphasis * 120 +
      pressureRelief * LOCAL_PRESSURE_ZONE_BIAS +
      dist * -0.35 -
      localPressure * LOCAL_PRESSURE_ZONE_BIAS * 0.6

    if (!best || score > best.score) {
      best = { zone, dist, cx: center.x, cy: center.y, score }
    }
  }

  return best ? { zone: best.zone, dist: best.dist, cx: best.cx, cy: best.cy } : null
}

export function estimateZoneTravelSec(
  fromX: number,
  fromY: number,
  zone: ResourceZone,
  mass: number,
): number {
  const center = zoneCenter(zone)
  const dist = Math.hypot(center.x - fromX, center.y - fromY)
  return dist / Math.max(18, speedForMass(mass))
}

function respawnZone(zone: ResourceZone, seed: number): void {
  const occupied = occupiedCells()
  occupied.delete(`${zone.col},${zone.row}`)
  const cell = pickRandomEmptyCell(occupied, seed)
  if (!cell) {
    zones = zones.filter((z) => z.id !== zone.id)
    return
  }
  const next = spawnZoneInCell(zone.kind, cell.col, cell.row, seed)
  zone.col = next.col
  zone.row = next.row
  zone.x = next.x
  zone.y = next.y
  zone.width = next.width
  zone.height = next.height
  zone.remainingSec = RESOURCE_ZONE_LIFETIME_SEC
}

export function tickResourceZones(entities: CircleEntity[], dt: number): void {
  if (zones.length === 0) return

  let respawnSeed = Math.floor(entities.length * 17.3 + dt * 1000) % 10000
  for (const zone of zones) {
    zone.remainingSec -= dt
    if (zone.remainingSec <= 0) {
      respawnZone(zone, respawnSeed++)
    }
  }

  for (const entity of entities) {
    if (!isActive(entity) || entity.isFrozen) continue
    if (
      entity.avatarRole === 'farm' ||
      entity.avatarRole === 'school' ||
      entity.avatarRole === 'park' ||
      entity.avatarRole === 'fortress'
    )
      continue

    for (const zone of zones) {
      if (!pointInZone(zone, entity.x, entity.y)) continue
      const gain = RESOURCE_ZONE_EFFECT_RATE * dt
      const emphasis = ZONE_EMPHASIS[zone.kind]
      if (entity.satiety < SATIETY_CAP * 0.96) {
        entity.satiety = Math.min(SATIETY_CAP, entity.satiety + gain * emphasis.food)
      }
      if (entity.knowledge < KNOWLEDGE_CAP * 0.96) {
        entity.knowledge = Math.min(KNOWLEDGE_CAP, entity.knowledge + gain * emphasis.knowledge)
      }
      if (entity.joy < JOY_CAP * 0.96) {
        entity.joy = Math.min(JOY_CAP, entity.joy + gain * emphasis.joy)
      }
    }
  }
}

const ZONE_COLORS: Record<ZoneKind, { fill: string; stroke: string }> = {
  food: { fill: 'rgba(140, 220, 150, 0.22)', stroke: 'rgba(120, 200, 130, 0.45)' },
  knowledge: { fill: 'rgba(190, 160, 235, 0.22)', stroke: 'rgba(170, 140, 220, 0.45)' },
  joy: { fill: 'rgba(150, 195, 255, 0.22)', stroke: 'rgba(130, 175, 240, 0.45)' },
}

export function drawResourceZones(ctx: CanvasRenderingContext2D, view: ViewBounds): void {
  for (const zone of zones) {
    if (zone.x + zone.width < view.minX || zone.x > view.maxX) continue
    if (zone.y + zone.height < view.minY || zone.y > view.maxY) continue
    const fade = Math.max(0.35, Math.min(1, zone.remainingSec / RESOURCE_ZONE_LIFETIME_SEC))
    const colors = ZONE_COLORS[zone.kind]
    ctx.fillStyle = colors.fill.replace('0.22', (0.22 * fade).toFixed(2))
    ctx.fillRect(zone.x, zone.y, zone.width, zone.height)
    ctx.strokeStyle = colors.stroke.replace('0.45', (0.45 * fade).toFixed(2))
    ctx.lineWidth = 1.5
    ctx.strokeRect(zone.x, zone.y, zone.width, zone.height)
  }
}
