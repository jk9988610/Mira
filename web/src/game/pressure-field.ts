import {
  JOY_CAP,
  PRESSURE_EMIT_RANGE_RATIO,
  PRESSURE_FAMILY_RELEASE_THRESHOLD,
  PRESSURE_RELIEF_JOY_WEIGHT,
  PRESSURE_RELIEF_MATING_ACTIVE,
  PRESSURE_RELIEF_MAX,
  PRESSURE_RELIEF_POST_MATE,
  PRESSURE_RELIEF_SATIETY_WEIGHT,
  PRODUCTION_COOLDOWN_SEC,
  SATIETY_CAP,
} from './avatar-config'
import type { CircleEntity } from './entity'
import { isActive } from './entity'
import { WORLD_WIDTH } from './world'

const PRESSURE_RANGE = WORLD_WIDTH * PRESSURE_EMIT_RANGE_RATIO

/** viewerFamily 是否将 targetFamily 视为敌对（因 target 家族压力总计过高） */
const hostileToTarget = new Map<number, Set<number>>()

const familyPressureTotals = new Map<number, number>()

export interface PressureFieldSummary {
  avgPressure: number
  maxHostile: number
  hostileFamilyPairs: number
}

function getFamilyId(entity: CircleEntity): number {
  return entity.familyId || entity.id
}

function distanceBetween(a: CircleEntity, b: CircleEntity): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** 饱食、快乐与交配可降低压力释放 */
export function computePressureRelief(entity: CircleEntity): number {
  const satietyRatio = Math.min(1, Math.max(0, entity.satiety / SATIETY_CAP))
  const joyRatio = Math.min(1, Math.max(0, entity.joy / JOY_CAP))
  let relief =
    satietyRatio * PRESSURE_RELIEF_SATIETY_WEIGHT + joyRatio * PRESSURE_RELIEF_JOY_WEIGHT
  if (entity.productionStage === 'active') {
    relief += PRESSURE_RELIEF_MATING_ACTIVE
  } else if (entity.productionCooldown > 0) {
    relief +=
      PRESSURE_RELIEF_POST_MATE * (entity.productionCooldown / PRODUCTION_COOLDOWN_SEC)
  }
  return Math.min(PRESSURE_RELIEF_MAX, relief)
}

/** 每个圆释放的压力 = 质量 × (1 - 减压系数) */
export function circlePressureEmit(entity: CircleEntity): number {
  const relief = computePressureRelief(entity)
  return Math.max(0, entity.mass * (1 - relief))
}

/** 隐藏压力辐射强度（二次衰减，类似求偶信号） */
export function pressureSignalStrength(emitter: CircleEntity, receiver: CircleEntity): number {
  const emit = circlePressureEmit(emitter)
  if (emit <= 0) return 0
  const dist = distanceBetween(emitter, receiver)
  if (dist > PRESSURE_RANGE) return 0
  const t = dist / PRESSURE_RANGE
  const decay = (1 - t) * (1 - t)
  return decay * emit * 0.0055
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

function groupActiveByFamily(entities: CircleEntity[]): Map<number, CircleEntity[]> {
  const byFamily = new Map<number, CircleEntity[]>()
  for (const entity of entities) {
    if (!isActive(entity)) continue
    const fid = getFamilyId(entity)
    let list = byFamily.get(fid)
    if (!list) {
      list = []
      byFamily.set(fid, list)
    }
    list.push(entity)
  }
  return byFamily
}

export function summarizePressureField(entities: CircleEntity[]): PressureFieldSummary {
  let totalPressure = 0
  let count = 0
  let maxHostile = 0
  for (const entity of entities) {
    if (!isActive(entity)) continue
    totalPressure += entity.pressureFelt
    if (entity.hostilePressureFelt > maxHostile) maxHostile = entity.hostilePressureFelt
    count++
  }
  let hostileFamilyPairs = 0
  for (const set of hostileToTarget.values()) {
    hostileFamilyPairs += set.size
  }
  return {
    avgPressure: count > 0 ? totalPressure / count : 0,
    maxHostile,
    hostileFamilyPairs,
  }
}

export function tickPressureField(entities: CircleEntity[], _dt: number): void {
  familyPressureTotals.clear()
  hostileToTarget.clear()

  const byFamily = groupActiveByFamily(entities)

  for (const [fid, members] of byFamily) {
    let total = 0
    for (const entity of members) {
      total += circlePressureEmit(entity)
    }
    familyPressureTotals.set(fid, total)
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

  for (const [myFid, myMembers] of byFamily) {
    for (const entity of myMembers) {
      let felt = 0
      let hostileFelt = 0
      for (const [otherFid, otherMembers] of byFamily) {
        if (otherFid === myFid) continue
        const hostile = isHostileToFamily(myFid, otherFid)
        for (const other of otherMembers) {
          const strength = pressureSignalStrength(other, entity)
          felt += strength
          if (hostile) hostileFelt += strength
        }
      }
      entity.pressureFelt = felt
      entity.hostilePressureFelt = hostileFelt
    }
  }
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
