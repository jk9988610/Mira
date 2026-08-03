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
  work: number
  learn: number
  play: number
  producing: number
  circles: number
}

export function computeTribeDemographics(entities: CircleEntity[]): TribeDemographics {
  const familyMap = new Map<number, { name: string; count: number }>()
  let adultMale = 0
  let adultFemale = 0
  let juvenileMale = 0
  let juvenileFemale = 0
  let work = 0
  let learn = 0
  let play = 0
  let producing = 0
  let circles = 0

  for (const e of entities) {
    if (!isActive(e)) continue
    if (e.avatarRole === 'work') work++
    if (e.avatarRole === 'learn') learn++
    if (e.avatarRole === 'play') play++
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
    work,
    learn,
    play,
    producing,
    circles,
  }
}
