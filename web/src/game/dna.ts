import type { CircleEntity } from './entity'

function fnv1a(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** 创始圆 DNA 指纹 */
export function founderDnaFingerprint(entityId: number, seed = 0): number {
  return fnv1a(`founder:${entityId}:${seed}`)
}

/** 子代继承父母 DNA */
export function inheritDnaFingerprint(
  fatherDna: number,
  motherDna: number,
  childId: number,
): number {
  const mixed = (fatherDna ^ Math.imul(motherDna, 0x9e3779b1) ^ childId) >>> 0
  return fnv1a(`child:${mixed}:${childId}`)
}

export function formatDnaFingerprint(dna: number): string {
  return (dna >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(-8)
}

export function initEntityDna(entity: CircleEntity, fatherDna = 0, motherDna = 0): void {
  if (fatherDna > 0 || motherDna > 0) {
    entity.paternalDna = fatherDna
    entity.maternalDna = motherDna
    entity.dnaFingerprint = inheritDnaFingerprint(fatherDna, motherDna, entity.id)
    return
  }
  entity.paternalDna = 0
  entity.maternalDna = 0
  entity.dnaFingerprint = founderDnaFingerprint(entity.id)
}
