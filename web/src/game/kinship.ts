import type { CircleEntity } from './entity'

/** 近亲：父母、子女、兄弟姐妹（同父或同母）不可生产 */
export function areKin(a: CircleEntity, b: CircleEntity): boolean {
  if (a.id === b.id) return true
  if (a.motherId === b.id || a.fatherId === b.id) return true
  if (b.motherId === a.id || b.fatherId === a.id) return true
  if (a.motherId > 0 && a.motherId === b.motherId) return true
  if (a.fatherId > 0 && a.fatherId === b.fatherId) return true
  return false
}
