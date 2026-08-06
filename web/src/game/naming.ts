import type { Gender } from './entity'

const CONSONANTS_UPPER = 'BCDFGHJKLMNPQRSTVWXYZ'
const VOWELS_LOWER = 'aeiou'

function hash01(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function pickUpperConsonant(seed: number): string {
  return CONSONANTS_UPPER[Math.floor(hash01(seed) * CONSONANTS_UPPER.length) % CONSONANTS_UPPER.length]
}

function pickLowerVowel(seed: number): string {
  return VOWELS_LOWER[Math.floor(hash01(seed) * VOWELS_LOWER.length) % VOWELS_LOWER.length]
}

/** 姓氏：一个大写辅音 + 一至两个小写元音 */
export function randomSurname(seed: number): string {
  const vowelCount = hash01(seed + 2.3) < 0.45 ? 1 : 2
  let result = pickUpperConsonant(seed)
  for (let i = 0; i < vowelCount; i++) {
    result += pickLowerVowel(seed + 4.7 + i * 1.9)
  }
  return result
}

/** 名字：一个大写辅音 + 一至两个小写元音 */
export function randomGivenName(seed: number): string {
  const vowelCount = hash01(seed + 6.1) < 0.45 ? 1 : 2
  let result = pickUpperConsonant(seed + 1.1)
  for (let i = 0; i < vowelCount; i++) {
    result += pickLowerVowel(seed + 8.3 + i * 2.1)
  }
  return result
}

/** 全名：姓氏在前，中间空格 */
export function formatFullName(surname: string, given: string): string {
  return `${surname} ${given}`
}

export function randomFounderName(seed: number): string {
  return formatFullName(randomSurname(seed), randomGivenName(seed + 9.17))
}

export function nameSurname(fullName: string): string {
  const trimmed = fullName.trim()
  const space = trimmed.indexOf(' ')
  if (space > 0) return trimmed.slice(0, space)
  return trimmed
}

export function nameGiven(fullName: string): string {
  const trimmed = fullName.trim()
  const space = trimmed.indexOf(' ')
  if (space > 0 && space < trimmed.length - 1) return trimmed.slice(space + 1)
  return randomGivenName(trimmed.charCodeAt(0) || 1)
}

/** 后代：父姓 + 随机名 */
export function offspringName(fatherName: string, seed: number): string {
  return formatFullName(nameSurname(fatherName), randomGivenName(seed))
}

/** 创始圆虚构父母名 */
export function randomParentPair(seed: number): { father: string; mother: string } {
  return {
    father: formatFullName(randomSurname(seed + 13), randomGivenName(seed + 17)),
    mother: formatFullName(randomSurname(seed + 23), randomGivenName(seed + 29)),
  }
}

export function generationLabel(generation: number): string {
  return `G${generation}`
}

export function randomGender(): Gender {
  return Math.random() < 0.5 ? 'male' : 'female'
}
