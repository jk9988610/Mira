import type { CircleEntity } from './entity'

/** 纯数字身份证：世代(2)+出生秒(8)+序号(6)+性别(1)+纬度(4)+经度(4) */
export function formatCitizenId(entity: CircleEntity): string {
  const gen = entity.generation.toString().padStart(2, '0')
  const birth = Math.floor(entity.birthGameTimeSec).toString().padStart(8, '0')
  const seq = entity.id.toString().padStart(6, '0')
  const gender = entity.gender === 'male' ? '1' : '2'
  const lat = Math.floor(entity.lat * 100).toString().padStart(4, '0')
  const lng = Math.floor(entity.lng * 100).toString().padStart(4, '0')
  return `${gen}${birth}${seq}${gender}${lat}${lng}`
}
