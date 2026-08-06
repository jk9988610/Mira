import { INITIAL_HOUSEHOLD_FUNDS } from './avatar-config'
import type { CircleEntity } from './entity'
import { isActive } from './entity'

export interface HouseholdRecord {
  id: number
  funds: number
  husbandId: number
  wifeId: number
}

let nextHouseholdId = 1
const households = new Map<number, HouseholdRecord>()

export function resetHouseholds(): void {
  households.clear()
  nextHouseholdId = 1
}

export function hasHousehold(entity: CircleEntity): boolean {
  return entity.householdId > 0 && households.has(entity.householdId)
}

export function getHousehold(householdId: number): HouseholdRecord | undefined {
  return households.get(householdId)
}

export function getHouseholdRecords(): HouseholdRecord[] {
  return [...households.values()]
}

export function getHouseholdFunds(householdId: number): number {
  return households.get(householdId)?.funds ?? 0
}

export function getEntityHouseholdFunds(entity: CircleEntity): number {
  if (!hasHousehold(entity)) return entity.personalFunds
  return getHouseholdFunds(entity.householdId) + entity.personalFunds
}

export function depositHousehold(householdId: number, amount: number): void {
  const rec = households.get(householdId)
  if (!rec || amount <= 0) return
  rec.funds += amount
}

export function withdrawHousehold(householdId: number, amount: number): boolean {
  const rec = households.get(householdId)
  if (!rec || amount <= 0 || rec.funds < amount) return false
  rec.funds -= amount
  return true
}

/** 结婚：丈夫与妻子及未来子女组成家庭 */
export function formHousehold(husband: CircleEntity, wife: CircleEntity): void {
  if (husband.householdId > 0) {
    const existing = households.get(husband.householdId)
    if (existing) {
      wife.householdId = husband.householdId
      existing.wifeId = wife.id
      existing.funds += wife.personalFunds + INITIAL_HOUSEHOLD_FUNDS * 0.15
      wife.personalFunds = 0
      return
    }
  }

  const id = nextHouseholdId++
  const funds =
    INITIAL_HOUSEHOLD_FUNDS + husband.personalFunds + wife.personalFunds + INITIAL_HOUSEHOLD_FUNDS * 0.15
  husband.personalFunds = 0
  wife.personalFunds = 0
  husband.householdId = id
  wife.householdId = id
  households.set(id, {
    id,
    funds,
    husbandId: husband.id,
    wifeId: wife.id,
  })
}

export function addChildToHousehold(child: CircleEntity, father: CircleEntity, mother: CircleEntity): void {
  const householdId = father.householdId || mother.householdId
  if (householdId <= 0) return
  child.householdId = householdId
}

/** 死亡时家庭资金平分给在世子女 */
export function distributeFundsOnDeath(deceased: CircleEntity, entities: CircleEntity[]): void {
  const total = deceased.personalFunds
  deceased.personalFunds = 0

  const hh = deceased.householdId > 0 ? households.get(deceased.householdId) : undefined
  const pool = total + (hh?.funds ?? 0)
  if (hh) hh.funds = 0
  if (pool <= 0) return

  const children = entities.filter(
    (c) => isActive(c) && (c.fatherId === deceased.id || c.motherId === deceased.id),
  )

  if (children.length === 0) {
    const spouse = entities.find((e) => e.id === deceased.spouseId && isActive(e))
    if (spouse && spouse.householdId === deceased.householdId && hh) {
      hh.funds = pool
    } else if (spouse) {
      spouse.personalFunds += pool
    }
    return
  }

  const share = pool / children.length
  for (const child of children) {
    child.personalFunds += share
  }
}

export function sumHouseholdFundsByClanFamily(
  familyId: number,
  entities: CircleEntity[],
): number {
  let total = 0
  const seen = new Set<number>()
  for (const entity of entities) {
    if (!isActive(entity) || entity.familyId !== familyId) continue
    total += entity.personalFunds
    if (entity.householdId > 0 && !seen.has(entity.householdId)) {
      seen.add(entity.householdId)
      total += getHouseholdFunds(entity.householdId)
    }
  }
  return total
}
