import {
  FAMILY_NEED_POST_THRESHOLD,
  FAMILY_SHARE_OF_REWARD,
  HOSTILE_PRESSURE_ORDER_THRESHOLD,
  INITIAL_FAMILY_FUNDS,
  KNOWLEDGE_CAP,
  JOY_CAP,
  MAX_ACTIVE_ORDERS_PER_FAMILY,
  MAX_ORDER_HISTORY,
  ORDER_FULFILL_RADIUS,
  ORDER_POST_COOLDOWN_SEC,
  ORDER_POST_COST,
  ORDER_REWARD,
  ORDER_SERVICE_DURATION_SEC,
  SATIETY_CAP,
  ZONE_PREFER_MAX_DIST,
} from './avatar-config'
import { isPractitioner, registerPractitioner } from './avatar-practitioner'
import type { CircleEntity, TransformKind } from './entity'
import { entityAgeSec, isActive, isAdult } from './entity'
import {
  getEntityHouseholdFunds,
  hasHousehold,
  withdrawHousehold,
  depositHousehold,
} from './household'
import { speedForMass } from './movement'
import { findBestZoneForNeed } from './resource-zones'
import { WORLD_HEIGHT, WORLD_WIDTH } from './world'

export type OrderStatus = 'open' | 'assigned' | 'fulfilled' | 'cancelled'

export const ORDER_DEMAND_LABEL: Record<TransformKind, string> = {
  farm: '食物服务',
  school: '知识服务',
  park: '快乐服务',
  fortress: '堡垒防御',
}

export interface MarketOrder {
  id: number
  familyId: number
  kind: TransformKind
  x: number
  y: number
  reward: number
  cost: number
  postedAt: number
  status: OrderStatus
  posterId: number
  contractorId?: number
  completedAt?: number
  /** 接单人当前位置（每帧更新） */
  contractorX?: number
  contractorY?: number
  /** 预计到达并发服务还需秒数 */
  contractorEtaSec?: number
}

export interface FamilyMarketRecord {
  familyId: number
  funds: number
  chiefId: number
  chiefName: string
  orders: MarketOrder[]
  enrollmentBoostKind: TransformKind | 'none'
  totalPosted: number
  totalFulfilled: number
}

let orderIdSeq = 1
const familyMarkets = new Map<number, FamilyMarketRecord>()
const ORDER_WORLD_INSET = 72

function clampOrderPoint(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(ORDER_WORLD_INSET, Math.min(WORLD_WIDTH - ORDER_WORLD_INSET, x)),
    y: Math.max(ORDER_WORLD_INSET, Math.min(WORLD_HEIGHT - ORDER_WORLD_INSET, y)),
  }
}

function getFamilyId(entity: CircleEntity): number {
  return entity.familyId || entity.id
}

function isInAvatarState(entity: CircleEntity): boolean {
  return (
    entity.isFrozen ||
    entity.avatarRole === 'farm' ||
    entity.avatarRole === 'school' ||
    entity.avatarRole === 'park' ||
    entity.avatarRole === 'fortress'
  )
}

function chiefScore(w: CircleEntity, gameTimeSec: number): number {
  if (w.gender !== 'male' || !isAdult(w, gameTimeSec)) return -1
  return entityAgeSec(w, gameTimeSec)
}

function electChief(familyId: number, entities: CircleEntity[], gameTimeSec: number): void {
  const rec = familyMarkets.get(familyId)
  if (!rec) return
  let best: CircleEntity | null = null
  let bestScore = -1
  for (const w of entities) {
    if (!isActive(w) || getFamilyId(w) !== familyId) continue
    const s = chiefScore(w, gameTimeSec)
    if (s > bestScore) {
      bestScore = s
      best = w
    }
  }
  if (best) {
    rec.chiefId = best.id
    rec.chiefName = best.name
  } else {
    rec.chiefId = 0
    rec.chiefName = '—'
  }
}

function countFamilyPractitioners(
  familyId: number,
  kind: TransformKind,
  entities: CircleEntity[],
): number {
  let count = 0
  for (const w of entities) {
    if (!isActive(w) || getFamilyId(w) !== familyId) continue
    if (isPractitioner(w, kind)) count++
  }
  return count
}

function setEnrollmentBoost(rec: FamilyMarketRecord, kind: TransformKind): void {
  rec.enrollmentBoostKind = kind
}

function countActiveOrders(rec: FamilyMarketRecord): number {
  return rec.orders.filter((o) => o.status === 'open' || o.status === 'assigned').length
}

function posterHasActiveOrder(rec: FamilyMarketRecord, posterId: number): boolean {
  return rec.orders.some(
    (o) => o.posterId === posterId && (o.status === 'open' || o.status === 'assigned'),
  )
}

function isIdlePractitioner(
  w: CircleEntity,
  kind: TransformKind,
  gameTimeSec: number,
): boolean {
  if (!isActive(w) || !isAdult(w, gameTimeSec)) return false
  if (!hasHousehold(w)) return false
  if (kind === 'fortress' && !isPractitioner(w, 'fortress')) return false
  if (isInAvatarState(w)) return false
  if (w.productionStage !== 'none') return false
  if (w.marketContractOrderId > 0 || w.pendingAvatarKind !== 'none') return false
  if (w.orderServiceTimer > 0) return false
  return true
}

function shouldPreferZoneOverOrder(
  member: CircleEntity,
  kind: TransformKind,
  entities: CircleEntity[],
): boolean {
  if (kind === 'fortress') return false
  const need = kind === 'farm' ? 'eat' : kind === 'school' ? 'learn' : 'play'
  const hit = findBestZoneForNeed(need, member, entities)
  if (!hit) return false
  return hit.dist <= ZONE_PREFER_MAX_DIST
}

export function estimateContractTravelSec(
  workerX: number,
  workerY: number,
  targetX: number,
  targetY: number,
  mass: number,
): number {
  const arriveDist = Math.max(12, ORDER_FULFILL_RADIUS * 0.45)
  const dist = Math.hypot(targetX - workerX, targetY - workerY)
  const travelDist = Math.max(0, dist - arriveDist)
  const speed = Math.max(18, speedForMass(mass))
  return travelDist / speed
}

function postOrder(
  rec: FamilyMarketRecord,
  poster: CircleEntity,
  kind: TransformKind,
  anchorX: number,
  anchorY: number,
  gameTimeSec: number,
): void {
  const anchor = clampOrderPoint(anchorX, anchorY)
  if (!hasHousehold(poster)) return
  if (!withdrawHousehold(poster.householdId, ORDER_POST_COST)) return
  poster.selfOrderPostCooldownUntil = gameTimeSec + ORDER_POST_COOLDOWN_SEC

  const order: MarketOrder = {
    id: orderIdSeq++,
    familyId: rec.familyId,
    kind,
    x: anchor.x,
    y: anchor.y,
    reward: ORDER_REWARD,
    cost: ORDER_POST_COST,
    postedAt: gameTimeSec,
    status: 'open',
    posterId: poster.id,
  }
  rec.orders.unshift(order)
  if (rec.orders.length > MAX_ORDER_HISTORY) rec.orders.length = MAX_ORDER_HISTORY
  rec.totalPosted++
}

function detectSelfOrderKind(member: CircleEntity): TransformKind | null {
  if (member.hostilePressureFelt >= HOSTILE_PRESSURE_ORDER_THRESHOLD) return 'fortress'

  const foodNeed = 1 - member.satiety / SATIETY_CAP
  const knowledgeNeed = 1 - member.knowledge / KNOWLEDGE_CAP
  const joyNeed = 1 - member.joy / JOY_CAP

  let kind: TransformKind | null = null
  let bestNeed = FAMILY_NEED_POST_THRESHOLD
  if (foodNeed > bestNeed) {
    kind = 'farm'
    bestNeed = foodNeed
  }
  if (knowledgeNeed > bestNeed) {
    kind = 'school'
    bestNeed = knowledgeNeed
  }
  if (joyNeed > bestNeed) {
    kind = 'park'
    bestNeed = joyNeed
  }
  return kind
}

function trySelfPostOrder(
  member: CircleEntity,
  rec: FamilyMarketRecord,
  entities: CircleEntity[],
  gameTimeSec: number,
): void {
  if (!isActive(member) || !isAdult(member, gameTimeSec)) return
  if (!hasHousehold(member)) return
  if (member.marketContractOrderId > 0 || member.orderServiceTimer > 0) return
  if (posterHasActiveOrder(rec, member.id)) return
  if (countActiveOrders(rec) >= MAX_ACTIVE_ORDERS_PER_FAMILY) return
  if (gameTimeSec < member.selfOrderPostCooldownUntil) return
  if (getEntityHouseholdFunds(member) < ORDER_POST_COST) return

  const kind = detectSelfOrderKind(member)
  if (!kind) return
  if (shouldPreferZoneOverOrder(member, kind, entities)) return

  setEnrollmentBoost(rec, kind)
  if (countFamilyPractitioners(rec.familyId, kind, entities) === 0) {
    setEnrollmentBoost(rec, kind)
  }
  postOrder(rec, member, kind, member.x, member.y, gameTimeSec)
}

function tickSelfPostedOrders(
  rec: FamilyMarketRecord,
  entities: CircleEntity[],
  gameTimeSec: number,
): void {
  for (const member of entities) {
    if (!isActive(member) || getFamilyId(member) !== rec.familyId) continue
    trySelfPostOrder(member, rec, entities, gameTimeSec)
  }
}

function tryAssignContractors(rec: FamilyMarketRecord, entities: CircleEntity[], gameTimeSec: number): void {
  const openOrders = rec.orders
    .filter((o) => o.status === 'open')
    .sort((a, b) => a.postedAt - b.postedAt)

  for (const order of openOrders) {
    let bestWorker: CircleEntity | null = null
    let bestDist = Infinity
    for (const w of entities) {
      if (!isActive(w)) continue
      if (!isIdlePractitioner(w, order.kind, gameTimeSec)) continue
      const dist = Math.hypot(w.x - order.x, w.y - order.y)
      if (dist < bestDist) {
        bestDist = dist
        bestWorker = w
      }
    }
    if (!bestWorker) {
      setEnrollmentBoost(rec, order.kind)
      continue
    }

    order.status = 'assigned'
    order.contractorId = bestWorker.id
    order.contractorX = bestWorker.x
    order.contractorY = bestWorker.y
    if (!isPractitioner(bestWorker, order.kind)) {
      registerPractitioner(bestWorker, order.kind)
    }
    bestWorker.marketContractOrderId = order.id
    bestWorker.contractTargetX = order.x
    bestWorker.contractTargetY = order.y
    updateOrderContractorTelemetry(order, entities)
  }
}

export function updateOrderContractorTelemetry(order: MarketOrder, entities: CircleEntity[]): void {
  if (order.status !== 'assigned' || !order.contractorId) {
    order.contractorX = undefined
    order.contractorY = undefined
    order.contractorEtaSec = undefined
    return
  }
  const worker = entities.find((w) => w.id === order.contractorId && isActive(w))
  if (!worker) return

  order.contractorX = worker.x
  order.contractorY = worker.y

  if (worker.orderServiceTimer > 0) {
    order.contractorEtaSec = worker.orderServiceTimer
    return
  }

  const dist = Math.hypot(order.x - worker.x, order.y - worker.y)
  const arriveDist = Math.max(12, ORDER_FULFILL_RADIUS * 0.45)
  if (dist <= arriveDist) {
    order.contractorEtaSec = ORDER_SERVICE_DURATION_SEC
    return
  }
  const travelSec = estimateContractTravelSec(worker.x, worker.y, order.x, order.y, worker.mass)
  order.contractorEtaSec = travelSec + ORDER_SERVICE_DURATION_SEC
}

export function getOpenQueuePosition(order: MarketOrder, rec: FamilyMarketRecord): number {
  const open = rec.orders
    .filter((o) => o.status === 'open')
    .sort((a, b) => a.postedAt - b.postedAt)
  const idx = open.findIndex((o) => o.id === order.id)
  return idx >= 0 ? idx + 1 : 0
}

export function formatOrderDetailLine(
  order: MarketOrder,
  rec: FamilyMarketRecord,
  gameTimeSec: number,
  entities: CircleEntity[],
): string {
  updateOrderContractorTelemetry(order, entities)
  const waitSec = Math.max(0, gameTimeSec - order.postedAt)
  const kindLabel = ORDER_DEMAND_LABEL[order.kind]

  const orderAddr = `下单@(${Math.round(order.x)},${Math.round(order.y)})`

  if (order.status === 'fulfilled') {
    return `#${order.id} ${kindLabel} · ${orderAddr} · 已完成 · 已等${waitSec}s`
  }

  if (order.status === 'open') {
    const queuePos = getOpenQueuePosition(order, rec)
    const openCount = rec.orders.filter((o) => o.status === 'open').length
    return `#${order.id} ${kindLabel} · ${orderAddr} · 排队${queuePos}/${openCount} · 已等${waitSec}s · 待接单`
  }

  if (order.status === 'assigned') {
    const cx = order.contractorX !== undefined ? Math.round(order.contractorX) : '?'
    const cy = order.contractorY !== undefined ? Math.round(order.contractorY) : '?'
    const distToTarget =
      order.contractorX !== undefined && order.contractorY !== undefined
        ? Math.round(Math.hypot(order.x - order.contractorX, order.y - order.contractorY))
        : '?'
    const eta =
      order.contractorEtaSec !== undefined ? `${order.contractorEtaSec.toFixed(1)}s` : '—'
    return `#${order.id} ${kindLabel} · ${orderAddr} · 已接单 · 接单人@(${cx},${cy}) · 距目标${distToTarget} · 约${eta}到达 · 已等${waitSec}s`
  }

  return `#${order.id} ${kindLabel} · 已取消`
}

export function initFamilyMarkets(entities: CircleEntity[]): void {
  familyMarkets.clear()
  orderIdSeq = 1
  for (const w of entities) {
    if (w.motherId !== 0 || w.fatherId !== 0) continue
    const fid = getFamilyId(w)
    if (familyMarkets.has(fid)) continue
    familyMarkets.set(fid, {
      familyId: fid,
      funds: INITIAL_FAMILY_FUNDS,
      chiefId: w.gender === 'male' ? w.id : 0,
      chiefName: w.name,
      orders: [],
      enrollmentBoostKind: 'none',
      totalPosted: 0,
      totalFulfilled: 0,
    })
  }
}

export function resetFamilyMarkets(): void {
  familyMarkets.clear()
  orderIdSeq = 1
}

export function getFamilyMarketRecords(): FamilyMarketRecord[] {
  return [...familyMarkets.values()]
}

export function getFamilyMarket(familyId: number): FamilyMarketRecord | undefined {
  return familyMarkets.get(familyId)
}

export function findMarketOrder(orderId: number): MarketOrder | null {
  for (const rec of familyMarkets.values()) {
    const order = rec.orders.find((o) => o.id === orderId)
    if (order) return order
  }
  return null
}

export function isFamilyChief(entity: CircleEntity): boolean {
  const fid = getFamilyId(entity)
  const rec = familyMarkets.get(fid)
  return rec != null && rec.chiefId === entity.id
}

export function fulfillMarketOrder(orderId: number, contractorId: number, gameTimeSec: number): void {
  for (const rec of familyMarkets.values()) {
    const order = rec.orders.find((o) => o.id === orderId)
    if (!order || order.status !== 'assigned') return
    if (order.contractorId !== contractorId) return

    order.status = 'fulfilled'
    order.completedAt = gameTimeSec
    order.contractorEtaSec = 0
    rec.enrollmentBoostKind = 'none'
    rec.totalFulfilled++
  }
}

export function creditContractorHousehold(contractor: CircleEntity, reward: number): void {
  if (!hasHousehold(contractor)) {
    contractor.personalFunds += reward * FAMILY_SHARE_OF_REWARD
    return
  }
  depositHousehold(contractor.householdId, reward * FAMILY_SHARE_OF_REWARD)
}

export function tickFamilyMarkets(entities: CircleEntity[], gameTimeSec: number, _dt: number): void {
  const familyIds = new Set<number>()
  for (const w of entities) {
    if (!isActive(w)) continue
    familyIds.add(getFamilyId(w))
  }

  for (const fid of familyIds) {
    if (!familyMarkets.has(fid)) {
      familyMarkets.set(fid, {
        familyId: fid,
        funds: INITIAL_FAMILY_FUNDS * 0.6,
        chiefId: 0,
        chiefName: '—',
        orders: [],
        enrollmentBoostKind: 'none',
        totalPosted: 0,
        totalFulfilled: 0,
      })
    }
    electChief(fid, entities, gameTimeSec)
    const rec = familyMarkets.get(fid)!
    tickSelfPostedOrders(rec, entities, gameTimeSec)
    tryAssignContractors(rec, entities, gameTimeSec)
    for (const order of rec.orders) {
      if (order.status === 'assigned') updateOrderContractorTelemetry(order, entities)
    }
  }
}

export function getFamilyEnrollmentBoosts(): ReadonlyMap<number, TransformKind> {
  const map = new Map<number, TransformKind>()
  for (const rec of familyMarkets.values()) {
    if (rec.enrollmentBoostKind !== 'none') {
      map.set(rec.familyId, rec.enrollmentBoostKind)
    }
  }
  return map
}

export function isAtContractTarget(entity: CircleEntity): boolean {
  if (entity.marketContractOrderId <= 0) return true
  const dist = Math.hypot(entity.contractTargetX - entity.x, entity.contractTargetY - entity.y)
  return dist <= ORDER_FULFILL_RADIUS
}
