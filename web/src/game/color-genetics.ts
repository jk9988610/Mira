export interface Rgb {
  r: number
  g: number
  b: number
}

export interface CirclePalette {
  colorLight: string
  colorDark: string
  strokeColor: string
}

interface ColorGenome {
  r: [number, number]
  g: [number, number]
  b: [number, number]
}

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)))
}

function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = Number.parseInt(full, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function rgbToHex({ r, g, b }: Rgb): string {
  const parts = [r, g, b].map((c) => clampByte(c).toString(16).padStart(2, '0'))
  return '#' + parts.join('')
}

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: clampByte(a.r + (b.r - a.r) * t),
    g: clampByte(a.g + (b.g - a.g) * t),
    b: clampByte(a.b + (b.b - a.b) * t),
  }
}

function genomeFromPalette(light: string, dark: string): ColorGenome {
  const l = hexToRgb(light)
  const d = hexToRgb(dark)
  return {
    r: [l.r, d.r],
    g: [l.g, d.g],
    b: [l.b, d.b],
  }
}

function hash01(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function pickAllele(pair: [number, number], seed: number): number {
  return hash01(seed) < 0.5 ? pair[0] : pair[1]
}

function expressCodominant(a: number, b: number): number {
  return clampByte((a + b) / 2)
}

/** 孟德尔式遗传：父母各贡献一个等位基因，共显性表达，带轻微突变 */
export function inheritPalette(
  father: CirclePalette,
  mother: CirclePalette,
  childId: number,
): CirclePalette {
  const fGenome = genomeFromPalette(father.colorLight, father.colorDark)
  const mGenome = genomeFromPalette(mother.colorLight, mother.colorDark)
  const seed = childId * 1.618

  const channels: Array<'r' | 'g' | 'b'> = ['r', 'g', 'b']
  const expressed: Rgb = { r: 0, g: 0, b: 0 }
  for (let i = 0; i < channels.length; i++) {
    const ch = channels[i]
    const paternal = pickAllele(fGenome[ch], seed + i * 0.17)
    const maternal = pickAllele(mGenome[ch], seed + i * 0.31 + 7)
    const base = expressCodominant(paternal, maternal)
    const mutation = (hash01(seed + i * 2.7) - 0.5) * 18
    expressed[ch] = clampByte(base + mutation)
  }

  const light = mixRgb(expressed, { r: 255, g: 255, b: 255 }, 0.28)
  const dark = mixRgb(expressed, { r: 0, g: 0, b: 0 }, 0.22)
  const stroke = mixRgb(light, { r: 255, g: 255, b: 255 }, 0.45)

  return {
    colorLight: rgbToHex(light),
    colorDark: rgbToHex(dark),
    strokeColor: rgbToHex(stroke),
  }
}
