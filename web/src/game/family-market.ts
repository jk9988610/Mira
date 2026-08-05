import {
  ADULT_AGE_SEC,
  CHIEF_SURVEY_RADIUS,
  FAMILY_NEED_POST_THRESHOLD,
  FAMILY_SHARE_OF_REWARD,
  HOSTILE_PRESSURE_ORDER_THRESHOLD,
  INITIAL_FAMILY_FUNDS,
  KNOWLEDGE_CAP,
  JOY_CAP,
  MAX_ORDER_HISTORY,
  ORDER_DEADLINE_SEC,
  ORDER_FULFILL_RADIUS,
  ORDER_POST_COOLDOWN_SEC,
  ORDER_POST_COST,
  ORDER_REWARD,
  SATIETY_CAP,
} from './avatar-config'
import { registerDefender } from './avatar-defender'
import { chooseAvatarKindToBuild } from './avatar-needs'
import { registerAvatarPractitioner } from './avatar-practitioner'
import {
  findMostPressuredByHostiles,
  maxHostilePressureInFamily,
} from './pressure-field'
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

function isFounderMale(entity: CircleEntity): boolean {
  return entity.motherId === 0 && entity.gender === 'male'
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

function surveyAroundPoint(
  centerX: number,
  centerY: number,
  entities: CircleEntity[],
  familyId: number,
): {
  food: number
  knowledge: number
  happiness: number
} {
  let food = 0
  let knowledge = 0
  let happiness = 0
  let n = 0
  for (const w of entities) {
    if (!isActive(w) || getFamilyId(w) !== familyId) continue
    const dist = Math.hypot(w.x - centerX, w.y - centerY)
    if (dist > CHIEF_SURVEY_RADIUS) continue
    food += w.satiety / SATIETY_CAP
    knowledge += w.knowledge / KNOWLEDGE_CAP
    happiness += w.joy / JOY_CAP
    n++
  }
  if (n === 0) return { food: 0, knowledge: 0, happiness: 0 }
  return { food: food / n, knowledge: knowledge / n, happiness: happiness / n }
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

function findNeediestNearby(
  centerX: number,
  centerY: number,
  familyId: number,
  entities: CircleEntity[],
  kind: TransformKind,
): CircleEntity | null {
  let best: CircleEntity | null = null
  let bestNeed = -1
  for (const w of entities) {
    if (!isActive(w) || getFamilyId(w) !== familyId) continue
    const dist = Math.hypot(w.x - centerX, w.y - centerY)
    if (dist > CHIEF_SURVEY_RADIUS) continue
    let need = 0
    if (kind === 'farm') need = 1 - w.satiety / SATIETY_CAP
    else if (kind === 'school') need = 1 - w.knowledge / KNOWLEDGE_CAP
    else if (kind === 'park') need = 1 - w.joy / JOY_CAP
    else continue
    if (need > bestNeed) {
      bestNeed = need
      best = w
    }
  }
  return best
}

function hasOpenOrder(rec: FamilyMarketRecord): boolean {
  return rec.orders.some((o) => o.status === 'open' || o.status === 'assigned')
}

function isIdlePractitioner(w: CircleEntity, gameTimeSec: number, chiefId: number): boolean {
  if (!isActive(w) || !isAdult(w, gameTimeSec)) return false
  if (w.id === chiefId) return false
  if (!w.isAvatarPractitioner) return false
  if (isInAvatarState(w)) return false
  if (w.productionStage !== 'none') return false
  if (w.marketContractOrderId > 0 || w.pendingAvatarKind !== 'none') return false
  if (w.orderServiceTimer > 0) return false
  return true
}

function isIdleDefender(w: CircleEntity, gameTimeSec: number, chiefId: number): boolean {
  if (!isActive(w) || !isAdult(w, gameTimeSec)) return false
  if (w.gender !== 'male') return false
  if (!w.isDefender) return false
  if (w.id === chiefId) return false
  if (isInAvatarState(w)) return false
  if (w.productionStage !== 'none') return false
  if (w.marketContractOrderId > 0 || w.pendingAvatarKind !== 'none') return false
  if (w.orderServiceTimer > 0) return false
  return true
}

function clearWorkerContract(worker: CircleEntity): void {
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
}

function tryPostOrder(familyId: number, entities: CircleEntity[], gameTimeSec: number): void {
  const rec = familyMarkets.get(familyId)
  if (!rec || gameTimeSec < rec.orderPostCooldownUntil) return
  if (rec.funds < ORDER_POST_COST) return
  if (hasOpenOrder(rec)) return

  const chief = entities.find((w) => w.id === rec.chiefId && isActive(w))
  if (!chief) return

  const hostilePressure = maxHostilePressureInFamily(
    familyId,
    chief.x,
    chief.y,
    CHIEF_SURVEY_RADIUS,
    entities,
  )
  if (hostilePressure >= HOSTILE_PRESSURE_ORDER_THRESHOLD) {
    const pressured = findMostPressuredByHostiles(
      chief.x,
      chief.y,
      familyId,
      CHIEF_SURVEY_RADIUS,
      entities,
    )
    if (pressured) {
      postOrder(rec, chief, 'fortress', pressured.x, pressured.y, gameTimeSec)
      return
    }
  }

  const survey = surveyAroundPoint(chief.x, chief.y, entities, familyId)
  const kind = chooseAvatarKindToBuild(survey.food, survey.knowledge, survey.happiness)
  if (!kind) return

  let triggerNeed = 0
  if (kind === 'farm') triggerNeed = 1 - survey.food
  else if (kind === 'school') triggerNeed = 1 - survey.knowledge
  else triggerNeed = 1 - survey.happiness
  if (triggerNeed < FAMILY_NEED_POST_THRESHOLD) return

  const needy = findNeediestNearby(chief.x, chief.y, familyId, entities, kind)
  if (!needy) return

  postOrder(rec, chief, kind, needy.x, needy.y, gameTimeSec)
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
      const eligible =
        order.kind === 'fortress'
          ? isIdleDefender(w, gameTimeSec, rec.chiefId)
          : isIdlePractitioner(w, gameTimeSec, rec.chiefId)
      if (!eligible) continue
      const dist = Math.hypot(w.x - order.x, w.y - order.y)
      if (dist < bestDist) {
        bestDist = dist
        bestWorker = w
      }
    }
    if (!bestWorker) continue

    order.status = 'assigned'
    order.contractorId = bestWorker.id
    if (order.kind === 'fortress') {
      registerDefender(bestWorker)
    } else {
      registerAvatarPractitioner(bestWorker)
    }
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
      if (worker) clearWorkerContract(worker)
      order.status = 'expired'
      order.contractorId = undefined
    } else {
      order.status = 'expired'
    }
  }
}

export function initFamilyMarkets(entities: CircleEntity[]): void {
  familyMarkets.clear()
  orderIdSeq = 1
  for (const w of entities) {
    if (!isFounderMale(w)) continue
    const fid = getFamilyId(w)
    if (familyMarkets.has(fid)) continue
    familyMarkets.set(fid, {
      familyId: fid,
      funds: INITIAL_FAMILY_FUNDS,
      chiefId: w.id,
      chiefName: w.name,
      orderPostCooldownUntil: 2,
      orders: [],
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
  }
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
        orderPostCooldownUntil: gameTimeSec + 5,
        orders: [],
      })
    }
    electChief(fid, entities, gameTimeSec)
    tryPostOrder(fid, entities, gameTimeSec)
    tryAssignContractors(fid, entities, gameTimeSec)
    expireOrders(fid, entities, gameTimeSec)
  }
}

export function isAtContractTarget(entity: CircleEntity): boolean {
  if (entity.marketContractOrderId <= 0) return true
  const dist = Math.hypot(entity.contractTargetX - entity.x, entity.contractTargetY - entity.y)
  return dist <= ORDER_FULFILL_RADIUS
}
