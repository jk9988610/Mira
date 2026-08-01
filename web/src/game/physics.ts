/** 面密度 σ；质量 m = σ·π·r² */
export const SURFACE_DENSITY = 0.12

export function massToRadius(mass: number): number {
  return Math.sqrt(mass / (SURFACE_DENSITY * Math.PI))
}

export function radiusToMass(radius: number): number {
  return SURFACE_DENSITY * Math.PI * radius * radius
}

export function addMass(current: number, delta: number): number {
  return current + delta
}
