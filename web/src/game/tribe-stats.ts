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
  const familyMap = new Map<number, { founderName: string; offspringCount: number }>()
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

    if (e.motherId === 0) {
      const familyId = e.familyId || e.id
      if (!familyMap.has(familyId)) {
        const founderName = e.builderName || e.name
        familyMap.set(familyId, { founderName, offspringCount: 0 })
      }
    }
  }

  for (const e of entities) {
    if (!isActive(e)) continue
    if (e.motherId <= 0) continue
    const familyId = e.familyId || e.motherId
    const founder = entities.find((f) => f.id === familyId)
    const founderName = founder?.builderName || founder?.name || `家族${familyId}`
    const prev = familyMap.get(familyId)
    familyMap.set(familyId, {
      founderName: prev?.founderName ?? founderName,
      offspringCount: (prev?.offspringCount ?? 0) + 1,
    })
  }

  const families: FamilyOffspringStat[] = []
  for (const [familyId, data] of familyMap) {
    families.push({
      familyId,
      familyName: `${data.founderName}的家族`,
      offspringCount: data.offspringCount,
    })
  }
  families.sort((a, b) => b.offspringCount - a.offspringCount || a.familyName.localeCompare(b.familyName))

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
