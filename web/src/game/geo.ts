import { WORLD_HEIGHT, WORLD_WIDTH } from './world'

/** 化身世界经纬度：将世界坐标映射到约 30°N–35°N, 115°E–120°E */
export function worldToLatLng(x: number, y: number): { lat: number; lng: number } {
  const lat = 30 + (1 - y / WORLD_HEIGHT) * 5
  const lng = 115 + (x / WORLD_WIDTH) * 5
  return { lat, lng }
}

export function syncEntityGeo(entity: { x: number; y: number; lat: number; lng: number }): void {
  const geo = worldToLatLng(entity.x, entity.y)
  entity.lat = geo.lat
  entity.lng = geo.lng
}

export function formatLatLng(lat: number, lng: number): string {
  return `${lat.toFixed(2)}°N ${lng.toFixed(2)}°E`
}
