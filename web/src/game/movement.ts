import { PLAYER_START_MASS } from './physics'

const BASE_SPEED = 300
const SPEED_GAMMA = 0.32
const MIN_SPEED = 95

/** 质量越大越笨重，越小越灵敏；有速度下限 */
export function speedForMass(mass: number): number {
  const ratio = PLAYER_START_MASS / Math.max(mass, 1)
  return Math.max(MIN_SPEED, BASE_SPEED * ratio ** SPEED_GAMMA)
}
