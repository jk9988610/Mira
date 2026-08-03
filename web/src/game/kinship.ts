import type { CircleEntity } from './entity'

/** 近亲：父母、子女、兄弟姐妹，及 DNA 谱系上的直系祖辈/后代 */
export function areKin(a: CircleEntity, b: CircleEntity): boolean {
  if (a.id === b.id) return true
  if (a.motherId === b.id || a.fatherId === b.id) return true
  if (b.motherId === a.id || b.fatherId === a.id) return true
  if (a.motherId > 0 && a.motherId === b.motherId) return true
  if (a.fatherId > 0 && a.fatherId === b.fatherId) return true

  if (a.dnaFingerprint === b.dnaFingerprint) return true

  if (a.dnaFingerprint > 0) {
    if (a.dnaFingerprint === b.paternalDna || a.dnaFingerprint === b.maternalDna) return true
  }
  if (b.dnaFingerprint > 0) {
    if (b.dnaFingerprint === a.paternalDna || b.dnaFingerprint === a.maternalDna) return true
  }

  if (a.paternalDna > 0 && (a.paternalDna === b.paternalDna || a.paternalDna === b.maternalDna)) {
    return true
  }
  if (a.maternalDna > 0 && (a.maternalDna === b.paternalDna || a.maternalDna === b.maternalDna)) {
    return true
  }

  return false
}
