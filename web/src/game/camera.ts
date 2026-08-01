import {
  massToRadius,
  PLAYER_START_MASS,
  PLAYER_START_RADIUS,
  radiusToMass,
} from './physics'

const VIEW_BETA = 0.45
const VIEW_BASE_HALF = PLAYER_START_RADIUS * 4
const RADIUS_THRESHOLD = PLAYER_START_RADIUS * 2

export interface CameraState {
  viewHalf: number
  zoom: number
  renderScale: number
}

export function computeCamera(
  playerMass: number,
  screenWidth: number,
  screenHeight: number,
): CameraState {
  const r = massToRadius(playerMass)
  const massRatio = playerMass / PLAYER_START_MASS
  const thresholdMass = radiusToMass(RADIUS_THRESHOLD)

  let viewHalf: number
  let zoom: number

  if (r <= RADIUS_THRESHOLD) {
    zoom = 1
    viewHalf = VIEW_BASE_HALF * massRatio ** VIEW_BETA
  } else {
    zoom = r / RADIUS_THRESHOLD
    viewHalf = VIEW_BASE_HALF * (thresholdMass / PLAYER_START_MASS) ** VIEW_BETA
  }

  const screenFit = Math.min(screenWidth, screenHeight) * 0.46
  const renderScale = screenFit / viewHalf / zoom

  return { viewHalf, zoom, renderScale }
}

export function isInView(
  x: number,
  y: number,
  radius: number,
  cameraX: number,
  cameraY: number,
  viewHalf: number,
  aspect: number,
): boolean {
  const dx = Math.abs(x - cameraX)
  const dy = Math.abs(y - cameraY)
  const margin = radius + 24
  return dx < viewHalf * aspect + margin && dy < viewHalf + margin
}
