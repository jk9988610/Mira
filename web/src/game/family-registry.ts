import { formatGameTime } from './game-clock'
import type { CircleEntity, Gender } from './entity'
import { isActive } from './entity'

export interface DeceasedMemberRecord {
  id: number
  name: string
  gender: Gender
  familyId: number
  motherId: number
  fatherId: number
  generation: number
  birthGameTimeSec: number
  deathGameTimeSec: number
  spouseId: number
  practitionerFarm: boolean
  practitionerSchool: boolean
  practitionerPark: boolean
  practitionerFortress: boolean
}

export interface GenealogyMember {
  id: number
  name: string
  gender: Gender
  motherId: number
  fatherId: number
  generation: number
  birthGameTimeSec: number
  deathGameTimeSec?: number
  deceased: boolean
  spouseId: number
  offspringMale: number
  offspringFemale: number
  practitionerFarm: boolean
  practitionerSchool: boolean
  practitionerPark: boolean
  practitionerFortress: boolean
}

export interface FamilyGenealogy {
  familyId: number
  familyName: string
  members: GenealogyMember[]
  practitionerFarm: number
  practitionerSchool: number
  practitionerPark: number
  practitionerFortress: number
}

const deceasedMembers: DeceasedMemberRecord[] = []

export function resetFamilyRegistry(): void {
  deceasedMembers.length = 0
}

export function recordDeceased(entity: CircleEntity, gameTimeSec: number): void {
  if (deceasedMembers.some((m) => m.id === entity.id)) return
  deceasedMembers.push({
    id: entity.id,
    name: entity.name,
    gender: entity.gender,
    familyId: entity.familyId || entity.id,
    motherId: entity.motherId,
    fatherId: entity.fatherId,
    generation: entity.generation,
    birthGameTimeSec: entity.birthGameTimeSec,
    deathGameTimeSec: gameTimeSec,
    spouseId: entity.spouseId,
    practitionerFarm: entity.practitionerFarm,
    practitionerSchool: entity.practitionerSchool,
    practitionerPark: entity.practitionerPark,
    practitionerFortress: entity.practitionerFortress,
  })
}

export function getDeceasedMembers(): readonly DeceasedMemberRecord[] {
  return deceasedMembers
}

function memberFromEntity(entity: CircleEntity): GenealogyMember {
  return {
    id: entity.id,
    name: entity.name,
    gender: entity.gender,
    motherId: entity.motherId,
    fatherId: entity.fatherId,
    generation: entity.generation,
    birthGameTimeSec: entity.birthGameTimeSec,
    deceased: false,
    spouseId: entity.spouseId,
    offspringMale: 0,
    offspringFemale: 0,
    practitionerFarm: entity.practitionerFarm,
    practitionerSchool: entity.practitionerSchool,
    practitionerPark: entity.practitionerPark,
    practitionerFortress: entity.practitionerFortress,
  }
}

function memberFromDeceased(record: DeceasedMemberRecord): GenealogyMember {
  return {
    id: record.id,
    name: record.name,
    gender: record.gender,
    motherId: record.motherId,
    fatherId: record.fatherId,
    generation: record.generation,
    birthGameTimeSec: record.birthGameTimeSec,
    deathGameTimeSec: record.deathGameTimeSec,
    deceased: true,
    spouseId: record.spouseId,
    offspringMale: 0,
    offspringFemale: 0,
    practitionerFarm: record.practitionerFarm,
    practitionerSchool: record.practitionerSchool,
    practitionerPark: record.practitionerPark,
    practitionerFortress: record.practitionerFortress,
  }
}

function countCoupleOffspring(
  member: GenealogyMember,
  allMembers: GenealogyMember[],
): { male: number; female: number } {
  const parentIds = new Set<number>([member.id])
  if (member.spouseId > 0) parentIds.add(member.spouseId)

  let male = 0
  let female = 0
  for (const child of allMembers) {
    if (child.id === member.id) continue
    const fromMember = child.fatherId === member.id || child.motherId === member.id
    const fromSpouse =
      member.spouseId > 0 && (child.fatherId === member.spouseId || child.motherId === member.spouseId)
    if (!fromMember && !fromSpouse) continue

    if (member.spouseId > 0 && child.fatherId > 0 && child.motherId > 0) {
      if (!parentIds.has(child.fatherId) || !parentIds.has(child.motherId)) continue
    }

    if (child.gender === 'male') male++
    else female++
  }
  return { male, female }
}

function attachOffspringCounts(members: GenealogyMember[]): void {
  for (const member of members) {
    const counts = countCoupleOffspring(member, members)
    member.offspringMale = counts.male
    member.offspringFemale = counts.female
  }
}

export function buildFamilyGenealogies(
  entities: CircleEntity[],
  familyNames: Map<number, string>,
): FamilyGenealogy[] {
  const byFamily = new Map<number, GenealogyMember[]>()

  const addMember = (familyId: number, member: GenealogyMember) => {
    const list = byFamily.get(familyId) ?? []
    if (list.some((m) => m.id === member.id)) return
    list.push(member)
    byFamily.set(familyId, list)
  }

  for (const entity of entities) {
    if (!isActive(entity)) continue
    const familyId = entity.familyId || entity.id
    addMember(familyId, memberFromEntity(entity))
  }

  for (const record of deceasedMembers) {
    addMember(record.familyId, memberFromDeceased(record))
  }

  const genealogies: FamilyGenealogy[] = []
  for (const [familyId, members] of byFamily) {
    attachOffspringCounts(members)
    members.sort((a, b) => a.generation - b.generation || a.id - b.id)
    let practitionerFarm = 0
    let practitionerSchool = 0
    let practitionerPark = 0
    let practitionerFortress = 0
    for (const member of members) {
      if (member.deceased) continue
      if (member.practitionerFarm) practitionerFarm++
      if (member.practitionerSchool) practitionerSchool++
      if (member.practitionerPark) practitionerPark++
      if (member.practitionerFortress) practitionerFortress++
    }
    genealogies.push({
      familyId,
      familyName: familyNames.get(familyId) ?? `家族${familyId}`,
      members,
      practitionerFarm,
      practitionerSchool,
      practitionerPark,
      practitionerFortress,
    })
  }

  genealogies.sort((a, b) => a.familyName.localeCompare(b.familyName, 'zh-CN'))
  return genealogies
}

export function formatGenealogyLine(
  member: GenealogyMember,
  nameById: ReadonlyMap<number, string>,
): string {
  const gender = member.gender === 'male' ? '男' : '女'
  const status = member.deceased ? '已故' : '在世'
  const roles: string[] = []
  if (member.practitionerFarm) roles.push('农场')
  if (member.practitionerSchool) roles.push('校园')
  if (member.practitionerPark) roles.push('乐园')
  if (member.practitionerFortress) roles.push('堡垒')
  const roleText = roles.length > 0 ? ` · ${roles.join('/')}化身者` : ''
  const motherName =
    member.motherId > 0 ? nameById.get(member.motherId) ?? `#${member.motherId}` : ''
  const fatherName =
    member.fatherId > 0 ? nameById.get(member.fatherId) ?? `#${member.fatherId}` : ''
  const parent =
    member.motherId > 0 || member.fatherId > 0
      ? ` · 母·${motherName || '—'} 父·${fatherName || '—'}`
      : ''
  const spouseName =
    member.spouseId > 0 ? nameById.get(member.spouseId) ?? `#${member.spouseId}` : ''
  const spouse = member.spouseId > 0 ? ` · 配偶·${spouseName}` : ''
  const birth = `生·${formatGameTime(member.birthGameTimeSec)}`
  const death =
    member.deceased && member.deathGameTimeSec !== undefined
      ? ` · 亡·${formatGameTime(member.deathGameTimeSec)}`
      : ''
  const offspring = ` · 子女 男${member.offspringMale} 女${member.offspringFemale}`
  return `${member.name}（${gender}·${status}${roleText}${spouse}）${birth}${death}${offspring}${parent}`
}

export function buildGenealogyNameMap(genealogies: FamilyGenealogy[]): Map<number, string> {
  const map = new Map<number, string>()
  for (const genealogy of genealogies) {
    for (const member of genealogy.members) {
      map.set(member.id, member.name)
    }
  }
  return map
}
