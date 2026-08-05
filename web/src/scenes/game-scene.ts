import type { App } from '../core/app'
import { sfx } from '../audio/synth'
import { requestAppFullscreen } from '../core/fullscreen'
import {
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
  tickOrderService,
  updateAlly,
  updateFarmStructures,
  updateFortressStructures,
  updateParkStructures,
  updateSchoolStructures,
} from '../game/avatar-system'
import { tickPractitionerEnrollment } from '../game/avatar-practitioner'
import { buildFamilyGenealogies, resetFamilyRegistry } from '../game/family-registry'
import { drawFortressHalos, tickFortressHalos } from '../game/fortress-ray'
import { getActiveHalosOnEntity } from '../game/halo-status'
import { resetPressureField, tickPressureField } from '../game/pressure-field'
import {
  drawResourceZones,
  generateResourceZones,
  resetResourceZones,
  tickResourceZones,
} from '../game/resource-zones'
import { ADULT_AGE_SEC, STARTER_OPTIMAL_MASS } from '../game/avatar-config'
import {
  isPursuingMate,
  syncMateTargets,
  tickMateIntent,
  tickProductionCooldowns,
  updateMatePursuit,
  updateProductionPairs,
} from '../game/avatar-reproduction'
import { computeCamera } from '../game/camera'
import { createCircle, isActive, isAdult, type CircleEntity, type Gender } from '../game/entity'
import { allyUpdateStride } from '../game/perf-config'
import { AI_ROSTER, PLAYER_ROSTER } from '../game/roster'
import { computeViewBounds, isInView } from '../game/viewport'
import { drawWorld } from '../game/world-draw'
import { WORLD_HEIGHT, WORLD_WIDTH } from '../game/world'
import {
  clearScreen,
  clampStatsScroll,
  drawAvatarCircle,
  drawAvatarHud,
  drawAvatarStructure,
  drawMarketHud,
  getStatsContentHeight,
  getStatsPanelRect,
  hitTestStatsButton,
} from '../ui/draw'
import { computeTribeDemographics } from '../game/tribe-stats'
import {
  getFamilyMarketRecords,
  initFamilyMarkets,
  resetFamilyMarkets,
  tickFamilyMarkets,
} from '../game/family-market'
import {
  resetProductionStats,
  summarizeOrders,
  tickProductionStats,
} from '../game/production-stats'
import { drawResourceRays, receiveRaysInRange, tickEmitterBursts, tickResourceRays } from '../game/resource-ray'

type PauseBridge = { fn: (() => void) | null }

function isNpcMobile(entity: CircleEntity): boolean {
  return (
    isActive(entity) &&
    !entity.isFrozen &&
    !entity.isPlayer &&
    (entity.avatarRole === 'none' || entity.avatarRole === 'ally')
  )
}

function isRenderableEntity(entity: CircleEntity): boolean {
  return isActive(entity) || entity.isFrozen
}

function listViewableEntities(entities: CircleEntity[]): CircleEntity[] {
  return entities.filter(isRenderableEntity).sort((a, b) => a.id - b.id)
}

function cycleViewTarget(entities: CircleEntity[], currentId: number, direction: 1 | -1): number {
  const list = listViewableEntities(entities)
  if (list.length === 0) return currentId
  const idx = list.findIndex((e) => e.id === currentId)
  const next = idx < 0 ? 0 : (idx + direction + list.length) % list.length
  return list[next].id
}

const STARTER_OFFSETS = [
  { x: 0, y: 0 },
  { x: 272, y: -152 },
  { x: -248, y: 136 },
  { x: 200, y: 176 },
  { x: -420, y: -240 },
  { x: 440, y: -200 },
  { x: -380, y: 260 },
  { x: 400, y: 300 },
  { x: -140, y: -340 },
  { x: 180, y: 360 },
]

const STARTER_GENDERS: Gender[] = [
  'male',
  'male',
  'female',
  'female',
  'male',
  'female',
  'male',
  'female',
  'male',
  'female',
]

const STARTER_ROSTER_INDICES = [0, 9, 1, 2, 3, 4, 5, 6, 7]

export function createGameScene(
  app: App,
  _go: (scene: string) => void,
  showPause: (visible: boolean) => void,
  isPaused: () => boolean,
  gamePause: PauseBridge,
) {
  let entities: CircleEntity[] = []
  let controlledId = 0
  let viewTargetId = 0
  let elapsed = 0
  let absorbFlash = 0
  let allyUpdateTick = 0
  let prevSplitHeld = false
  let prevGatherHeld = false
  let statsOpen = false
  let statsScrollY = 0
  let lastCanvasWidth = 800
  let lastCanvasHeight = 600

  const syncControlledId = () => {
    const controlled = getControlledEntity(entities, controlledId)
    if (controlled && controlled.id !== controlledId) controlledId = controlled.id
    if (!controlled) {
      const fallback = entities.find(
        (e) => e.isPlayer && isActive(e) && (e.avatarRole === 'none' || e.avatarRole === 'ally'),
      )
      if (fallback) controlledId = fallback.id
    }
    if (!listViewableEntities(entities).some((e) => e.id === viewTargetId)) {
      viewTargetId = controlledId
    }
  }

  const reset = () => {
    resetAvatarState()
    resetFamilyMarkets()
    resetFamilyRegistry()
    resetProductionStats()
    resetPressureField()
    resetResourceZones()
    generateResourceZones()
    statsOpen = false
    statsScrollY = 0
    const cx = WORLD_WIDTH / 2
    const cy = WORLD_HEIGHT / 2
    entities = STARTER_OFFSETS.map((offset, i) => {
      const roster = i === 0 ? PLAYER_ROSTER : AI_ROSTER[STARTER_ROSTER_INDICES[i - 1]]
      const circle = createCircle(
        cx + offset.x,
        cy + offset.y,
        STARTER_OPTIMAL_MASS,
        i === 0,
        roster,
        { gender: STARTER_GENDERS[i], generation: 1, birthGameTimeSec: -ADULT_AGE_SEC },
      )
      initOptimalAvatarState(circle, -ADULT_AGE_SEC)
      return circle
    })
    controlledId = entities[0].id
    viewTargetId = controlledId
    elapsed = 0
    absorbFlash = 0
    initFamilyMarkets(entities)
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

      if (input.viewSelfPressed) {
        viewTargetId = controlledId
      } else if (input.cycleViewPrevPressed) {
        viewTargetId = cycleViewTarget(entities, viewTargetId, -1)
      } else if (input.cycleViewNextPressed) {
        viewTargetId = cycleViewTarget(entities, viewTargetId, 1)
      }

      if (statsOpen) {
        const demo = computeTribeDemographics(entities, elapsed)
        const familyNames = new Map(demo.families.map((f) => [f.familyId, f.familyName]))
        const genealogies = buildFamilyGenealogies(entities, familyNames)
        const familyMarkets = getFamilyMarketRecords()
        const panel = getStatsPanelRect(lastCanvasWidth, lastCanvasHeight)
        const contentHeight = getStatsContentHeight({
          demographics: demo,
          familyMarkets,
          genealogies,
        })
        if (input.scrollDeltaY !== 0) {
          statsScrollY += input.scrollDeltaY * 0.45
        }
        if (Math.abs(input.moveY) > 0.12) {
          statsScrollY += input.moveY * 260 * dt
        }
        statsScrollY = clampStatsScroll(statsScrollY, contentHeight, panel.h)
      }

      tickAvatarTransformCooldowns(entities, dt)

      const player = getControlledEntity(entities, controlledId)
      const viewingSelf = viewTargetId === controlledId

      const splitTrigger = input.splitPressed || (input.splitHeld && !prevSplitHeld)
      const gatherTrigger = input.gatherPressed || (input.gatherHeld && !prevGatherHeld)
      prevSplitHeld = input.splitHeld
      prevGatherHeld = input.gatherHeld

      if (viewingSelf && splitTrigger && canBeginAvatarTransform(player, 'farm', entities, elapsed)) {
        const result = completeAvatarTransform(entities, player!, 'farm', elapsed)
        entities = result.entities
        sfx.absorbPellet()
      }

      if (viewingSelf && gatherTrigger && player && isAdult(player, elapsed) && player.productionStage === 'none') {
        player.mateSeekUrge = Math.min(1, player.mateSeekUrge + 0.35)
      }

      if (viewingSelf && input.schoolPressed && canBeginAvatarTransform(player, 'school', entities, elapsed)) {
        const result = completeAvatarTransform(entities, player!, 'school', elapsed)
        entities = result.entities
        sfx.absorbPellet()
      }

      if (viewingSelf && input.parkPressed && canBeginAvatarTransform(player, 'park', entities, elapsed)) {
        const result = completeAvatarTransform(entities, player!, 'park', elapsed)
        entities = result.entities
        sfx.absorbPellet()
      }

      if (viewingSelf && input.fortressPressed && canBeginAvatarTransform(player, 'fortress', entities, elapsed)) {
        const result = completeAvatarTransform(entities, player!, 'fortress', elapsed)
        entities = result.entities
        sfx.absorbPellet()
      }

      syncMateTargets(entities, elapsed)

      if (viewingSelf && player && player.productionStage === 'none') {
        if (!player.isFrozen) {
          applyFrozenMovement(player, input.moveX, input.moveY, dt)
        }
        updateMatePursuit(player, entities, dt, elapsed, false)
      }

      tickProductionCooldowns(entities, dt)
      tickMateIntent(entities, dt, elapsed)
      tickProductionStats(dt, elapsed)

      tickPressureField(entities, dt)
      tickFamilyMarkets(entities, elapsed, dt)
      tickPractitionerEnrollment(entities, elapsed, dt)

      tickResourceZones(entities, dt)

      updateFarmStructures(entities, dt)
      updateSchoolStructures(entities, dt)
      updateParkStructures(entities, dt)
      updateFortressStructures(entities, dt)
      tickEmitterBursts(entities, dt)
      tickOrderService(entities, dt, elapsed)
      tickResourceRays(entities, dt)
      tickFortressHalos(entities, dt)

      entities = updateProductionPairs(entities, dt, elapsed)

      allyUpdateTick++
      const allyStride = allyUpdateStride(entities.length)
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i]
        const isContractor = entity.marketContractOrderId > 0 || entity.orderServiceTimer > 0
        if (!isNpcMobile(entity)) continue
        if (!isContractor && allyStride > 1 && (i + allyUpdateTick) % allyStride !== 0) continue
        const stepDt = isContractor ? dt : dt * allyStride
        const result = updateAlly(entity, entities, stepDt, elapsed)
        entities = result.entities
      }

      const movingIds = new Set<number>()
      for (const entity of entities) {
        if (!isActive(entity) || entity.isFrozen) continue
        if (
          entity.avatarRole === 'farm' ||
          entity.avatarRole === 'school' ||
          entity.avatarRole === 'park' ||
          entity.avatarRole === 'fortress'
        )
          continue
        if (entity.id === player?.id && viewingSelf) {
          if (Math.abs(input.moveX) > 0.1 || Math.abs(input.moveY) > 0.1) movingIds.add(entity.id)
          if (isPursuingMate(entity, elapsed)) movingIds.add(entity.id)
        } else if (isNpcMobile(entity) && entity.aiIntent !== 'sleep') {
          movingIds.add(entity.id)
        }
        if (entity.productionStage !== 'none') movingIds.add(entity.id)
      }

      entities = tickMobileAvatarVitality(entities, dt, movingIds, elapsed)
      syncControlledId()

      const controlled = getControlledEntity(entities, controlledId)
      if (controlled && isActive(controlled) && !controlled.isFrozen) {
        receiveRaysInRange(controlled, entities, dt)
      }

      absorbFlash = Math.max(0, absorbFlash - dt)
    },
    render(ctx: CanvasRenderingContext2D, width: number, height: number) {
      lastCanvasWidth = width
      lastCanvasHeight = height
      clearScreen(ctx, width, height)

      const controlled = getControlledEntity(entities, controlledId)
      const viewTarget = entities.find((e) => e.id === viewTargetId) ?? controlled
      const focusX = viewTarget?.x ?? WORLD_WIDTH / 2
      const focusY = viewTarget?.y ?? WORLD_HEIGHT / 2
      const cam = computeCamera(focusX, focusY, STARTER_OPTIMAL_MASS, width, height)
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
      drawResourceZones(ctx, view)
      drawResourceRays(ctx, entities, elapsed)
      drawFortressHalos(ctx, entities, elapsed)
      for (const entity of sorted) {
        if (!isInView(entity.x, entity.y, view, 80)) continue
        if (
          entity.avatarRole === 'farm' ||
          entity.avatarRole === 'school' ||
          entity.avatarRole === 'park' ||
          entity.avatarRole === 'fortress'
        ) {
          drawAvatarStructure(ctx, entity, elapsed)
        } else if (isActive(entity)) {
          const flash = entity.id === controlledId ? absorbFlash : 0
          drawAvatarCircle(ctx, entity, flash, elapsed)
        }
      }
      ctx.restore()
      ctx.restore()

      const tribe = countTribeStructures(entities)
      const demo = computeTribeDemographics(entities, elapsed)
      const hints = getAvatarTransformHints(controlled, entities, elapsed)
      const familyMarkets = getFamilyMarketRecords()
      const familyNames = new Map(demo.families.map((f) => [f.familyId, f.familyName]))
      const genealogies = buildFamilyGenealogies(entities, familyNames)
      const viewHalos = viewTarget ? getActiveHalosOnEntity(viewTarget, entities) : []
      const observingOther = viewTargetId !== controlledId
      const orderStats = summarizeOrders(familyMarkets)
      const hudData = {
        gameTimeSec: elapsed,
        zoom: cam.zoom,
        farmHint: hints.farmHint,
        produceHint: hints.produceHint,
        schoolHint: hints.schoolHint,
        parkHint: hints.parkHint,
        fortressHint: hints.fortressHint,
        farm: tribe.farm,
        school: tribe.school,
        park: tribe.park,
        fortress: tribe.fortress,
        producing: tribe.producing,
        circles: tribe.circles,
        demographics: demo,
        familyMarkets,
        entities,
        statsOpen,
        statsScrollY,
        genealogies,
        orderStats,
        viewTargetName: viewTarget?.name ?? '—',
        observingOther,
        activeHalos: viewHalos,
      }
      drawAvatarHud(ctx, width, height, hudData)
      drawMarketHud(ctx, width, height, hudData)
    },
    onTap(x: number, y: number, width: number, _height: number) {
      if (hitTestStatsButton(x, y, width)) {
        statsOpen = !statsOpen
        if (!statsOpen) statsScrollY = 0
      }
    },
  }
}
