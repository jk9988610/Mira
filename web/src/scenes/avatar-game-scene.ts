import type { App } from '../core/app'
import { sfx } from '../audio/synth'
import { requestAppFullscreen } from '../core/fullscreen'
import {
  absorbPelletsForAvatar,
  applyFrozenMovement,
  avatarEntityRadius,
  canBeginAvatarTransform,
  canBuildMoreFarms,
  completeAvatarTransform,
  countTribeStructures,
  createStarterStructure,
  getControlledEntity,
  resetAvatarState,
  updateAlly,
  updateFarmStructures,
  updateRanchStructures,
} from '../game/avatar-system'
import {
  FARM_BUILD_COST,
  AVATAR_INITIAL_PELLETS,
  RANCH_BUILD_COST,
  STARTER_FARM_OFFSET,
  STARTER_RANCH_OFFSET,
} from '../game/avatar-config'
import { computeCamera } from '../game/camera'
import { createCircle, isActive, type CircleEntity } from '../game/entity'
import { PLAYER_START_MASS } from '../game/physics'
import { drawPellet, spawnPellets, type Pellet } from '../game/pellet'
import { PLAYER_ROSTER } from '../game/roster'
import { WORLD_HEIGHT, WORLD_WIDTH } from '../game/world'
import { clearScreen, drawAvatarCircle, drawAvatarHud, drawAvatarStructure } from '../ui/draw'

export function createAvatarGameScene(
  app: App,
  _go: (scene: string) => void,
  showPause: (visible: boolean) => void,
  isPaused: () => boolean,
) {
  let entities: CircleEntity[] = []
  let pellets: Pellet[] = []
  let controlledId = 0
  let elapsed = 0
  let absorbFlash = 0

  const reset = () => {
    resetAvatarState()
    const px = WORLD_WIDTH / 2
    const py = WORLD_HEIGHT / 2
    const player = createCircle(px, py, PLAYER_START_MASS, true, PLAYER_ROSTER)
    controlledId = player.id
    const starterFarm = createStarterStructure(
      px + STARTER_FARM_OFFSET.x,
      py + STARTER_FARM_OFFSET.y,
      'farm',
      '初始',
    )
    const starterRanch = createStarterStructure(
      px + STARTER_RANCH_OFFSET.x,
      py + STARTER_RANCH_OFFSET.y,
      'ranch',
      '初始',
    )
    entities = [player, starterFarm, starterRanch]
    pellets = spawnPellets(AVATAR_INITIAL_PELLETS, WORLD_WIDTH, WORLD_HEIGHT, 40)
    elapsed = 0
    absorbFlash = 0
  }

  return {
    enter() {
      reset()
      showPause(false)
      requestAppFullscreen()
      sfx.unlock()
    },
    exit() {
      showPause(false)
    },
    update(dt: number) {
      elapsed += dt
      if (isPaused()) return

      const input = app.input.snapshot()
      if (input.pausePressed) {
        showPause(true)
        return
      }

      const player = getControlledEntity(entities, controlledId)

      if (input.splitPressed && canBeginAvatarTransform(player, 'farm', entities)) {
        const result = completeAvatarTransform(entities, player!, 'farm', controlledId)
        entities = result.entities
        if (result.newControlledId !== null) controlledId = result.newControlledId
        sfx.absorbPellet()
      }

      if (input.gatherPressed && canBeginAvatarTransform(player, 'ranch', entities)) {
        const result = completeAvatarTransform(entities, player!, 'ranch', controlledId)
        entities = result.entities
        if (result.newControlledId !== null) controlledId = result.newControlledId
        sfx.absorbPellet()
      }

      if (player && !player.isFrozen) {
        applyFrozenMovement(player, input.moveX, input.moveY, dt)
      }

      pellets = updateFarmStructures(entities, pellets, dt)
      entities = updateRanchStructures(entities, dt)

      for (const entity of [...entities]) {
        if (entity.avatarRole !== 'ally' || !isActive(entity)) continue
        const result = updateAlly(entity, entities, pellets, dt)
        pellets = result.pellets
        entities = result.entities
        if (result.absorbed.length > 0) absorbFlash = 0.15
      }

      const controlled = getControlledEntity(entities, controlledId)
      if (controlled && isActive(controlled) && !controlled.isFrozen) {
        const absorbed = absorbPelletsForAvatar(controlled, pellets)
        if (absorbed.length > 0) {
          pellets = pellets.filter((p) => !absorbed.some((a) => a.id === p.id))
          absorbFlash = 0.18
          sfx.absorbPellet()
        }
      }

      absorbFlash = Math.max(0, absorbFlash - dt)
    },
    render(ctx: CanvasRenderingContext2D, width: number, height: number) {
      clearScreen(ctx, width, height)

      const controlled = getControlledEntity(entities, controlledId)
      const focusMass = controlled?.mass ?? PLAYER_START_MASS
      const focusX = controlled?.x ?? WORLD_WIDTH / 2
      const focusY = controlled?.y ?? WORLD_HEIGHT / 2
      const cam = computeCamera(focusX, focusY, focusMass, width, height)

      const sorted = [...entities].sort((a, b) => avatarEntityRadius(b) - avatarEntityRadius(a))

      ctx.save()
      ctx.translate(width / 2, height / 2)
      ctx.scale(cam.renderScale, cam.renderScale)
      ctx.translate(-cam.camX, -cam.camY)

      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
      ctx.clip()

      drawWorld(ctx)
      for (const pellet of pellets) drawPellet(ctx, pellet)
      for (const entity of sorted) {
        if (entity.avatarRole === 'farm' || entity.avatarRole === 'ranch') {
          drawAvatarStructure(ctx, entity, elapsed)
        } else {
          const flash = entity.id === controlledId ? absorbFlash : 0
          drawAvatarCircle(ctx, entity, flash, elapsed)
        }
      }
      ctx.restore()
      ctx.restore()

      const tribe = countTribeStructures(entities)
      drawAvatarHud(ctx, width, {
        mass: focusMass,
        zoom: cam.zoom,
        farmReady: (controlled?.mass ?? 0) >= FARM_BUILD_COST && canBuildMoreFarms(entities),
        ranchReady: (controlled?.mass ?? 0) >= RANCH_BUILD_COST,
        farms: tribe.farms,
        ranches: tribe.ranches,
        allies: tribe.allies,
      })
    },
  }
}

function drawWorld(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#0f1828'
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
  ctx.strokeStyle = '#3d5578'
  ctx.lineWidth = 6
  ctx.strokeRect(3, 3, WORLD_WIDTH - 6, WORLD_HEIGHT - 6)

  ctx.strokeStyle = 'rgba(70, 96, 132, 0.18)'
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
