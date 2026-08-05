import type { CirclePalette } from './color-genetics'
import type { CircleEntity } from './entity'

const familyPalettes = new Map<number, CirclePalette>()
const familySurnames = new Map<number, string>()

function hash01(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100
  const ln = l / 100
  const c = (1 - Math.abs(2 * ln - 1)) * sn
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = ln - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) {
    r = c
    g = x
  } else if (h < 120) {
    r = x
    g = c
  } else if (h < 180) {
    g = c
    b = x
  } else if (h < 240) {
    g = x
    b = c
  } else if (h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }
  const toHex = (v: number) =>
    Math.max(0, Math.min(255, Math.round((v + m) * 255)))
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/** 由家族种子生成稳定配色 */
export function paletteFromFamilySeed(seed: number): CirclePalette {
  const h = hash01(seed) * 360
  const s = 52 + hash01(seed + 1.3) * 28
  const l = 42 + hash01(seed + 2.7) * 16
  return {
    colorLight: hslToHex(h, s, l + 20),
    colorDark: hslToHex(h, s, l - 14),
    strokeColor: hslToHex(h, s - 8, l + 30),
  }
}

export function registerFamily(familyId: number, surname: string, palette: CirclePalette): void {
  familySurnames.set(familyId, surname)
  familyPalettes.set(familyId, palette)
}

export function getFamilyPalette(familyId: number): CirclePalette | undefined {
  return familyPalettes.get(familyId)
}

export function getFamilySurname(familyId: number): string | undefined {
  return familySurnames.get(familyId)
}

export function familyDisplayName(familyId: number): string {
  const surname = familySurnames.get(familyId)
  return surname ? `${surname}家族` : `家族${familyId}`
}

export function applyFamilyPalette(entity: CircleEntity): void {
  const palette = familyPalettes.get(entity.familyId)
  if (!palette) return
  entity.colorLight = palette.colorLight
  entity.colorDark = palette.colorDark
  entity.strokeColor = palette.strokeColor
}

export function resetFamilyColors(): void {
  familyPalettes.clear()
  familySurnames.clear()
}
