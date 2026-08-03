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

export function computeTribeDemographics(
  entities: CircleEntity[],
  gameTimeSec = 0,
): TribeDemographics {
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
    circles++
    if (e.avatarRole === 'farm') farm++
    if (e.avatarRole === 'school') school++
    if (e.avatarRole === 'park') park++
    if (e.productionStage !== 'none') producing++
    if (e.avatarRole === 'none' || e.avatarRole === 'ally') {
      if (isAdult(e, gameTimeSec)) {
        if (e.gender === 'male') adultMale++
        else adultFemale++
      } else if (isJuvenile(e, gameTimeSec)) {
        if (e.gender === 'male') juvenileMale++
        else juvenileFemale++
      }
    }

    if (e.motherId === 0 && e.gender === 'male') {
      const familyId = e.familyId || e.id
      familyMap.set(familyId, {
        founderName: e.builderName || e.name,
        offspringCount: 0,
      })
    }
  }

  for (const e of entities) {
    if (!isActive(e)) continue
    if (e.fatherId <= 0) continue
    const prev = familyMap.get(e.fatherId)
    if (!prev) continue
    familyMap.set(e.fatherId, {
      founderName: prev.founderName,
      offspringCount: prev.offspringCount + 1,
    })
  }

  const families: FamilyOffspringStat[] = []
  for (const [familyId, data] of familyMap) {
    families.push({
      familyId,
      familyName: `${data.founderName}家族`,
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
