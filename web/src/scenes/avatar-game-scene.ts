import type { App } from '../core/app'
import { sfx } from '../audio/synth'
import { requestAppFullscreen } from '../core/fullscreen'
import {
  absorbPelletsForAvatar,
  applyFrozenMovement,
  avatarEntityRadius,
  canBeginAvatarTransform,
  completeAvatarTransform,
  countTribeStructures,
  getAvatarTransformHints,
  getControlledEntity,
  initOptimalAvatarState,
  resetAvatarState,
  tickAvatarTransformCooldowns,
  tickMobileAvatarVitality,
  updateAlly,
  updateFarmStructures,
  updateRanchStructures,
} from '../game/avatar-system'
import { AVATAR_INITIAL_PELLETS, STARTER_OPTIMAL_MASS } from '../game/avatar-config'
import { computeCamera } from '../game/camera'
import { createCircle, isActive, type CircleEntity } from '../game/entity'
import { allyUpdateStride } from '../game/perf-config'
import { removePelletsByIds } from '../game/pellet-util'
import { PLAYER_START_MASS } from '../game/physics'
import { PelletGrid } from '../game/pellet-grid'
import { drawPelletsInView, spawnPellets, type Pellet } from '../game/pellet'
import { AI_ROSTER, PLAYER_ROSTER } from '../game/roster'
import { computeViewBounds, isInView } from '../game/viewport'
import { drawWorld } from '../game/world-draw'
import { WORLD_HEIGHT, WORLD_WIDTH } from '../game/world'
import { clearScreen, drawAvatarCircle, drawAvatarHud, drawAvatarStructure } from '../ui/draw'

type PauseBridge = { fn: (() => void) | null }

function isNpcMobile(entity: CircleEntity): boolean {
  return (
    isActive(entity) &&
    !entity.isFrozen &&
    !entity.isPlayer &&
    (entity.avatarRole === 'none' || entity.avatarRole === 'ally')
  )
}

const STARTER_OFFSETS = [
  { x: 0, y: 0 },
  { x: 220, y: -120 },
  { x: -200, y: 100 },
  { x: 160, y: 140 },
]

export function createAvatarGameScene(
  app: App,
  _go: (scene: string) => void,
  showPause: (visible: boolean) => void,
  isPaused: () => boolean,
  gamePause: PauseBridge,
) {
  let entities: CircleEntity[] = []
  let pellets: Pellet[] = []
  let controlledId = 0
  let elapsed = 0
  let absorbFlash = 0
  let allyUpdateTick = 0
  let prevSplitHeld = false
  let prevGatherHeld = false
  const pelletGrid = new PelletGrid()

  const syncControlledId = () => {
    const controlled = getControlledEntity(entities, controlledId)
    if (controlled && controlled.id !== controlledId) controlledId = controlled.id
    if (!controlled) {
      const fallback = entities.find(
        (e) => e.isPlayer && isActive(e) && (e.avatarRole === 'none' || e.avatarRole === 'ally'),
      )
      if (fallback) controlledId = fallback.id
    }
  }

  const reset = () => {
    resetAvatarState()
    const cx = WORLD_WIDTH / 2
    const cy = WORLD_HEIGHT / 2
    const rosters = [PLAYER_ROSTER, AI_ROSTER[0], AI_ROSTER[1], AI_ROSTER[2]]
    entities = STARTER_OFFSETS.map((offset, i) => {
      const circle = createCircle(
        cx + offset.x,
        cy + offset.y,
        STARTER_OPTIMAL_MASS,
        i === 0,
        rosters[i],
      )
      initOptimalAvatarState(circle)
      return circle
    })
    controlledId = entities[0].id
    pellets = spawnPellets(AVATAR_INITIAL_PELLETS, WORLD_WIDTH, WORLD_HEIGHT, 40)
    pelletGrid.rebuild(pellets)
    elapsed = 0
    absorbFlash = 0
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
      if (isPaused()) return

      const input = app.input.snapshot()
      if (input.pausePressed) {
        showPause(true)
        return
      }

      tickAvatarTransformCooldowns(entities, dt)

      const player = getControlledEntity(entities, controlledId)
      const movingIds = new Set<number>()
      for (const entity of entities) {
        if (!isActive(entity) || entity.isFrozen) continue
        if (entity.avatarRole === 'farm' || entity.avatarRole === 'ranch') continue
        if (entity.id === player?.id) {
          if (Math.abs(input.moveX) > 0.1 || Math.abs(input.moveY) > 0.1) movingIds.add(entity.id)
        } else if (isNpcMobile(entity)) {
          movingIds.add(entity.id)
        }
      }

      const splitTrigger = input.splitPressed || (input.splitHeld && !prevSplitHeld)
      const gatherTrigger = input.gatherPressed || (input.gatherHeld && !prevGatherHeld)
      prevSplitHeld = input.splitHeld
      prevGatherHeld = input.gatherHeld

      if (splitTrigger && canBeginAvatarTransform(player, 'farm', entities)) {
        const result = completeAvatarTransform(entities, player!, 'farm')
        entities = result.entities
        sfx.absorbPellet()
      }

      if (gatherTrigger && canBeginAvatarTransform(player, 'ranch', entities)) {
        const result = completeAvatarTransform(entities, player!, 'ranch')
        entities = result.entities
        sfx.absorbPellet()
      }

      if (player && !player.isFrozen) {
        applyFrozenMovement(player, input.moveX, input.moveY, dt)
      }

      pellets = updateFarmStructures(entities, pellets, pelletGrid, dt)
      pelletGrid.rebuild(pellets)

      entities = updateRanchStructures(entities, dt)

      allyUpdateTick++
      const allyStride = allyUpdateStride(entities.length)
      for (let i = 0; i < entities.length; i++) {
        if (allyStride > 1 && (i + allyUpdateTick) % allyStride !== 0) continue
        const entity = entities[i]
        if (!isNpcMobile(entity)) continue
        const result = updateAlly(entity, entities, pellets, pelletGrid, dt * allyStride, elapsed)
        pellets = result.pellets
        entities = result.entities
        if (result.absorbed.length > 0) absorbFlash = 0.15
      }

      pelletGrid.rebuild(pellets)

      entities = tickMobileAvatarVitality(entities, dt, movingIds)
      syncControlledId()

      const controlled = getControlledEntity(entities, controlledId)
      if (controlled && isActive(controlled) && !controlled.isFrozen) {
        const absorbed = absorbPelletsForAvatar(controlled, pellets, pelletGrid)
        if (absorbed.length > 0) {
          const absorbedIds = new Set(absorbed.map((p) => p.id))
          pellets = removePelletsByIds(pellets, absorbedIds)
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
      const view = computeViewBounds(cam.camX, cam.camY, cam.renderScale, width, height)

      const sorted = [...entities].sort((a, b) => avatarEntityRadius(b) - avatarEntityRadius(a))

      ctx.save()
      ctx.translate(width / 2, height / 2)
      ctx.scale(cam.renderScale, cam.renderScale)
      ctx.translate(-cam.camX, -cam.camY)

      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
      ctx.clip()

      drawWorld(ctx, view)
      drawPelletsInView(ctx, pellets, view)
      for (const entity of sorted) {
        if (!isInView(entity.x, entity.y, view, 80)) continue
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
      const hints = getAvatarTransformHints(controlled, entities)
      const avatarState =
        controlled?.avatarRole === 'farm'
          ? '化身农场中'
          : controlled?.avatarRole === 'ranch'
            ? '化身牧场中'
            : undefined
      drawAvatarHud(ctx, width, {
        mass: focusMass,
        zoom: cam.zoom,
        farmHint: hints.farm,
        ranchHint: hints.ranch,
        farms: tribe.farms,
        ranches: tribe.ranches,
        circles: tribe.circles,
        lifespanSec: controlled?.lifespanSec,
        hunger: controlled?.hunger,
        absorptionPaused: controlled?.absorptionPaused,
        avatarState,
      })
    },
  }
}
