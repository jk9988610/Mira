import type { App } from '../core/app'
import { sfx } from '../audio/synth'
import { requestAppFullscreen } from '../core/fullscreen'
import { randomSpawnPosition, spawnAiEntities, updateAi } from '../game/ai'
import { computeCamera } from '../game/camera'
import { absorbPelletsForEntity, resolveCircleCollisions } from '../game/collision'
import {
  createCircle,
  drawCircleEntity,
  entityRadius,
  isActive,
  type CircleEntity,
} from '../game/entity'
import { buildLeaderboardView } from '../game/leaderboard'
import {
  GAME_DURATION_SEC,
  INVINCIBLE_SEC,
  MATCH_START_COUNTDOWN_SEC,
  RESPAWN_DELAY_SEC,
} from '../game/match-config'
import {
  allHumansDead,
  applyEntityImpulse,
  applyHumanDeaths,
  applyMovement,
  getActiveHumans,
  getHumanCameraFocus,
  getHumanTotalMass,
  resolveHumanMerges,
  separateHumanClones,
  soonestHumanRespawn,
  trySplitHuman,
  updateHumanGather,
  updateHumanCenterPull,
} from '../game/player-team'
import { PLAYER_START_MASS } from '../game/physics'
import { PelletGrid } from '../game/pellet-grid'
import { drawPelletsInView } from '../game/pellet'
import { PLAYER_ROSTER } from '../game/roster'
import { computeViewBounds, isInView } from '../game/viewport'
import { drawWorld, MATCH_STYLE } from '../game/world-draw'
import { GameWorld, WORLD_HEIGHT, WORLD_WIDTH } from '../game/world'
import {
  clearScreen,
  drawGameHud,
  drawLeaderboardModal,
  drawRespawnOverlay,
  drawStartCountdown,
} from '../ui/draw'

export function createGameScene(
  app: App,
  go: (scene: string) => void,
  showPause: (visible: boolean) => void,
  isPaused: () => boolean,
  gamePause: { fn: (() => void) | null },
) {
  const world = new GameWorld()
  const pelletGrid = new PelletGrid()
  let players: CircleEntity[] = []
  let absorbFlash = 0
  let timeRemaining = GAME_DURATION_SEC
  let startCountdown = MATCH_START_COUNTDOWN_SEC
  let matchStarted = false
  let matchEnded = false
  let showResults = false
  let elapsed = 0
  let lastCountdownSecond = -1
  let splitCooldown = 0

  const reset = () => {
    const spawn = randomSpawnPosition([]) ?? { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 }
    const player = createCircle(spawn.x, spawn.y, PLAYER_START_MASS, true, PLAYER_ROSTER)
    players = [player, ...spawnAiEntities([player])]
    absorbFlash = 0
    timeRemaining = GAME_DURATION_SEC
    startCountdown = MATCH_START_COUNTDOWN_SEC
    matchStarted = false
    matchEnded = false
    showResults = false
    elapsed = 0
    lastCountdownSecond = -1
    splitCooldown = 0
    world.reset(player.x, player.y)
    pelletGrid.rebuild(world.pellets)
  }

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
      if (entity.isPlayer) sfx.respawn()
    }
  }

  const updateStartCountdown = (dt: number): boolean => {
    if (matchStarted) return true

    startCountdown -= dt
    const sec = Math.ceil(Math.max(0, startCountdown))
    if (sec !== lastCountdownSecond) {
      if (sec > 0) sfx.countdownTick(sec)
      lastCountdownSecond = sec
    }

    if (startCountdown <= 0) {
      matchStarted = true
      sfx.matchStart()
    }
    return false
  }

  return {
    enter() {
      reset()
      showPause(false)
      gamePause.fn = () => showPause(true)
      requestAppFullscreen()
      sfx.unlock()
    },
    exit() {
      showPause(false)
      if (gamePause.fn) gamePause.fn = null
    },
    update(dt: number) {
      elapsed += dt
      splitCooldown = Math.max(0, splitCooldown - dt)

      if (isPaused()) return

      const input = app.input.snapshot()
      if (input.pausePressed && !matchEnded) {
        showPause(true)
        return
      }

      if (!updateStartCountdown(dt)) return

      if (showResults) {
        if (input.confirmPressed) go('menu')
        return
      }

      if (matchEnded) return

      timeRemaining -= dt
      if (timeRemaining <= 0) {
        timeRemaining = 0
        matchEnded = true
        showResults = true
        sfx.matchEnd()
        return
      }

      if (input.splitPressed && splitCooldown <= 0) {
        const clone = trySplitHuman(players, input.moveX, input.moveY)
        if (clone) {
          players.push(clone)
          splitCooldown = 0.35
          sfx.absorbPellet()
        }
      }

      for (const human of getActiveHumans(players)) {
        if (!input.gatherHeld) {
          applyMovement(human, input.moveX, input.moveY, dt)
        }
        applyEntityImpulse(human, dt)
      }

      if (input.gatherHeld) {
        updateHumanGather(getActiveHumans(players), players, dt)
      }

      separateHumanClones(players)
      updateHumanCenterPull(players, dt)

      pelletGrid.rebuild(world.pellets)

      const removedPelletIds = new Set<number>()
      for (const entity of players) {
        if (!isActive(entity)) continue
        const absorbed = absorbPelletsForEntity(entity, world.pellets, pelletGrid)
        if (entity.isPlayer && absorbed.length > 0) {
          absorbFlash = 0.18
          sfx.absorbPellet()
        }
        for (const pellet of absorbed) removedPelletIds.add(pellet.id)
      }

      for (const ai of players) {
        if (ai.isPlayer) continue
        const absorbed = updateAi(ai, players, world.pellets, dt, pelletGrid)
        for (const pellet of absorbed) removedPelletIds.add(pellet.id)
      }
      world.removePellets(removedPelletIds)

      const eatEvents = resolveCircleCollisions(players)
      const eatenPlayerIds: number[] = []
      for (const { winner, loser } of eatEvents) {
        if (loser.isPlayer) {
          eatenPlayerIds.push(loser.id)
          sfx.eaten()
        } else {
          loser.respawnTimer = RESPAWN_DELAY_SEC
          if (winner.isPlayer) sfx.eatCircle()
        }
      }
      if (eatenPlayerIds.length > 0) {
        players = applyHumanDeaths(players, eatenPlayerIds)
      }

      players = resolveHumanMerges(players)

      updateRespawns(dt)
      absorbFlash = Math.max(0, absorbFlash - dt)

      const focus = getHumanCameraFocus(players)
      world.maintainPopulation(focus.x, focus.y)
      pelletGrid.rebuild(world.pellets)
    },
    render(ctx: CanvasRenderingContext2D, width: number, height: number) {
      clearScreen(ctx, width, height)

      const boardView = buildLeaderboardView(players)

      if (showResults) {
        drawLeaderboardModal(ctx, width, height, boardView)
        return
      }

      const focus = getHumanCameraFocus(players)
      const cam = computeCamera(focus.x, focus.y, focus.mass, width, height)
      const view = computeViewBounds(cam.camX, cam.camY, cam.renderScale, width, height)

      const sorted = [...players].sort((a, b) => b.mass - a.mass)

      ctx.save()
      ctx.translate(width / 2, height / 2)
      ctx.scale(cam.renderScale, cam.renderScale)
      ctx.translate(-cam.camX, -cam.camY)

      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
      ctx.clip()

      drawWorld(ctx, view, MATCH_STYLE)
      drawPelletsInView(ctx, world.pellets, view)
      for (const entity of sorted) {
        if (!isInView(entity.x, entity.y, view, entityRadius(entity))) continue
        drawCircleEntity(ctx, entity, entity.isPlayer ? absorbFlash : 0, elapsed)
      }
      ctx.restore()
      ctx.restore()

      if (matchStarted) {
        drawGameHud(ctx, width, height, {
          timeRemaining,
          playerMass: getHumanTotalMass(players),
          zoom: cam.zoom,
          cloneCount: getActiveHumans(players).length,
          board: boardView,
        })
      }

      if (!matchStarted) {
        drawStartCountdown(ctx, width, height, startCountdown)
      } else if (allHumansDead(players)) {
        drawRespawnOverlay(ctx, width, height, soonestHumanRespawn(players))
      }
    },
  }
}
