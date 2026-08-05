import {
  ADULT_AGE_SEC,
  FAMILY_NEED_POST_THRESHOLD,
  FAMILY_SHARE_OF_REWARD,
  HOSTILE_PRESSURE_ORDER_THRESHOLD,
  INITIAL_FAMILY_FUNDS,
  KNOWLEDGE_CAP,
  JOY_CAP,
  MAX_ACTIVE_ORDERS_PER_FAMILY,
  MAX_ORDER_HISTORY,
  ORDER_DEADLINE_SEC,
  ORDER_FULFILL_RADIUS,
  ORDER_POST_COOLDOWN_SEC,
  ORDER_POST_COST,
  ORDER_REWARD,
  SATIETY_CAP,
} from './avatar-config'
import { isPractitioner, registerPractitioner, unregisterPractitioner } from './avatar-practitioner'
import type { CircleEntity, TransformKind } from './entity'
import { entityAgeSec, isActive, isAdult } from './entity'
import { WORLD_HEIGHT, WORLD_WIDTH } from './world'

export type OrderStatus = 'open' | 'assigned' | 'fulfilled' | 'cancelled' | 'expired'

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
  deadline: number
  status: OrderStatus
  posterId: number
  contractorId?: number
  completedAt?: number
}

export interface FamilyMarketRecord {
  familyId: number
  funds: number
  chiefId: number
  chiefName: string
  orderPostCooldownUntil: number
  orders: MarketOrder[]
  patrolQueue: number[]
  patrolIndex: number
  patrolCooldown: number
  enrollmentBoostKind: TransformKind | 'none'
  /** 累计发单数 */
  totalPosted: number
  /** 累计完成数 */
  totalFulfilled: number
  /** 累计失效数 */
  totalExpired: number
}

const PATROL_MEMBER_INTERVAL_SEC = 1.1

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
  const age = entityAgeSec(w, gameTimeSec)
  if (age < ADULT_AGE_SEC) return -1
  return w.knowledge * 2.2 + w.joy * 0.6 + age * 0.35
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

function isIdlePractitioner(
  w: CircleEntity,
  kind: TransformKind,
  gameTimeSec: number,
  chiefId: number,
): boolean {
  if (!isActive(w) || !isAdult(w, gameTimeSec)) return false
  if (w.id === chiefId) return false
  if (!isPractitioner(w, kind)) return false
  if (isInAvatarState(w)) return false
  if (w.productionStage !== 'none') return false
  if (w.marketContractOrderId > 0 || w.pendingAvatarKind !== 'none') return false
  if (w.orderServiceTimer > 0) return false
  return true
}

function clearWorkerContract(worker: CircleEntity, kind?: TransformKind): void {
  if (kind) unregisterPractitioner(worker, kind)
  worker.marketContractOrderId = 0
  worker.pendingAvatarKind = 'none'
  worker.contractTargetX = 0
  worker.contractTargetY = 0
  worker.orderServiceKind = 'none'
  worker.orderServiceTimer = 0
  worker.emitBurstSec = 0
}

function postOrder(
  rec: FamilyMarketRecord,
  chief: CircleEntity,
  kind: TransformKind,
  anchorX: number,
  anchorY: number,
  gameTimeSec: number,
): void {
  const anchor = clampOrderPoint(anchorX, anchorY)
  rec.funds -= ORDER_POST_COST
  rec.orderPostCooldownUntil = gameTimeSec + ORDER_POST_COOLDOWN_SEC

  const order: MarketOrder = {
    id: orderIdSeq++,
    familyId: rec.familyId,
    kind,
    x: anchor.x,
    y: anchor.y,
    reward: ORDER_REWARD,
    cost: ORDER_POST_COST,
    postedAt: gameTimeSec,
    deadline: gameTimeSec + ORDER_DEADLINE_SEC,
    status: 'open',
    posterId: chief.id,
  }
  rec.orders.unshift(order)
  if (rec.orders.length > MAX_ORDER_HISTORY) rec.orders.length = MAX_ORDER_HISTORY
  rec.totalPosted++
}

function rebuildPatrolQueue(familyId: number, entities: CircleEntity[], chiefId: number): number[] {
  const ids: number[] = []
  for (const w of entities) {
    if (!isActive(w) || getFamilyId(w) !== familyId) continue
    if (w.id === chiefId) continue
    ids.push(w.id)
  }
  ids.sort((a, b) => a - b)
  return ids
}

function inspectMemberNeeds(
  rec: FamilyMarketRecord,
  chief: CircleEntity,
  member: CircleEntity,
  entities: CircleEntity[],
  gameTimeSec: number,
): void {
  if (countActiveOrders(rec) >= MAX_ACTIVE_ORDERS_PER_FAMILY) return
  if (gameTimeSec < rec.orderPostCooldownUntil) return
  if (rec.funds < ORDER_POST_COST) return

  if (member.hostilePressureFelt >= HOSTILE_PRESSURE_ORDER_THRESHOLD) {
    setEnrollmentBoost(rec, 'fortress')
    postOrder(rec, chief, 'fortress', member.x, member.y, gameTimeSec)
    return
  }

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
  if (!kind) return

  setEnrollmentBoost(rec, kind)
  if (countFamilyPractitioners(rec.familyId, kind, entities) === 0) {
    setEnrollmentBoost(rec, kind)
  }
  postOrder(rec, chief, kind, member.x, member.y, gameTimeSec)
}

function tickFamilyPatrol(
  rec: FamilyMarketRecord,
  entities: CircleEntity[],
  gameTimeSec: number,
  dt: number,
): void {
  rec.patrolCooldown -= dt
  if (rec.patrolCooldown > 0) return
  rec.patrolCooldown = PATROL_MEMBER_INTERVAL_SEC

  if (rec.patrolQueue.length === 0 || rec.patrolIndex >= rec.patrolQueue.length) {
    rec.patrolQueue = rebuildPatrolQueue(rec.familyId, entities, rec.chiefId)
    rec.patrolIndex = 0
    if (rec.patrolQueue.length === 0) return
  }

  const memberId = rec.patrolQueue[rec.patrolIndex]
  rec.patrolIndex++

  const chief = entities.find((w) => w.id === rec.chiefId && isActive(w))
  if (!chief) return

  const member = entities.find((w) => w.id === memberId && isActive(w))
  if (!member) return

  inspectMemberNeeds(rec, chief, member, entities, gameTimeSec)
}

function tryAssignContractors(familyId: number, entities: CircleEntity[], gameTimeSec: number): void {
  const rec = familyMarkets.get(familyId)
  if (!rec) return

  for (const order of rec.orders) {
    if (order.status !== 'open') continue

    let bestWorker: CircleEntity | null = null
    let bestDist = Infinity
    for (const w of entities) {
      if (!isActive(w) || getFamilyId(w) !== familyId) continue
      if (!isIdlePractitioner(w, order.kind, gameTimeSec, rec.chiefId)) continue
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
    registerPractitioner(bestWorker, order.kind)
    bestWorker.marketContractOrderId = order.id
    bestWorker.contractTargetX = order.x
    bestWorker.contractTargetY = order.y
  }
}

function expireOrders(familyId: number, entities: CircleEntity[], gameTimeSec: number): void {
  const rec = familyMarkets.get(familyId)
  if (!rec) return

  for (const order of rec.orders) {
    if (order.status === 'fulfilled' || order.status === 'cancelled' || order.status === 'expired') continue
    if (gameTimeSec <= order.deadline) continue

    if (order.status === 'assigned' && order.contractorId) {
      const worker = entities.find((w) => w.id === order.contractorId)
      if (worker) clearWorkerContract(worker, order.kind)
      order.status = 'expired'
      order.contractorId = undefined
    } else {
      order.status = 'expired'
    }
    rec.totalExpired++
  }
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
      orderPostCooldownUntil: 2,
      orders: [],
      patrolQueue: [],
      patrolIndex: 0,
      patrolCooldown: 0.5,
      enrollmentBoostKind: 'none',
      totalPosted: 0,
      totalFulfilled: 0,
      totalExpired: 0,
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
    rec.funds += order.reward * FAMILY_SHARE_OF_REWARD
    rec.enrollmentBoostKind = 'none'
    rec.totalFulfilled++
  }
}

export function tickFamilyMarkets(entities: CircleEntity[], gameTimeSec: number, dt: number): void {
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
        orderPostCooldownUntil: gameTimeSec + 5,
        orders: [],
        patrolQueue: [],
        patrolIndex: 0,
        patrolCooldown: 1,
        enrollmentBoostKind: 'none',
        totalPosted: 0,
        totalFulfilled: 0,
        totalExpired: 0,
      })
    }
    electChief(fid, entities, gameTimeSec)
    const rec = familyMarkets.get(fid)!
    tickFamilyPatrol(rec, entities, gameTimeSec, dt)
    tryAssignContractors(fid, entities, gameTimeSec)
    expireOrders(fid, entities, gameTimeSec)
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
