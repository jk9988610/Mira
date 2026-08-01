import type { App } from '../core/app'
import { spawnAiEntities, updateAi } from '../game/ai'
import { computeCamera, isInView } from '../game/camera'
import { absorbPelletsForEntity, resolveCircleCollisions } from '../game/collision'
import {
  clampEntityToWorld,
  createCircle,
  drawCircleEntity,
  entityRadius,
  type CircleEntity,
} from '../game/entity'
import { PLAYER_START_MASS } from '../game/physics'
import { drawPellet } from '../game/pellet'
import { GameWorld, WORLD_HEIGHT, WORLD_WIDTH } from '../game/world'
import { clearScreen, drawGameOver, drawHudMass } from '../ui/draw'

const PLAYER_SPEED = 280

export function createGameScene(
  app: App,
  go: (scene: string) => void,
  showPause: (visible: boolean) => void,
  isPaused: () => boolean,
) {
  const world = new GameWorld()
  let player: CircleEntity = createCircle(0, 0, PLAYER_START_MASS, true, 210)
  let ais: CircleEntity[] = []
  let absorbFlash = 0
  let gameOver = false

  const reset = () => {
    player = createCircle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, PLAYER_START_MASS, true, 210)
    ais = spawnAiEntities(player.x, player.y, 220)
    absorbFlash = 0
    gameOver = false
    world.reset(player.x, player.y)
  }

  return {
    enter() {
      reset()
      showPause(false)
    },
    exit() {
      showPause(false)
    },
    update(dt: number) {
      if (isPaused()) return

      const input = app.input.snapshot()

      if (gameOver) {
        if (input.confirmPressed) go('menu')
        return
      }

      if (input.pausePressed) {
        showPause(true)
        return
      }

      const len = Math.hypot(input.moveX, input.moveY)
      if (len > 0.1) {
        const speed = PLAYER_SPEED * (PLAYER_START_MASS / player.mass) ** 0.1
        player.x += (input.moveX / len) * speed * dt
        player.y += (input.moveY / len) * speed * dt
      }
      clampEntityToWorld(player, WORLD_WIDTH, WORLD_HEIGHT)

      const removedPelletIds = new Set<number>()
      const playerAbsorbed = absorbPelletsForEntity(player, world.pellets)
      if (playerAbsorbed.length > 0) {
        absorbFlash = 0.18
        for (const p of playerAbsorbed) removedPelletIds.add(p.id)
      }

      for (const ai of ais) {
        const absorbed = updateAi(ai, player, ais, world.pellets, dt)
        for (const p of absorbed) removedPelletIds.add(p.id)
      }
      for (const id of removedPelletIds) world.removePellet(id)

      const entities = resolveCircleCollisions([player, ...ais])
      const nextPlayer = entities.find((e) => e.isPlayer)
      if (!nextPlayer) {
        gameOver = true
        return
      }
      player = nextPlayer
      ais = entities.filter((e) => !e.isPlayer)

      absorbFlash = Math.max(0, absorbFlash - dt)
      world.maintainPopulation(player.x, player.y)
    },
    render(ctx: CanvasRenderingContext2D, width: number, height: number) {
      clearScreen(ctx, width, height)

      if (gameOver) {
        drawGameOver(ctx, width, height, player.mass)
        return
      }

      const cam = computeCamera(player.mass, width, height)
      const aspect = width / height

      ctx.save()
      ctx.translate(width / 2, height / 2)
      ctx.scale(cam.renderScale, cam.renderScale)
      ctx.translate(-player.x, -player.y)

      drawWorld(ctx)

      for (const pellet of world.pellets) {
        if (!isInView(pellet.x, pellet.y, pellet.radius, player.x, player.y, cam.viewHalf, aspect)) {
          continue
        }
        drawPellet(ctx, pellet)
      }

      for (const ai of ais) {
        const r = entityRadius(ai)
        if (!isInView(ai.x, ai.y, r, player.x, player.y, cam.viewHalf, aspect)) continue
        drawCircleEntity(ctx, ai)
      }

      drawCircleEntity(ctx, player, absorbFlash)
      ctx.restore()

      drawHudMass(ctx, width, player.mass, cam.zoom)
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
