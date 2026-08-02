/** 面密度 σ；质量 m = σ·π·r² */
export const SURFACE_DENSITY = 0.12

/** 与 pellet.ts 中 PELLET_MAX_RADIUS 保持一致，避免 physics↔pellet 循环依赖 */
export const PELLET_MAX_RADIUS = 14

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

/** 化身模式：质量越高，摄取收益递减（对数软上限） */
export function addMassLogarithmic(current: number, delta: number): number {
  const reference = PLAYER_START_MASS * 5
  const t = Math.max(0, current / reference)
  const efficiency = 1 / (1 + Math.log1p(t))
  return current + delta * efficiency
}

/** 化身模式：面积对数增长，大体型后半径涨得更慢 */
export function massToRadiusLogarithmic(mass: number): number {
  const reference = PLAYER_START_MASS * 5
  if (mass <= reference) return massToRadius(mass)
  const rRef = massToRadius(reference)
  const logScale = Math.log1p((mass - reference) / reference)
  return rRef * (1 + logScale * 0.6)
}
