import { PRESSURE_EMIT_RANGE_RATIO, PRESSURE_FAMILY_RELEASE_THRESHOLD } from './avatar-config'
import type { CircleEntity } from './entity'
import { isActive } from './entity'
import { WORLD_WIDTH } from './world'

const PRESSURE_RANGE = WORLD_WIDTH * PRESSURE_EMIT_RANGE_RATIO

/** viewerFamily 是否将 targetFamily 视为敌对（因 target 家族压力总计过高） */
const hostileToTarget = new Map<number, Set<number>>()

const familyPressureTotals = new Map<number, number>()

function getFamilyId(entity: CircleEntity): number {
  return entity.familyId || entity.id
}

function distanceBetween(a: CircleEntity, b: CircleEntity): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** 每个圆释放的压力等于其质量 */
export function circlePressureEmit(entity: CircleEntity): number {
  return Math.max(0, entity.mass)
}

/** 隐藏压力辐射强度（二次衰减，类似求偶信号） */
export function pressureSignalStrength(emitter: CircleEntity, receiver: CircleEntity): number {
  const emit = circlePressureEmit(emitter)
  if (emit <= 0) return 0
  const dist = distanceBetween(emitter, receiver)
  if (dist > PRESSURE_RANGE) return 0
  const t = dist / PRESSURE_RANGE
  const decay = (1 - t) * (1 - t)
  return decay * emit * 0.018
}

export function getFamilyPressureTotal(familyId: number): number {
  return familyPressureTotals.get(familyId) ?? 0
}

/** viewer 家族是否将 target 家族视为敌人 */
export function isHostileToFamily(viewerFamilyId: number, targetFamilyId: number): boolean {
  if (viewerFamilyId === targetFamilyId) return false
  return hostileToTarget.get(viewerFamilyId)?.has(targetFamilyId) ?? false
}

export function resetPressureField(): void {
  familyPressureTotals.clear()
  hostileToTarget.clear()
}

export function tickPressureField(entities: CircleEntity[], _dt: number): void {
  familyPressureTotals.clear()
  hostileToTarget.clear()

  for (const entity of entities) {
    if (!isActive(entity)) continue
    const fid = getFamilyId(entity)
    familyPressureTotals.set(fid, (familyPressureTotals.get(fid) ?? 0) + circlePressureEmit(entity))
  }

  for (const [fid, total] of familyPressureTotals) {
    if (total < PRESSURE_FAMILY_RELEASE_THRESHOLD) continue
    for (const viewerFid of familyPressureTotals.keys()) {
      if (viewerFid === fid) continue
      let set = hostileToTarget.get(viewerFid)
      if (!set) {
        set = new Set()
        hostileToTarget.set(viewerFid, set)
      }
      set.add(fid)
    }
  }

  for (const entity of entities) {
    if (!isActive(entity)) continue
    const myFid = getFamilyId(entity)
    let felt = 0
    let hostileFelt = 0
    for (const other of entities) {
      if (!isActive(other) || other.id === entity.id) continue
      const otherFid = getFamilyId(other)
      if (otherFid === myFid) continue
      const strength = pressureSignalStrength(other, entity)
      felt += strength
      if (isHostileToFamily(myFid, otherFid)) {
        hostileFelt += strength
      }
    }
    entity.pressureFelt = felt
    entity.hostilePressureFelt = hostileFelt
  }
}

export function maxHostilePressureInFamily(
  familyId: number,
  centerX: number,
  centerY: number,
  radius: number,
  entities: CircleEntity[],
): number {
  let max = 0
  for (const w of entities) {
    if (!isActive(w) || getFamilyId(w) !== familyId) continue
    if (Math.hypot(w.x - centerX, w.y - centerY) > radius) continue
    if (w.hostilePressureFelt > max) max = w.hostilePressureFelt
  }
  return max
}

export function findMostPressuredByHostiles(
  centerX: number,
  centerY: number,
  familyId: number,
  radius: number,
  entities: CircleEntity[],
): CircleEntity | null {
  let best: CircleEntity | null = null
  let bestPressure = -1
  for (const w of entities) {
    if (!isActive(w) || getFamilyId(w) !== familyId) continue
    if (Math.hypot(w.x - centerX, w.y - centerY) > radius) continue
    if (w.hostilePressureFelt > bestPressure) {
      bestPressure = w.hostilePressureFelt
      best = w
    }
  }
  return best
}
