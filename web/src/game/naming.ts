import type { Gender } from './entity'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
export const NAME_PART_LEN = 2

function hash01(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function letterAt(seed: number): string {
  return LETTERS[Math.floor(hash01(seed) * LETTERS.length) % LETTERS.length]
}

/** 从 26 个大写字母中随机取两个 */
export function randomLetterPair(seed: number): string {
  return letterAt(seed) + letterAt(seed + 1.73)
}

/** 创始圆全名：姓氏(2) + 名字(2) */
export function randomFounderName(seed: number): string {
  return randomLetterPair(seed) + randomLetterPair(seed + 9.17)
}

export function nameSurname(fullName: string): string {
  if (fullName.length >= NAME_PART_LEN * 2) return fullName.slice(0, NAME_PART_LEN)
  if (fullName.length >= NAME_PART_LEN) return fullName.slice(0, NAME_PART_LEN)
  return fullName.padEnd(NAME_PART_LEN, 'X')
}

export function nameGiven(fullName: string): string {
  if (fullName.length > NAME_PART_LEN) return fullName.slice(NAME_PART_LEN)
  return randomLetterPair(fullName.charCodeAt(0) || 1)
}

/** 后代：父姓 + 随机双字母名 */
export function offspringName(fatherName: string, seed: number): string {
  return nameSurname(fatherName) + randomLetterPair(seed)
}

export function generationLabel(generation: number): string {
  return `G${generation}`
}

export function randomGender(): Gender {
  return Math.random() < 0.5 ? 'male' : 'female'
}
