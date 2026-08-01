import { PELLET_MAX_RADIUS } from './pellet'

/** 面密度 σ；质量 m = σ·π·r² */
export const SURFACE_DENSITY = 0.12

export function massToRadius(mass: number): number {
  return Math.sqrt(mass / (SURFACE_DENSITY * Math.PI))
}

export function radiusToMass(radius: number): number {
  return SURFACE_DENSITY * Math.PI * radius * radius
}

/** 玩家初始半径 = 五边形（最大颗粒）外接圆半径的 3 倍 */
export const PLAYER_RADIUS_SCALE = 3
export const PLAYER_START_RADIUS = PELLET_MAX_RADIUS * PLAYER_RADIUS_SCALE
export const PLAYER_START_MASS = radiusToMass(PLAYER_START_RADIUS)

export function addMass(current: number, delta: number): number {
  return current + delta
}
