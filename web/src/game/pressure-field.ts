import {
  PRESSURE_EMIT_RANGE_RATIO,
  PRESSURE_FAMILY_MEMBER_THRESHOLD,
  PRESSURE_FAMILY_RELEASE_THRESHOLD,
  PRESSURE_PER_MEMBER,
} from './avatar-config'
import type { CircleEntity } from './entity'
import { isActive } from './entity'
import { WORLD_WIDTH } from './world'

const PRESSURE_RANGE = WORLD_WIDTH * PRESSURE_EMIT_RANGE_RATIO

/** viewerFamily 是否将 targetFamily 视为敌对（因 target 释放过高压力） */
const hostileToTarget = new Map<number, Set<number>>()

function getFamilyId(entity: CircleEntity): number {
  return entity.familyId || entity.id
}

function distanceBetween(a: CircleEntity, b: CircleEntity): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** 隐藏压力辐射强度（二次衰减，类似求偶信号） */
export function pressureSignalStrength(
  emitter: CircleEntity,
  receiver: CircleEntity,
  familyPressure: number,
): number {
  if (familyPressure <= 0) return 0
  const dist = distanceBetween(emitter, receiver)
  if (dist > PRESSURE_RANGE) return 0
  const t = dist / PRESSURE_RANGE
  const decay = (1 - t) * (1 - t)
  return decay * familyPressure * 0.15
}

export function getFamilyPressureReleased(familyId: number): number {
  return familyPressureTotals.get(familyId) ?? 0
}

const familyPressureTotals = new Map<number, number>()

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
  const familyCounts = new Map<number, number>()
  for (const entity of entities) {
    if (!isActive(entity)) continue
    const fid = getFamilyId(entity)
    familyCounts.set(fid, (familyCounts.get(fid) ?? 0) + 1)
  }

  familyPressureTotals.clear()
  hostileToTarget.clear()

  for (const [fid, count] of familyCounts) {
    if (count <= PRESSURE_FAMILY_MEMBER_THRESHOLD) continue
    const excess = count - PRESSURE_FAMILY_MEMBER_THRESHOLD
    const released = excess * PRESSURE_PER_MEMBER * count
    familyPressureTotals.set(fid, released)

    if (released >= PRESSURE_FAMILY_RELEASE_THRESHOLD) {
      for (const viewerFid of familyCounts.keys()) {
        if (viewerFid === fid) continue
        let set = hostileToTarget.get(viewerFid)
        if (!set) {
          set = new Set()
          hostileToTarget.set(viewerFid, set)
        }
        set.add(fid)
      }
    }
  }

  for (const entity of entities) {
    if (!isActive(entity)) continue
    const myFid = getFamilyId(entity)
    let felt = 0
    for (const other of entities) {
      if (!isActive(other) || other.id === entity.id) continue
      const otherFid = getFamilyId(other)
      if (otherFid === myFid) continue
      const released = familyPressureTotals.get(otherFid) ?? 0
      felt += pressureSignalStrength(other, entity, released)
    }
    entity.pressureFelt = felt
  }
}
