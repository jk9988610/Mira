import type { App } from '../core/app'
import { massToRadius } from '../game/physics'
import { clearScreen, drawHudMass } from '../ui/draw'

const WORLD_WIDTH = 2400
const WORLD_HEIGHT = 1600
const PLAYER_START_MASS = 12
const PLAYER_SPEED = 280

export function createGameScene(
  app: App,
  showPause: (visible: boolean) => void,
  isPaused: () => boolean,
) {
  let playerX = WORLD_WIDTH / 2
  let playerY = WORLD_HEIGHT / 2
  let playerMass = PLAYER_START_MASS
  let cameraX = playerX
  let cameraY = playerY

  return {
    enter() {
      playerX = WORLD_WIDTH / 2
      playerY = WORLD_HEIGHT / 2
      playerMass = PLAYER_START_MASS
      cameraX = playerX
      cameraY = playerY
      showPause(false)
    },
    exit() {
      showPause(false)
    },
    update(dt: number) {
      if (isPaused()) return
      const input = app.input.snapshot()
      if (input.pausePressed) {
        showPause(true)
        return
      }

      const len = Math.hypot(input.moveX, input.moveY)
      if (len > 0.1) {
        const speed = PLAYER_SPEED * (PLAYER_START_MASS / playerMass) ** 0.1
        playerX += (input.moveX / len) * speed * dt
        playerY += (input.moveY / len) * speed * dt
      }

      const radius = massToRadius(playerMass)
      playerX = clamp(playerX, radius, WORLD_WIDTH - radius)
      playerY = clamp(playerY, radius, WORLD_HEIGHT - radius)

      cameraX += (playerX - cameraX) * Math.min(1, dt * 6)
      cameraY += (playerY - cameraY) * Math.min(1, dt * 6)
    },
    render(ctx: CanvasRenderingContext2D, width: number, height: number) {
      clearScreen(ctx, width, height)

      const viewW = width
      const viewH = height
      const scale = Math.min(viewW / WORLD_WIDTH, viewH / WORLD_HEIGHT) * 0.92
      const offsetX = (viewW - WORLD_WIDTH * scale) / 2
      const offsetY = (viewH - WORLD_HEIGHT * scale) / 2

      ctx.save()
      ctx.translate(offsetX, offsetY)
      ctx.scale(scale, scale)
      ctx.translate(-cameraX + WORLD_WIDTH / 2, -cameraY + WORLD_HEIGHT / 2)

      drawWorld(ctx)
      drawPlayer(ctx, playerX, playerY, playerMass)
      ctx.restore()

      drawHudMass(ctx, width, playerMass)
      drawCrosshair(ctx, width, height)
    },
  }
}

function drawWorld(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#101826'
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
  ctx.strokeStyle = '#2d3f5c'
  ctx.lineWidth = 4
  ctx.strokeRect(2, 2, WORLD_WIDTH - 4, WORLD_HEIGHT - 4)

  ctx.strokeStyle = 'rgba(70, 96, 132, 0.25)'
  ctx.lineWidth = 1
  const grid = 80
  for (let x = grid; x < WORLD_WIDTH; x += grid) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, WORLD_HEIGHT)
    ctx.stroke()
  }
  for (let y = grid; y < WORLD_HEIGHT; y += grid) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(WORLD_WIDTH, y)
    ctx.stroke()
  }
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  mass: number,
) {
  const r = massToRadius(mass)
  const gradient = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r)
  gradient.addColorStop(0, '#8fd3ff')
  gradient.addColorStop(1, '#2f7fd3')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#d8f1ff'
  ctx.lineWidth = 2
  ctx.stroke()
}

function drawCrosshair(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.strokeStyle = 'rgba(127, 140, 163, 0.35)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(width / 2 - 12, height / 2)
  ctx.lineTo(width / 2 + 12, height / 2)
  ctx.moveTo(width / 2, height / 2 - 12)
  ctx.lineTo(width / 2, height / 2 + 12)
  ctx.stroke()
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
