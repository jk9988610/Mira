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
  updateLearnStructures,
  updatePlayStructures,
  updateWorkStructures,
} from '../game/avatar-system'
import { AVATAR_INITIAL_PELLETS, STARTER_OPTIMAL_MASS } from '../game/avatar-config'
import {
  beginProductionPair,
  tryPairProduction,
  updateProductionPairs,
} from '../game/avatar-reproduction'
import { computeCamera } from '../game/camera'
import { createCircle, isActive, isAdult, type CircleEntity, type Gender } from '../game/entity'
import { allyUpdateStride } from '../game/perf-config'
import { removePelletsByIds } from '../game/pellet-util'
import { PLAYER_START_MASS } from '../game/physics'
import { PelletGrid } from '../game/pellet-grid'
import { createTraitPellet, drawPelletsInView, spawnPellets, type Pellet } from '../game/pellet'
import { AI_ROSTER, PLAYER_ROSTER } from '../game/roster'
import { computeViewBounds, isInView } from '../game/viewport'
import { drawWorld } from '../game/world-draw'
import { WORLD_HEIGHT, WORLD_WIDTH } from '../game/world'
import { clearScreen, drawAvatarCircle, drawAvatarHud, drawAvatarStructure } from '../ui/draw'
import { computeTribeDemographics } from '../game/tribe-stats'

type PauseBridge = { fn: (() => void) | null }

function isNpcMobile(entity: CircleEntity): boolean {
  return (
    isActive(entity) &&
    !entity.isFrozen &&
    !entity.isPlayer &&
    (entity.avatarRole === 'none' || entity.avatarRole === 'ally')
  )
}

function circlesTouch(a: CircleEntity, b: CircleEntity): boolean {
  const dist = Math.hypot(a.x - b.x, a.y - b.y)
  return dist < avatarEntityRadius(a) + avatarEntityRadius(b) - 4
}

function updatePlayerMateSeek(player: CircleEntity, entities: CircleEntity[], dt: number): void {
  if (!isAdult(player) || player.productionStage !== 'none' || player.isFrozen) return

  let mate =
    (player.aiMateTargetId > 0
      ? entities.find((e) => e.id === player.aiMateTargetId && isActive(e))
      : null) ?? tryPairProduction(player, entities)

  if (!mate) {
    player.aiMateTargetId = 0
    return
  }

  player.aiMateTargetId = mate.id
  const male = player.gender === 'male' ? player : mate
  const female = player.gender === 'female' ? player : mate

  if (circlesTouch(male, female)) {
    beginProductionPair(male, female)
    player.aiMateTargetId = 0
    return
  }

  const dx = mate.x - player.x
  const dy = mate.y - player.y
  const dist = Math.hypot(dx, dy)
  if (dist <= 1) return
  const speed = 180
  player.x += (dx / dist) * speed * dt
  player.y += (dy / dist) * speed * dt
}

const STARTER_OFFSETS = [
  { x: 0, y: 0 },
  { x: 220, y: -120 },
  { x: -200, y: 100 },
  { x: 160, y: 140 },
]

const STARTER_GENDERS: Gender[] = ['male', 'male', 'female', 'female']

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
    const rosters = [PLAYER_ROSTER, AI_ROSTER[0], AI_ROSTER[9], AI_ROSTER[1]]
    entities = STARTER_OFFSETS.map((offset, i) => {
      const circle = createCircle(
        cx + offset.x,
        cy + offset.y,
        STARTER_OPTIMAL_MASS,
        i === 0,
        rosters[i],
        { gender: STARTER_GENDERS[i], generation: 1, birthGameTimeSec: 0 },
      )
      initOptimalAvatarState(circle, 0)
      return circle
    })
    controlledId = entities[0].id
    pellets = spawnPellets(AVATAR_INITIAL_PELLETS, WORLD_WIDTH, WORLD_HEIGHT, 40)
    for (let i = 0; i < 24; i++) {
      pellets.push(
        createTraitPellet(
          80 + Math.random() * (WORLD_WIDTH - 160),
          80 + Math.random() * (WORLD_HEIGHT - 160),
          i % 2 === 0 ? 'knowledge' : 'joy',
        ),
      )
    }
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

      const splitTrigger = input.splitPressed || (input.splitHeld && !prevSplitHeld)
      const gatherTrigger = input.gatherPressed || (input.gatherHeld && !prevGatherHeld)
      prevSplitHeld = input.splitHeld
      prevGatherHeld = input.gatherHeld

      if (splitTrigger && canBeginAvatarTransform(player, 'work', entities)) {
        const result = completeAvatarTransform(entities, player!, 'work')
        entities = result.entities
        sfx.absorbPellet()
      }

      if (gatherTrigger && player && isAdult(player) && player.productionStage === 'none' && !player.isFrozen) {
        const mate = tryPairProduction(player, entities)
        if (mate) player.aiMateTargetId = mate.id
      }

      if (input.schoolPressed && canBeginAvatarTransform(player, 'learn', entities)) {
        const result = completeAvatarTransform(entities, player!, 'learn')
        entities = result.entities
        sfx.absorbPellet()
      }

      if (input.parkPressed && canBeginAvatarTransform(player, 'play', entities)) {
        const result = completeAvatarTransform(entities, player!, 'play')
        entities = result.entities
        sfx.absorbPellet()
      }

      if (player && !player.isFrozen) {
        applyFrozenMovement(player, input.moveX, input.moveY, dt)
        if (player.aiMateTargetId > 0) updatePlayerMateSeek(player, entities, dt)
      }

      pellets = updateWorkStructures(entities, pellets, pelletGrid, dt)
      pellets = updateLearnStructures(entities, pellets, dt)
      pellets = updatePlayStructures(entities, pellets, dt)
      pelletGrid.rebuild(pellets)

      entities = updateProductionPairs(entities, dt, elapsed)

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

      const movingIds = new Set<number>()
      for (const entity of entities) {
        if (!isActive(entity) || entity.isFrozen) continue
        if (entity.avatarRole === 'work' || entity.avatarRole === 'learn' || entity.avatarRole === 'play') continue
        if (entity.id === player?.id) {
          if (Math.abs(input.moveX) > 0.1 || Math.abs(input.moveY) > 0.1) movingIds.add(entity.id)
          if (entity.aiMateTargetId > 0) movingIds.add(entity.id)
        } else if (isNpcMobile(entity) && entity.aiIntent !== 'idle') {
          movingIds.add(entity.id)
        }
        if (entity.productionStage !== 'none') movingIds.add(entity.id)
      }

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
        if (entity.avatarRole === 'work' || entity.avatarRole === 'learn' || entity.avatarRole === 'play') {
          drawAvatarStructure(ctx, entity, elapsed)
        } else {
          const flash = entity.id === controlledId ? absorbFlash : 0
          drawAvatarCircle(ctx, entity, flash, elapsed)
        }
      }
      ctx.restore()
      ctx.restore()

      const tribe = countTribeStructures(entities)
      const demo = computeTribeDemographics(entities)
      const hints = getAvatarTransformHints(controlled, entities)
      drawAvatarHud(ctx, width, height, {
        gameTimeSec: elapsed,
        zoom: cam.zoom,
        workHint: hints.workHint,
        produceHint: hints.produceHint,
        learnHint: hints.learnHint,
        playHint: hints.playHint,
        work: tribe.work,
        learn: tribe.learn,
        play: tribe.play,
        producing: tribe.producing,
        circles: tribe.circles,
        demographics: demo,
      })
    },
  }
}
