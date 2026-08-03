import type { Gender } from './entity'

export function nameSurname(fullName: string): string {
  return fullName.charAt(0)
}

export function nameGiven(fullName: string): string {
  return fullName.slice(1) || fullName
}

/** 男：父姓+母名；女：母姓+父名 */
export function offspringName(fatherName: string, motherName: string, gender: Gender): string {
  const fSurname = nameSurname(fatherName)
  const fGiven = nameGiven(fatherName)
  const mSurname = nameSurname(motherName)
  const mGiven = nameGiven(motherName)
  return gender === 'male' ? fSurname + mGiven : mSurname + fGiven
}

export function generationLabel(generation: number): string {
  return `G${generation}`
}
