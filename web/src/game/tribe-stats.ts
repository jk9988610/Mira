import type { CircleEntity } from './entity'
import { isActive, isAdult, isJuvenile } from './entity'

export interface FamilyOffspringStat {
  familyId: number
  familyName: string
  offspringCount: number
}

export interface TribeDemographics {
  total: number
  adultMale: number
  adultFemale: number
  juvenileMale: number
  juvenileFemale: number
  families: FamilyOffspringStat[]
  farm: number
  school: number
  park: number
  producing: number
  circles: number
}

export function computeTribeDemographics(entities: CircleEntity[]): TribeDemographics {
  const familyMap = new Map<number, { name: string; count: number }>()
  let adultMale = 0
  let adultFemale = 0
  let juvenileMale = 0
  let juvenileFemale = 0
  let farm = 0
  let school = 0
  let park = 0
  let producing = 0
  let circles = 0

  for (const e of entities) {
    if (!isActive(e)) continue
    if (e.avatarRole === 'farm') farm++
    if (e.avatarRole === 'school') school++
    if (e.avatarRole === 'park') park++
    if (e.productionStage !== 'none') producing++
    if (e.avatarRole === 'none' || e.avatarRole === 'ally') {
      circles++
      if (isAdult(e)) {
        if (e.gender === 'male') adultMale++
        else adultFemale++
      } else if (isJuvenile(e)) {
        if (e.gender === 'male') juvenileMale++
        else juvenileFemale++
      }
    }
    if (e.motherId > 0) {
      const fam = e.familyId || e.motherId
      const mother = entities.find((m) => m.id === e.motherId)
      const familyName = mother?.name ?? `家族${fam}`
      const prev = familyMap.get(fam)
      familyMap.set(fam, { name: familyName, count: (prev?.count ?? 0) + 1 })
    }
  }

  const families: FamilyOffspringStat[] = []
  for (const [familyId, data] of familyMap) {
    families.push({ familyId, familyName: data.name, offspringCount: data.count })
  }
  families.sort((a, b) => b.offspringCount - a.offspringCount)

  return {
    total: circles,
    adultMale,
    adultFemale,
    juvenileMale,
    juvenileFemale,
    families,
    farm,
    school,
    park,
    producing,
    circles,
  }
}
