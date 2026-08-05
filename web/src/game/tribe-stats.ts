import type { CircleEntity } from './entity'
import { isActive, isAdult, isJuvenile } from './entity'
import { familyDisplayName } from './family-colors'
import { nameSurname } from './naming'

export interface FamilyOffspringStat {
  familyId: number
  familyName: string
  offspringCount: number
}

export interface FamilyPractitionerStat {
  familyId: number
  familyName: string
  activePopulation: number
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
  const populationMap = new Map<number, number>()
  const practitionerMap = new Map<
    number,
    {
      familyName: string
      activePopulation: number
      farm: number
      school: number
      park: number
      fortress: number
    }
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

    const familyId = e.familyId || e.id
    populationMap.set(familyId, (populationMap.get(familyId) ?? 0) + 1)

    if (e.avatarRole === 'none' || e.avatarRole === 'ally') {
      if (isAdult(e, gameTimeSec)) {
        if (e.gender === 'male') adultMale++
        else adultFemale++
      } else if (isJuvenile(e, gameTimeSec)) {
        if (e.gender === 'male') juvenileMale++
        else juvenileFemale++
      }
    }

    if (e.motherId === 0 && e.fatherId === 0) {
      const surname = nameSurname(e.builderName || e.name)
      if (!familyMap.has(familyId)) {
        familyMap.set(familyId, {
          founderName: surname,
          offspringCount: 0,
        })
      }
    }

    if (!isAdult(e, gameTimeSec)) continue
    const famName = familyDisplayName(familyId)
    const pop = populationMap.get(familyId) ?? 0
    const prev =
      practitionerMap.get(familyId) ??
      ({
        familyName: famName,
        activePopulation: pop,
        farm: 0,
        school: 0,
        park: 0,
        fortress: 0,
      } as const)
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
    practitionerMap.set(familyId, {
      familyName: famName,
      activePopulation: pop,
      farm,
      school,
      park,
      fortress,
    })
  }

  for (const e of entities) {
    if (!isActive(e)) continue
    if (e.fatherId <= 0 && e.motherId <= 0) continue
    const familyId = e.familyId || e.fatherId || e.motherId
    const prev = familyMap.get(familyId)
    if (!prev) continue
    familyMap.set(familyId, {
      founderName: prev.founderName,
      offspringCount: prev.offspringCount + 1,
    })
  }

  const families: FamilyOffspringStat[] = []
  for (const [familyId, data] of familyMap) {
    families.push({
      familyId,
      familyName: familyDisplayName(familyId),
      offspringCount: data.offspringCount,
    })
  }
  families.sort((a, b) => b.offspringCount - a.offspringCount || a.familyName.localeCompare(b.familyName))

  const practitionerByFamily: FamilyPractitionerStat[] = []
  const allFamilyIds = new Set([...populationMap.keys(), ...practitionerMap.keys()])
  for (const familyId of allFamilyIds) {
    const data = practitionerMap.get(familyId)
    practitionerByFamily.push({
      familyId,
      familyName: data?.familyName ?? familyDisplayName(familyId),
      activePopulation: populationMap.get(familyId) ?? 0,
      farm: data?.farm ?? 0,
      school: data?.school ?? 0,
      park: data?.park ?? 0,
      fortress: data?.fortress ?? 0,
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
