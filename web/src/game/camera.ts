import { massToRadius, PLAYER_START_MASS } from './physics'
import { WORLD_HEIGHT, WORLD_WIDTH } from './world'

const VIEW_BETA = 0.42
const BASE_VIEW_RADIUS = massToRadius(PLAYER_START_MASS) * 3.2

export interface CameraState {
  camX: number
  camY: number
  renderScale: number
  zoom: number
}

export function computeCamera(
  playerX: number,
  playerY: number,
  playerMass: number,
  screenWidth: number,
  screenHeight: number,
): CameraState {
  const massRatio = playerMass / PLAYER_START_MASS
  const zoom = massRatio ** VIEW_BETA
  const viewRadius = BASE_VIEW_RADIUS * zoom
  const renderScale = (Math.min(screenWidth, screenHeight) * 0.48) / viewRadius

  const halfW = screenWidth / renderScale / 2
  const halfH = screenHeight / renderScale / 2

  let camX = playerX
  let camY = playerY

  if (halfW * 2 < WORLD_WIDTH) {
    camX = clamp(playerX, halfW, WORLD_WIDTH - halfW)
  } else {
    camX = WORLD_WIDTH / 2
  }

  if (halfH * 2 < WORLD_HEIGHT) {
    camY = clamp(playerY, halfH, WORLD_HEIGHT - halfH)
  } else {
    camY = WORLD_HEIGHT / 2
  }

  return { camX, camY, renderScale, zoom }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
