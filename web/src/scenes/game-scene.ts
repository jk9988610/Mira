import type { App } from '../core/app'
import { sfx } from '../audio/synth'
import { requestAppFullscreen } from '../core/fullscreen'
import {
  avatarEntityRadius,
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
import {
  paletteFromFamilySeed,
  registerFamily,
  resetFamilyColors,
} from '../game/family-colors'
import { buildFamilyGenealogies, resetFamilyRegistry } from '../game/family-registry'
import { drawFortressHalos, tickFortressHalos } from '../game/fortress-ray'
import { resetPressureField, summarizePressureField, tickPressureField } from '../game/pressure-field'
import {
  drawResourceZones,
  generateResourceZones,
  resetResourceZones,
  tickResourceZones,
} from '../game/resource-zones'
import { ADULT_AGE_SEC, STARTER_OPTIMAL_MASS } from '../game/avatar-config'
import {
  syncMateTargets,
  tickMateIntent,
  tickProductionCooldowns,
  updateProductionPairs,
} from '../game/avatar-reproduction'
import { computeCamera } from '../game/camera'
import { createCircle, isActive, type CircleEntity } from '../game/entity'
import { allyUpdateStride } from '../game/perf-config'
import { computeViewBounds, isInView } from '../game/viewport'
import { drawWorld } from '../game/world-draw'
import { WORLD_HEIGHT, WORLD_WIDTH } from '../game/world'
import {
  clearScreen,
  drawAvatarCircle,
  drawAvatarHud,
  drawAvatarStructure,
  drawStatsButton,
  hitTestStatsButton,
} from '../ui/draw'
import {
  clampStatsScroll,
  drawStatsFullscreenOverlay,
  getStatsPageContentHeight,
  hitTestStatsClose,
  hitTestStatsTab,
  STATS_PAGE_COUNT,
  type StatsOverlayData,
} from '../ui/stats-overlay'
import { computeTribeDemographics } from '../game/tribe-stats'
import {
  getFamilyEnrollmentBoosts,
  getFamilyMarketRecords,
  initFamilyMarkets,
  resetFamilyMarkets,
  tickFamilyMarkets,
} from '../game/family-market'
import { summarizeOrders } from '../game/production-stats'
import { drawResourceRays, tickEmitterBursts, tickResourceRays } from '../game/resource-ray'
import { initOptimalAvatarState } from '../game/avatar-vitality'
import {
  formatFullName,
  randomGivenName,
  randomParentPair,
  randomSurname,
} from '../game/naming'
import { createPointerTapHandler, isTap, type PointerPoint } from '../input/touch-gestures'

type PauseBridge = { fn: (() => void) | null }

const CAMERA_PAN_SPEED = 400
const TOUCH_PAN_SCALE = 1.35

const FAMILY_COUNT = 4
const STARTER_COUNT = FAMILY_COUNT * 2

function buildStarterOffsets(count: number): Array<{ x: number; y: number }> {
  const result: Array<{ x: number; y: number }> = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  const radius = 520
  for (let i = 0; i < count; i++) {
    const r = radius * Math.sqrt((i + 0.5) / count)
    const angle = i * golden
    result.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r })
  }
  return result
}

const STARTER_OFFSETS = buildStarterOffsets(STARTER_COUNT)

function isNpcMobile(entity: CircleEntity): boolean {
  return (
    isActive(entity) &&
    !entity.isFrozen &&
    (entity.avatarRole === 'none' || entity.avatarRole === 'ally')
  )
}

export function createGameScene(
  app: App,
  _go: (scene: string) => void,
  showPause: (visible: boolean) => void,
  isPaused: () => boolean,
  gamePause: PauseBridge,
) {
  let entities: CircleEntity[] = []
  let cameraX = WORLD_WIDTH / 2
  let cameraY = WORLD_HEIGHT / 2
  let elapsed = 0
  let allyUpdateTick = 0
  let statsOpen = false
  let statsPage = 0
  let statsScrollY = 0
  let lastCanvasWidth = 800
  let lastCanvasHeight = 600

  const pointerStarts = new Map<number, PointerPoint>()
  let panPointerId: number | null = null
  let panLast: PointerPoint | null = null
  let scrollPointerId: number | null = null
  let scrollLastY = 0

  const closeStats = () => {
    statsOpen = false
    statsPage = 0
    statsScrollY = 0
  }

  const openStats = () => {
    statsOpen = true
    statsPage = 0
    statsScrollY = 0
  }

  const measureStatsScroll = (): { contentH: number; pageHeight: number } => {
    const margin = Math.max(16, lastCanvasWidth * 0.04)
    const contentW = lastCanvasWidth - margin * 2
    const contentH = lastCanvasHeight - 72 - 40
    const canvas = document.createElement('canvas')
    const measureCtx = canvas.getContext('2d')
    if (!measureCtx) return { contentH, pageHeight: 0 }
    const data = buildStatsData()
    const pageHeight = getStatsPageContentHeight(data, statsPage, contentW, measureCtx)
    return { contentH, pageHeight }
  }

  const applyStatsScrollDelta = (deltaY: number) => {
    const { contentH, pageHeight } = measureStatsScroll()
    statsScrollY = clampStatsScroll(statsScrollY + deltaY, pageHeight, contentH)
  }

  const reset = () => {
    resetAvatarState()
    resetFamilyMarkets()
    resetFamilyRegistry()
    resetFamilyColors()
    resetPressureField()
    resetResourceZones()
    generateResourceZones()
    statsOpen = false
    statsPage = 0
    statsScrollY = 0
    cameraX = WORLD_WIDTH / 2
    cameraY = WORLD_HEIGHT / 2
    pointerStarts.clear()
    panPointerId = null
    panLast = null
    scrollPointerId = null
    const cx = WORLD_WIDTH / 2
    const cy = WORLD_HEIGHT / 2
    entities = []
    for (let f = 0; f < FAMILY_COUNT; f++) {
      const seed = f * 7919 + 1337
      const surname = randomSurname(seed)
      const maleName = formatFullName(surname, randomGivenName(seed + 1))
      const femaleName = formatFullName(surname, randomGivenName(seed + 5))
      const parents = randomParentPair(seed + 99)
      const palette = paletteFromFamilySeed(seed)
      const maleOffset = STARTER_OFFSETS[f * 2]
      const femaleOffset = STARTER_OFFSETS[f * 2 + 1]

      const male = createCircle(
        cx + maleOffset.x,
        cy + maleOffset.y,
        STARTER_OPTIMAL_MASS,
        false,
        { name: maleName, ...palette },
        {
          gender: 'male',
          generation: 1,
          birthGameTimeSec: -ADULT_AGE_SEC,
          parentFatherName: parents.father,
          parentMotherName: parents.mother,
        },
      )
      const female = createCircle(
        cx + femaleOffset.x,
        cy + femaleOffset.y,
        STARTER_OPTIMAL_MASS,
        false,
        { name: femaleName, ...palette },
        {
          gender: 'female',
          generation: 1,
          familyId: male.id,
          birthGameTimeSec: -ADULT_AGE_SEC,
          parentFatherName: parents.father,
          parentMotherName: parents.mother,
        },
      )
      registerFamily(male.id, `${surname}家族`, palette)
      initOptimalAvatarState(male, -ADULT_AGE_SEC)
      initOptimalAvatarState(female, -ADULT_AGE_SEC)
      entities.push(male, female)
    }
    elapsed = 0
    initFamilyMarkets(entities)
  }

  const buildStatsData = (): StatsOverlayData => {
    const demo = computeTribeDemographics(entities, elapsed)
    const familyMarkets = getFamilyMarketRecords()
    const familyNames = new Map(demo.families.map((f) => [f.familyId, f.familyName]))
    return {
      gameTimeSec: elapsed,
      page: statsPage,
      scrollY: statsScrollY,
      demographics: demo,
      familyMarkets,
      genealogies: buildFamilyGenealogies(entities, familyNames),
      orderStats: summarizeOrders(familyMarkets),
      entities,
    }
  }

  const handleStatsKeyboard = (dt: number) => {
    const input = app.input.snapshot()
    if (input.backPressed) {
      closeStats()
      return
    }
    if (input.statsPagePrevPressed) {
      statsPage = (statsPage - 1 + STATS_PAGE_COUNT) % STATS_PAGE_COUNT
      statsScrollY = 0
    }
    if (input.statsPageNextPressed) {
      statsPage = (statsPage + 1) % STATS_PAGE_COUNT
      statsScrollY = 0
    }

    if (input.scrollDeltaY !== 0) {
      applyStatsScrollDelta(input.scrollDeltaY * 0.5)
    }
    if (Math.abs(input.moveY) > 0.12) {
      applyStatsScrollDelta(input.moveY * 280 * dt)
    }
  }

  const simulateWorld = (dt: number) => {
    tickAvatarTransformCooldowns(entities, dt)
    syncMateTargets(entities, elapsed)
    tickProductionCooldowns(entities, dt)
    tickMateIntent(entities, dt, elapsed)
    tickPressureField(entities, dt)
    tickFamilyMarkets(entities, elapsed, dt)
    tickPractitionerEnrollment(entities, elapsed, dt, getFamilyEnrollmentBoosts())
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
      if (isNpcMobile(entity) && entity.aiIntent !== 'sleep') movingIds.add(entity.id)
      if (entity.productionStage !== 'none') movingIds.add(entity.id)
    }

    entities = tickMobileAvatarVitality(entities, dt, movingIds, elapsed)
  }

  const tapHandler = createPointerTapHandler((x, y, width) => {
    if (isPaused()) return

    if (statsOpen) {
      if (hitTestStatsClose(x, y, width)) {
        closeStats()
        return
      }
      const tab = hitTestStatsTab(x, y, width)
      if (tab !== null) {
        statsPage = tab
        statsScrollY = 0
      }
      return
    }

    if (hitTestStatsButton(x, y, width)) {
      openStats()
    }
  })

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
      const input = app.input.snapshot()

      if (statsOpen) {
        handleStatsKeyboard(dt)
        return
      }

      if (input.pausePressed) {
        showPause(true)
        return
      }

      if (isPaused()) return

      elapsed += dt

      if (panPointerId !== null && panLast) {
        // 触屏拖拽在 pointermove 中更新相机，此处仅处理键盘/手柄
      } else {
        cameraX += input.moveX * CAMERA_PAN_SPEED * dt
        cameraY += input.moveY * CAMERA_PAN_SPEED * dt
      }

      const camPreview = computeCamera(
        cameraX,
        cameraY,
        STARTER_OPTIMAL_MASS,
        lastCanvasWidth,
        lastCanvasHeight,
      )
      cameraX = camPreview.camX
      cameraY = camPreview.camY

      simulateWorld(dt)
    },
    render(ctx: CanvasRenderingContext2D, width: number, height: number) {
      lastCanvasWidth = width
      lastCanvasHeight = height
      clearScreen(ctx, width, height)

      const cam = computeCamera(cameraX, cameraY, STARTER_OPTIMAL_MASS, width, height)
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
          drawAvatarCircle(ctx, entity, 0, elapsed)
        }
      }
      ctx.restore()
      ctx.restore()

      const demo = computeTribeDemographics(entities, elapsed)
      const pressure = summarizePressureField(entities)
      const familyMarkets = getFamilyMarketRecords()
      const familyFunds = new Map(familyMarkets.map((m) => [m.familyId, Math.floor(m.funds)]))
      drawAvatarHud(ctx, width, height, {
        gameTimeSec: elapsed,
        cameraX: Math.round(cameraX),
        cameraY: Math.round(cameraY),
        demographics: demo,
        pressureSummary: pressure,
        familyFunds,
      })
      drawStatsButton(ctx, width, statsOpen)

      if (statsOpen) {
        drawStatsFullscreenOverlay(ctx, width, height, buildStatsData())
      }
    },
    onPointerDown(x: number, y: number, width: number, height: number, pointerId: number) {
      if (isPaused()) return
      pointerStarts.set(pointerId, { x, y })
      tapHandler.onPointerDown(x, y, width, height, pointerId)

      if (statsOpen) {
        scrollPointerId = pointerId
        scrollLastY = y
        return
      }

      panPointerId = pointerId
      panLast = { x, y }
    },
    onPointerMove(x: number, y: number, width: number, height: number, pointerId: number) {
      if (isPaused()) return

      if (statsOpen && scrollPointerId === pointerId) {
        const dy = y - scrollLastY
        scrollLastY = y
        if (Math.abs(dy) > 0.5) {
          applyStatsScrollDelta(-dy)
        }
        return
      }

      if (!statsOpen && panPointerId === pointerId && panLast) {
        const dx = x - panLast.x
        const dy = y - panLast.y
        panLast = { x, y }
        const cam = computeCamera(cameraX, cameraY, STARTER_OPTIMAL_MASS, width, height)
        cameraX -= (dx / cam.renderScale) * TOUCH_PAN_SCALE
        cameraY -= (dy / cam.renderScale) * TOUCH_PAN_SCALE
      }
    },
    onPointerUp(x: number, y: number, width: number, height: number, pointerId: number) {
      const start = pointerStarts.get(pointerId)
      pointerStarts.delete(pointerId)

      if (scrollPointerId === pointerId) {
        scrollPointerId = null
      }
      if (panPointerId === pointerId) {
        panPointerId = null
        panLast = null
      }

      if (start && isTap(start, { x, y })) {
        tapHandler.onPointerUp(x, y, width, height, pointerId)
      }
    },
  }
}
