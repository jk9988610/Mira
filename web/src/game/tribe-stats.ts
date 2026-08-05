import type { CircleEntity } from './entity'
import { isActive, isAdult, isJuvenile } from './entity'

export interface FamilyOffspringStat {
  familyId: number
  familyName: string
  offspringCount: number
}

export interface FamilyPractitionerStat {
  familyId: number
  familyName: string
  farm: number
  school: number
  park: number
  fortress: number
}

export interface TribeDemographics {
  total: number
  adultMale: number
  adultFemale: number
  juvenileMale: number
  juvenileFemale: number
  families: FamilyOffspringStat[]
  practitionerByFamily: FamilyPractitionerStat[]
  practitionerFarm: number
  practitionerSchool: number
  practitionerPark: number
  practitionerFortress: number
  producing: number
  circles: number
}

export function computeTribeDemographics(
  entities: CircleEntity[],
  gameTimeSec = 0,
): TribeDemographics {
  const familyMap = new Map<number, { founderName: string; offspringCount: number }>()
  const practitionerMap = new Map<
    number,
    { familyName: string; farm: number; school: number; park: number; fortress: number }
  >()
  let adultMale = 0
  let adultFemale = 0
  let juvenileMale = 0
  let juvenileFemale = 0
  let practitionerFarm = 0
  let practitionerSchool = 0
  let practitionerPark = 0
  let practitionerFortress = 0
  let producing = 0
  let circles = 0

  for (const e of entities) {
    if (!isActive(e)) continue
    circles++
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

    const familyId = e.familyId || e.id
    if (e.motherId === 0 && e.gender === 'male') {
      familyMap.set(familyId, {
        founderName: e.builderName || e.name,
        offspringCount: 0,
      })
    }

    if (!isAdult(e, gameTimeSec)) continue
    const famName = familyMap.get(familyId)?.founderName
      ? `${familyMap.get(familyId)!.founderName}家族`
      : `家族${familyId}`
    const prev =
      practitionerMap.get(familyId) ??
      ({ familyName: famName, farm: 0, school: 0, park: 0, fortress: 0 } as const)
    let farm = prev.farm
    let school = prev.school
    let park = prev.park
    let fortress = prev.fortress
    if (e.practitionerFarm) {
      farm++
      practitionerFarm++
    }
    if (e.practitionerSchool) {
      school++
      practitionerSchool++
    }
    if (e.practitionerPark) {
      park++
      practitionerPark++
    }
    if (e.practitionerFortress) {
      fortress++
      practitionerFortress++
    }
    practitionerMap.set(familyId, { familyName: famName, farm, school, park, fortress })
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

  const practitionerByFamily: FamilyPractitionerStat[] = []
  for (const [familyId, data] of practitionerMap) {
    practitionerByFamily.push({
      familyId,
      familyName: data.familyName,
      farm: data.farm,
      school: data.school,
      park: data.park,
      fortress: data.fortress,
    })
  }
  practitionerByFamily.sort((a, b) => a.familyName.localeCompare(b.familyName, 'zh-CN'))

  return {
    total: circles,
    adultMale,
    adultFemale,
    juvenileMale,
    juvenileFemale,
    families,
    practitionerByFamily,
    practitionerFarm,
    practitionerSchool,
    practitionerPark,
    practitionerFortress,
    producing,
    circles,
  }
}