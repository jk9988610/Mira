import { WORLD_HEIGHT, WORLD_WIDTH } from './world'
import type { ViewBounds } from './viewport'

export interface WorldDrawStyle {
  fill: string
  border: string
  grid: string
}

const AVATAR_STYLE: WorldDrawStyle = {
  fill: '#0f1828',
  border: '#3d5578',
  grid: 'rgba(70, 96, 132, 0.18)',
}

const MATCH_STYLE: WorldDrawStyle = {
  fill: '#101826',
  border: '#3d5578',
  grid: 'rgba(70, 96, 132, 0.22)',
}

export function drawWorld(
  ctx: CanvasRenderingContext2D,
  bounds?: ViewBounds,
  style: WorldDrawStyle = AVATAR_STYLE,
): void {
  ctx.fillStyle = style.fill
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
  ctx.strokeStyle = style.border
  ctx.lineWidth = 6
  ctx.strokeRect(3, 3, WORLD_WIDTH - 6, WORLD_HEIGHT - 6)

  ctx.strokeStyle = style.grid
  ctx.lineWidth = 1
  const grid = 100
  const minX = bounds ? Math.max(grid, Math.floor(bounds.minX / grid) * grid) : grid
  const maxX = bounds ? Math.min(WORLD_WIDTH, Math.ceil(bounds.maxX / grid) * grid) : WORLD_WIDTH
  const minY = bounds ? Math.max(grid, Math.floor(bounds.minY / grid) * grid) : grid
  const maxY = bounds ? Math.min(WORLD_HEIGHT, Math.ceil(bounds.maxY / grid) * grid) : WORLD_HEIGHT

  for (let x = minX; x <= maxX; x += grid) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, WORLD_HEIGHT)
    ctx.stroke()
  }
  for (let y = minY; y <= maxY; y += grid) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(WORLD_WIDTH, y)
    ctx.stroke()
  }
}

export { MATCH_STYLE, AVATAR_STYLE }
