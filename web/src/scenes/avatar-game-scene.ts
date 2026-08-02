import type { App } from '../core/app'
import { sfx } from '../audio/synth'
import { requestAppFullscreen } from '../core/fullscreen'
import {
  applyFrozenMovement,
  beginAvatarTransform,
  canBeginAvatarTransform,
  countTribeStructures,
  getControlledEntity,
  resetAvatarState,
  updateAlly,
  updateAvatarIncubation,
  updateFarmStructures,
  updateRanchStructures,
} from '../game/avatar-system'
import {
  AVATAR_FARM_MASS_THRESHOLD,
  AVATAR_INITIAL_PELLETS,
  AVATAR_RANCH_MASS_THRESHOLD,
} from '../game/avatar-config'
import { computeCamera } from '../game/camera'
import { absorbPelletsForEntity } from '../game/collision'
import { createCircle, drawCircleEntity, isActive, type CircleEntity } from '../game/entity'
import { PLAYER_START_MASS } from '../game/physics'
import { drawPellet, spawnPellets, type Pellet } from '../game/pellet'
import { PLAYER_ROSTER } from '../game/roster'
import { WORLD_HEIGHT, WORLD_WIDTH } from '../game/world'
import { clearScreen, drawAvatarHud, drawAvatarStructure } from '../ui/draw'

export function createAvatarGameScene(
  app: App,
  go: (scene: string) => void,
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
    const player = createCircle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, PLAYER_START_MASS, true, PLAYER_ROSTER)
    controlledId = player.id
    entities = [player]
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
      if (input.backPressed) {
        go('menu')
        return
      }

      const player = getControlledEntity(entities, controlledId)

      if (input.splitPressed && canBeginAvatarTransform(player, 'farm')) {
        beginAvatarTransform(player!, 'farm')
        sfx.absorbPellet()
      }

      if (input.gatherPressed && canBeginAvatarTransform(player, 'ranch')) {
        beginAvatarTransform(player!, 'ranch')
        sfx.absorbPellet()
      }

      if (player && !player.isFrozen && player.avatarIncubateTimer <= 0) {
        applyFrozenMovement(player, input.moveX, input.moveY, dt)
      }

      for (const entity of entities) {
        if (entity.invincibleTimer > 0) {
          entity.invincibleTimer = Math.max(0, entity.invincibleTimer - dt)
        }
      }

      const incubation = updateAvatarIncubation(entities, controlledId, dt)
      entities = incubation.entities
      if (incubation.newControlledId !== null) {
        controlledId = incubation.newControlledId
        sfx.respawn()
      }

      pellets = updateFarmStructures(entities, pellets, dt)
      entities = updateRanchStructures(entities, dt)

      for (const entity of entities) {
        if (entity.avatarRole !== 'ally' || !isActive(entity)) continue
        const result = updateAlly(entity, pellets, dt)
        pellets = result.pellets
        if (result.absorbed.length > 0) absorbFlash = 0.15
      }

      const controlled = getControlledEntity(entities, controlledId)
      if (controlled && isActive(controlled) && !controlled.isFrozen) {
        const absorbed = absorbPelletsForEntity(controlled, pellets)
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

      const sorted = [...entities].sort((a, b) => b.mass - a.mass)

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
          drawCircleEntity(ctx, entity, flash, elapsed)
        }
      }
      ctx.restore()
      ctx.restore()

      const tribe = countTribeStructures(entities)
      drawAvatarHud(ctx, width, {
        mass: focusMass,
        zoom: cam.zoom,
        farmReady: (controlled?.mass ?? 0) >= AVATAR_FARM_MASS_THRESHOLD,
        ranchReady: (controlled?.mass ?? 0) >= AVATAR_RANCH_MASS_THRESHOLD,
        incubating: (controlled?.avatarIncubateTimer ?? 0) > 0,
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
