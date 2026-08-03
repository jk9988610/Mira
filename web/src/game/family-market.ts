import {
  ADULT_AGE_SEC,
  FAMILY_NEED_POST_THRESHOLD,
  FAMILY_SHARE_OF_REWARD,
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
import { chooseAvatarKindToBuild } from './avatar-needs'
import type { CircleEntity, TransformKind } from './entity'
import { entityAgeSec, isActive, isAdult } from './entity'

export type OrderStatus = 'open' | 'assigned' | 'fulfilled' | 'cancelled' | 'expired'

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
}

export interface FamilyMarketRecord {
  familyId: number
  funds: number
  chiefId: number
  chiefName: string
  orderPostCooldownUntil: number
  surveyFood: number
  surveyKnowledge: number
  surveyHappiness: number
  orders: MarketOrder[]
}

let orderIdSeq = 1
const familyMarkets = new Map<number, FamilyMarketRecord>()

function getFamilyId(entity: CircleEntity): number {
  return entity.familyId || entity.id
}

function isFounderMale(entity: CircleEntity): boolean {
  return entity.motherId === 0 && entity.gender === 'male'
}

function surveyFamily(entities: CircleEntity[], familyId: number): {
  food: number
  knowledge: number
  happiness: number
} {
  let food = 0
  let knowledge = 0
  let happiness = 0
  let n = 0
  for (const w of entities) {
    if (!isActive(w) || !isAdult(w, 0) || getFamilyId(w) !== familyId) continue
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
  return w.avatarTransformCount * 18 + w.knowledge * 2.2 + w.joy * 0.6 + age * 0.35
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

function findNeediestMember(
  familyId: number,
  entities: CircleEntity[],
  kind: TransformKind,
): CircleEntity | null {
  let best: CircleEntity | null = null
  let bestNeed = -1
  for (const w of entities) {
    if (!isActive(w) || !isAdult(w, 0) || getFamilyId(w) !== familyId) continue
    let need = 0
    if (kind === 'farm') need = 1 - w.satiety / SATIETY_CAP
    else if (kind === 'school') need = 1 - w.knowledge / KNOWLEDGE_CAP
    else need = 1 - w.joy / JOY_CAP
    if (need > bestNeed) {
      bestNeed = need
      best = w
    }
  }
  return best
}

function findElderPoster(
  familyId: number,
  entities: CircleEntity[],
  gameTimeSec: number,
): CircleEntity | null {
  let best: CircleEntity | null = null
  let bestAge = -1
  for (const w of entities) {
    if (!isActive(w) || !isAdult(w, gameTimeSec) || w.gender !== 'male' || getFamilyId(w) !== familyId) continue
    const age = entityAgeSec(w, gameTimeSec)
    if (age >= bestAge) {
      bestAge = age
      best = w
    }
  }
  return best
}

function hasOpenOrder(rec: FamilyMarketRecord): boolean {
  return rec.orders.some((o) => o.status === 'open' || o.status === 'assigned')
}

function isIdleContractor(w: CircleEntity, gameTimeSec: number): boolean {
  if (!isActive(w) || !isAdult(w, gameTimeSec)) return false
  if (w.isFrozen || w.productionStage !== 'none') return false
  if (w.marketContractOrderId > 0 || w.pendingAvatarKind !== 'none') return false
  return true
}

function tryPostOrder(familyId: number, entities: CircleEntity[], gameTimeSec: number): void {
  const rec = familyMarkets.get(familyId)
  if (!rec || gameTimeSec < rec.orderPostCooldownUntil) return
  if (rec.funds < ORDER_POST_COST) return
  if (hasOpenOrder(rec)) return

  const survey = surveyFamily(entities, familyId)
  rec.surveyFood = survey.food
  rec.surveyKnowledge = survey.knowledge
  rec.surveyHappiness = survey.happiness

  const kind = chooseAvatarKindToBuild(survey.food, survey.knowledge, survey.happiness)
  if (!kind) return

  let triggerNeed = 0
  if (kind === 'farm') triggerNeed = 1 - survey.food
  else if (kind === 'school') triggerNeed = 1 - survey.knowledge
  else triggerNeed = 1 - survey.happiness
  if (triggerNeed < FAMILY_NEED_POST_THRESHOLD) return

  const needy = findNeediestMember(familyId, entities, kind)
  const poster = findElderPoster(familyId, entities, gameTimeSec) ?? needy
  if (!needy || !poster) return

  rec.funds -= ORDER_POST_COST
  rec.orderPostCooldownUntil = gameTimeSec + ORDER_POST_COOLDOWN_SEC

  const order: MarketOrder = {
    id: orderIdSeq++,
    familyId,
    kind,
    x: needy.x,
    y: needy.y,
    reward: ORDER_REWARD,
    cost: ORDER_POST_COST,
    postedAt: gameTimeSec,
    deadline: gameTimeSec + ORDER_DEADLINE_SEC,
    status: 'open',
    posterId: poster.id,
  }
  rec.orders.unshift(order)
  if (rec.orders.length > MAX_ORDER_HISTORY) rec.orders.length = MAX_ORDER_HISTORY
}

function tryAssignContractors(familyId: number, entities: CircleEntity[], gameTimeSec: number): void {
  const rec = familyMarkets.get(familyId)
  if (!rec) return

  for (const order of rec.orders) {
    if (order.status !== 'open') continue
    const worker = entities.find(
      (w) =>
        isActive(w) &&
        getFamilyId(w) === familyId &&
        isIdleContractor(w, gameTimeSec) &&
        w.id !== order.posterId,
    )
    if (!worker) continue

    order.status = 'assigned'
    order.contractorId = worker.id
    worker.marketContractOrderId = order.id
    worker.contractTargetX = order.x
    worker.contractTargetY = order.y
    worker.pendingAvatarKind = order.kind
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
      if (worker) {
        worker.marketContractOrderId = 0
        worker.pendingAvatarKind = 'none'
        worker.contractTargetX = 0
        worker.contractTargetY = 0
      }
    }
    order.status = 'expired'
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
      orderPostCooldownUntil: 8,
      surveyFood: 1,
      surveyKnowledge: 0.35,
      surveyHappiness: 0.55,
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

export function fulfillMarketOrder(orderId: number, contractorId: number): void {
  for (const rec of familyMarkets.values()) {
    const order = rec.orders.find((o) => o.id === orderId)
    if (!order || order.status !== 'assigned') return
    if (order.contractorId !== contractorId) return

    order.status = 'fulfilled'
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
        surveyFood: 0.8,
        surveyKnowledge: 0.35,
        surveyHappiness: 0.55,
        orders: [],
      })
    }
    electChief(fid, entities, gameTimeSec)
    expireOrders(fid, entities, gameTimeSec)
    tryPostOrder(fid, entities, gameTimeSec)
    tryAssignContractors(fid, entities, gameTimeSec)
  }
}

export function isAtContractTarget(entity: CircleEntity): boolean {
  if (entity.marketContractOrderId <= 0) return true
  const dist = Math.hypot(entity.contractTargetX - entity.x, entity.contractTargetY - entity.y)
  return dist <= ORDER_FULFILL_RADIUS
}
