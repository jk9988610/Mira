import type { FamilyMarketRecord, MarketOrder } from './family-market'
import type { TransformKind } from './entity'

export interface OrderKindStats {
  open: number
  assigned: number
  fulfilled: number
  expired: number
}

export interface OrderStatsSummary {
  /** 当前保留订单列表中的完成数 */
  fulfilled: number
  incomplete: number
  active: number
  /** 各家族累计完成 */
  lifetimeFulfilled: number
  lifetimePosted: number
  lifetimeExpired: number
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

export function summarizeOrders(markets: FamilyMarketRecord[]): OrderStatsSummary {
  let fulfilled = 0
  let incomplete = 0
  let active = 0
  let lifetimeFulfilled = 0
  let lifetimePosted = 0
  let lifetimeExpired = 0
  const byKind = emptyByKind()
  for (const rec of markets) {
    lifetimeFulfilled += rec.totalFulfilled
    lifetimePosted += rec.totalPosted
    lifetimeExpired += rec.totalExpired
    for (const order of rec.orders) {
      bumpKindStats(byKind[order.kind], order)
      if (order.status === 'fulfilled') fulfilled++
      else if (order.status === 'open' || order.status === 'assigned') active++
      else incomplete++
    }
  }
  return {
    fulfilled,
    incomplete,
    active,
    lifetimeFulfilled,
    lifetimePosted,
    lifetimeExpired,
    byKind,
  }
}

export function listAllOrders(markets: FamilyMarketRecord[]): MarketOrder[] {
  const orders: MarketOrder[] = []
  for (const rec of markets) {
    orders.push(...rec.orders)
  }
  return orders.sort((a, b) => b.postedAt - a.postedAt)
}
