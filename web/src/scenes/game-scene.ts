import type { App } from '../core/app'
import { randomSpawnPosition, spawnAiEntities, updateAi } from '../game/ai'
import { computeCamera } from '../game/camera'
import { absorbPelletsForEntity, resolveCircleCollisions } from '../game/collision'
import {
  clampEntityToWorld,
  createCircle,
  drawCircleEntity,
  isActive,
  type CircleEntity,
} from '../game/entity'
import { buildLeaderboard } from '../game/leaderboard'
import {
  GAME_DURATION_SEC,
  INVINCIBLE_SEC,
  RESPAWN_DELAY_SEC,
} from '../game/match-config'
import { PLAYER_START_MASS } from '../game/physics'
import { drawPellet } from '../game/pellet'
import { PLAYER_ROSTER } from '../game/roster'
import { GameWorld, WORLD_HEIGHT, WORLD_WIDTH } from '../game/world'
import { requestAppFullscreen } from '../core/fullscreen'
import {
  clearScreen,
  drawGameHud,
  drawLeaderboardModal,
  drawRespawnOverlay,
} from '../ui/draw'

const PLAYER_SPEED = 280

export function createGameScene(
  app: App,
  go: (scene: string) => void,
  showPause: (visible: boolean) => void,
  isPaused: () => boolean,
) {
  const world = new GameWorld()
  let players: CircleEntity[] = []
  let absorbFlash = 0
  let timeRemaining = GAME_DURATION_SEC
  let matchEnded = false
  let showResults = false
  let elapsed = 0

  const reset = () => {
    const spawn = randomSpawnPosition([]) ?? { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 }
    const player = createCircle(spawn.x, spawn.y, PLAYER_START_MASS, true, PLAYER_ROSTER)
    players = [player, ...spawnAiEntities([player])]
    absorbFlash = 0
    timeRemaining = GAME_DURATION_SEC
    matchEnded = false
    showResults = false
    elapsed = 0
    world.reset(player.x, player.y)
  }

  const player = () => players.find((p) => p.isPlayer)!

  const updateRespawns = (dt: number) => {
    for (const entity of players) {
      if (entity.invincibleTimer > 0) entity.invincibleTimer = Math.max(0, entity.invincibleTimer - dt)
      if (entity.respawnTimer <= 0) continue
      entity.respawnTimer -= dt
      if (entity.respawnTimer > 0) continue
      const pos = randomSpawnPosition(players.filter((p) => p.id !== entity.id))
      entity.x = pos?.x ?? WORLD_WIDTH / 2
      entity.y = pos?.y ?? WORLD_HEIGHT / 2
      entity.mass = PLAYER_START_MASS
      entity.invincibleTimer = INVINCIBLE_SEC
      entity.respawnTimer = 0
    }
  }

  return {
    enter() {
      reset()
      showPause(false)
      requestAppFullscreen()
    },
    exit() {
      showPause(false)
    },
    update(dt: number) {
      elapsed += dt

      if (showResults) {
        if (app.input.snapshot().confirmPressed) go('menu')
        return
      }

      if (isPaused()) return

      const input = app.input.snapshot()
      if (input.pausePressed && !matchEnded) {
        showPause(true)
        return
      }

      if (matchEnded) return

      timeRemaining -= dt
      if (timeRemaining <= 0) {
        timeRemaining = 0
        matchEnded = true
        showResults = true
        return
      }

      const p = player()
      if (isActive(p)) {
        const len = Math.hypot(input.moveX, input.moveY)
        if (len > 0.1) {
          const speed = PLAYER_SPEED * (PLAYER_START_MASS / p.mass) ** 0.1
          p.x += (input.moveX / len) * speed * dt
          p.y += (input.moveY / len) * speed * dt
        }
        clampEntityToWorld(p, WORLD_WIDTH, WORLD_HEIGHT)
      }

      const removedPelletIds = new Set<number>()
      for (const entity of players) {
        if (!isActive(entity)) continue
        const absorbed = absorbPelletsForEntity(entity, world.pellets)
        if (entity.isPlayer && absorbed.length > 0) absorbFlash = 0.18
        for (const pellet of absorbed) removedPelletIds.add(pellet.id)
      }

      for (const ai of players.filter((e) => !e.isPlayer)) {
        const absorbed = updateAi(ai, players, world.pellets, dt)
        for (const pellet of absorbed) removedPelletIds.add(pellet.id)
      }
      for (const id of removedPelletIds) world.removePellet(id)

      const eatEvents = resolveCircleCollisions(players)
      for (const { loser } of eatEvents) {
        loser.respawnTimer = RESPAWN_DELAY_SEC
      }

      updateRespawns(dt)
      absorbFlash = Math.max(0, absorbFlash - dt)
      world.maintainPopulation(p.x, p.y)
    },
    render(ctx: CanvasRenderingContext2D, width: number, height: number) {
      clearScreen(ctx, width, height)

      if (showResults) {
        drawLeaderboardModal(ctx, width, height, buildLeaderboard(players))
        return
      }

      const p = player()
      const cam = computeCamera(p.x, p.y, p.mass, width, height)
      const board = buildLeaderboard(players)

      ctx.save()
      ctx.translate(width / 2, height / 2)
      ctx.scale(cam.renderScale, cam.renderScale)
      ctx.translate(-cam.camX, -cam.camY)

      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
      ctx.clip()

      drawWorld(ctx)
      for (const pellet of world.pellets) drawPellet(ctx, pellet)
      for (const entity of players) {
        drawCircleEntity(ctx, entity, entity.isPlayer ? absorbFlash : 0, elapsed)
      }
      ctx.restore()
      ctx.restore()

      drawGameHud(ctx, width, height, {
        timeRemaining,
        playerMass: p.mass,
        zoom: cam.zoom,
        leaderboard: board,
      })

      if (!isActive(p)) {
        drawRespawnOverlay(ctx, width, height, p.respawnTimer)
      }
    },
  }
}

function drawWorld(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#101826'
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
  ctx.strokeStyle = '#3d5578'
  ctx.lineWidth = 6
  ctx.strokeRect(3, 3, WORLD_WIDTH - 6, WORLD_HEIGHT - 6)

  ctx.strokeStyle = 'rgba(70, 96, 132, 0.22)'
  ctx.lineWidth = 1
  const grid = 100
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
