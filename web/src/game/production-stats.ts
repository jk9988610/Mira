import type { FamilyMarketRecord, MarketOrder } from './family-market'
import type { TransformKind } from './entity'

export interface ProductionSample {
  timeSec: number
  food: number
  knowledge: number
  joy: number
}

export interface OrderKindStats {
  open: number
  assigned: number
  fulfilled: number
  expired: number
}

export interface OrderStatsSummary {
  fulfilled: number
  incomplete: number
  active: number
  byKind: Record<TransformKind, OrderKindStats>
}

const EMPTY_KIND_STATS = (): OrderKindStats => ({
  open: 0,
  assigned: 0,
  fulfilled: 0,
  expired: 0,
})

function emptyByKind(): Record<TransformKind, OrderKindStats> {
  return {
    farm: EMPTY_KIND_STATS(),
    school: EMPTY_KIND_STATS(),
    park: EMPTY_KIND_STATS(),
    fortress: EMPTY_KIND_STATS(),
  }
}

function bumpKindStats(stats: OrderKindStats, order: MarketOrder): void {
  if (order.status === 'open') stats.open++
  else if (order.status === 'assigned') stats.assigned++
  else if (order.status === 'fulfilled') stats.fulfilled++
  else stats.expired++
}

const SAMPLE_INTERVAL_SEC = 5
const MAX_SAMPLES = 24

let samples: ProductionSample[] = []
let sampleTimer = 0
let accFood = 0
let accKnowledge = 0
let accJoy = 0

export function resetProductionStats(): void {
  samples = []
  sampleTimer = 0
  accFood = 0
  accKnowledge = 0
  accJoy = 0
}

export function recordPelletProduction(kind: 'food' | 'knowledge' | 'joy', count: number): void {
  if (count <= 0) return
  if (kind === 'food') accFood += count
  else if (kind === 'knowledge') accKnowledge += count
  else accJoy += count
}

export function tickProductionStats(dt: number, gameTimeSec: number): void {
  sampleTimer += dt
  if (sampleTimer < SAMPLE_INTERVAL_SEC) return
  sampleTimer = 0

  samples.push({
    timeSec: gameTimeSec,
    food: accFood,
    knowledge: accKnowledge,
    joy: accJoy,
  })
  accFood = 0
  accKnowledge = 0
  accJoy = 0

  if (samples.length > MAX_SAMPLES) {
    samples = samples.slice(samples.length - MAX_SAMPLES)
  }
}

export function getProductionSamples(): ProductionSample[] {
  return samples
}

export function getProductionTotals(): { food: number; knowledge: number; joy: number } {
  let food = accFood
  let knowledge = accKnowledge
  let joy = accJoy
  for (const s of samples) {
    food += s.food
    knowledge += s.knowledge
    joy += s.joy
  }
  return { food, knowledge, joy }
}

export function summarizeOrders(markets: FamilyMarketRecord[]): OrderStatsSummary {
  let fulfilled = 0
  let incomplete = 0
  let active = 0
  const byKind = emptyByKind()
  for (const rec of markets) {
    for (const order of rec.orders) {
      bumpKindStats(byKind[order.kind], order)
      if (order.status === 'fulfilled') fulfilled++
      else if (order.status === 'open' || order.status === 'assigned') active++
      else incomplete++
    }
  }
  return { fulfilled, incomplete, active, byKind }
}

export function listAllOrders(markets: FamilyMarketRecord[]): MarketOrder[] {
  const orders: MarketOrder[] = []
  for (const rec of markets) {
    orders.push(...rec.orders)
  }
  return orders.sort((a, b) => b.postedAt - a.postedAt)
}
