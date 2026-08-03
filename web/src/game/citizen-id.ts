import type { CircleEntity } from './entity'

/** 10 位身份证：出生秒(4)+毫秒(1)+序号(3)+性别(1)+校验(1) */
export function formatCitizenId(entity: CircleEntity): string {
  const birthSec = Math.floor(entity.birthGameTimeSec)
  const birthMs = Math.floor((entity.birthGameTimeSec - birthSec) * 10) % 10
  const secPart = (birthSec % 10000).toString().padStart(4, '0')
  const seqPart = (entity.id % 1000).toString().padStart(3, '0')
  const gender = entity.gender === 'male' ? '1' : '2'
  const body = `${secPart}${birthMs}${seqPart}${gender}`
  const checksum = checksumDigit(body)
  return `${body}${checksum}`
}

function checksumDigit(digits: string): string {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    sum += Number.parseInt(digits[i], 10) * ((i % 2) + 1)
  }
  return (sum % 10).toString()
}
