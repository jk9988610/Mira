import { SATIETY_CAP } from '../game/avatar-config'
import { intentLabel } from '../game/avatar-ai'
import { formatCitizenId } from '../game/citizen-id'
import { formatDnaFingerprint } from '../game/dna'
import { massLabel, satietyEvalLabel } from '../game/avatar-needs'
import { happinessEvalLabel, knowledgeEvalLabel } from '../game/avatar-vitality'
import { getAvatarTransformCountdownSec } from '../game/avatar-system'
import { healthLabel } from '../game/avatar-mass'
import { avatarEntityRadius } from '../game/avatar-radius'
import type { ActiveHalo } from '../game/halo-status'
import type { TribeDemographics } from '../game/tribe-stats'
import type { FamilyMarketRecord } from '../game/family-market'
import { ORDER_DEMAND_LABEL } from '../game/family-market'
import type { FamilyGenealogy } from '../game/family-registry'
import { formatGenealogyLine } from '../game/family-registry'
import type { OrderStatsSummary } from '../game/production-stats'
import { listAllOrders } from '../game/production-stats'
import type { TransformKind } from '../game/entity'
import { formatGameTime } from '../game/game-clock'
import { formatLatLng } from '../game/geo'
import { generationLabel } from '../game/naming'
import type { AvatarRole, CircleEntity } from '../game/entity'
import { isJuvenile, secondsUntilAdult } from '../game/entity'
import { ENTITY_SIMPLE_DRAW_RADIUS } from '../game/perf-config'

export function clearScreen(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, '#0d1321')
  gradient.addColorStop(1, '#070b12')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
}

export function drawTitle(
  ctx: CanvasRenderingContext2D,
  width: number,
  title: string,
  subtitle?: string,
): void {
  ctx.textAlign = 'center'
  ctx.fillStyle = '#e8f0ff'
  ctx.font = 'bold 48px system-ui, sans-serif'
  ctx.fillText(title, width / 2, 96)
  if (subtitle) {
    ctx.fillStyle = '#7f8ca3'
    ctx.font = '18px system-ui, sans-serif'
    ctx.fillText(subtitle, width / 2, 132)
  }
}

export function drawMenuItem(
  ctx: CanvasRenderingContext2D,
  width: number,
  y: number,
  label: string,
  focused: boolean,
): void {
  const itemWidth = 320
  const itemHeight = 52
  const x = (width - itemWidth) / 2

  if (focused) {
    ctx.fillStyle = 'rgba(88, 166, 255, 0.18)'
    ctx.strokeStyle = '#58a6ff'
    ctx.lineWidth = 2
    roundRect(ctx, x, y, itemWidth, itemHeight, 12)
    ctx.fill()
    ctx.stroke()
  }

  ctx.textAlign = 'center'
  ctx.fillStyle = focused ? '#ffffff' : '#b8c2d6'
  ctx.font = focused ? '600 22px system-ui, sans-serif' : '22px system-ui, sans-serif'
  ctx.fillText(label, width / 2, y + 34)
}

export function drawHint(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  text: string,
): void {
  ctx.textAlign = 'center'
  ctx.fillStyle = '#5f6d86'
  ctx.font = '14px system-ui, sans-serif'
  ctx.fillText(text, width / 2, height - 28)
}

export function drawBindingRow(
  ctx: CanvasRenderingContext2D,
  width: number,
  y: number,
  label: string,
  value: string,
  focused: boolean,
  listening: boolean,
): void {
  const rowWidth = Math.min(560, width - 48)
  const x = (width - rowWidth) / 2
  const rowHeight = 48

  if (focused) {
    ctx.fillStyle = listening ? 'rgba(255, 196, 77, 0.16)' : 'rgba(88, 166, 255, 0.14)'
    ctx.strokeStyle = listening ? '#ffc44d' : '#58a6ff'
    ctx.lineWidth = 2
    roundRect(ctx, x, y, rowWidth, rowHeight, 10)
    ctx.fill()
    ctx.stroke()
  }

  ctx.textAlign = 'left'
  ctx.fillStyle = '#d7e0f2'
  ctx.font = '18px system-ui, sans-serif'
  ctx.fillText(label, x + 16, y + 30)

  ctx.textAlign = 'right'
  ctx.fillStyle = listening ? '#ffc44d' : '#8aa0c8'
  ctx.font = '600 18px system-ui, sans-serif'
  ctx.fillText(listening ? '请按键…' : value, x + rowWidth - 16, y + 30)
}

export function drawGamepadBanner(
  ctx: CanvasRenderingContext2D,
  width: number,
  status: { apiAvailable: boolean; connected: boolean; activated: boolean; id: string },
): void {
  let text: string
  let color: string

  if (!status.apiAvailable) {
    text = '当前浏览器不支持 Gamepad API，请使用 Chrome 或安装 APK'
    color = '#ff8f8f'
  } else if (!status.connected) {
    text = '未检测到手柄：请先在系统蓝牙中配对，然后按手柄任意键'
    color = '#ffc44d'
  } else if (!status.activated) {
    text = '已连接手柄，请按任意键激活（Android Chrome 安全要求）'
    color = '#ffc44d'
  } else {
    text = `手柄已就绪：${status.id || '已连接'}`
    color = '#7ddea8'
  }

  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(8, 12, 20, 0.78)'
  const padding = 12
  ctx.font = '14px system-ui, sans-serif'
  const textWidth = Math.min(ctx.measureText(text).width, width - 48)
  const boxW = textWidth + padding * 2
  const x = (width - boxW) / 2
  const y = 148
  roundRect(ctx, x, y, boxW, 32, 8)
  ctx.fill()
  ctx.fillStyle = color
  ctx.fillText(text, width / 2, y + 21)
}

export interface AvatarHudData {
  gameTimeSec: number
  zoom: number
  farmHint: string
  produceHint: string
  schoolHint: string
  parkHint: string
  fortressHint: string
  farm: number
  school: number
  park: number
  fortress: number
  producing: number
  circles: number
  demographics: TribeDemographics
  familyMarkets: FamilyMarketRecord[]
  entities: CircleEntity[]
  statsOpen: boolean
  statsScrollY: number
  genealogies: FamilyGenealogy[]
  orderStats: OrderStatsSummary
  viewTargetName: string
  observingOther: boolean
  activeHalos: ActiveHalo[]
}

export function getStatsButtonRect(width: number): { x: number; y: number; w: number; h: number } {
  return { x: width - 96, y: 12, w: 80, h: 28 }
}

export function hitTestStatsButton(x: number, y: number, width: number): boolean {
  const rect = getStatsButtonRect(width)
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
}

function avatarRoleStatus(role: AvatarRole, isFrozen: boolean, productionStage: CircleEntity['productionStage']): string | null {
  if (productionStage === 'active') return '生产'
  if (isFrozen && role === 'farm') return '化身·农场'
  if (isFrozen && role === 'school') return '化身·校园'
  if (isFrozen && role === 'park') return '化身·乐园'
  if (isFrozen && role === 'fortress') return '化身·堡垒'
  if (role === 'ally') return '后代'
  return null
}

function formatAgeLine(entity: CircleEntity, ageSec: number, gameTimeSec: number): string {
  if (isJuvenile(entity, gameTimeSec)) {
    const remain = Math.ceil(secondsUntilAdult(entity, gameTimeSec))
    return `年龄 ${ageSec}s · 未成年（${remain}s后成年）`
  }
  return `年龄 ${ageSec}s · 成年`
}

export function drawAvatarEntityStats(
  ctx: CanvasRenderingContext2D,
  entity: CircleEntity,
  gameTimeSec: number,
): void {
  const r = avatarEntityRadius(entity)
  const roleStatus = avatarRoleStatus(entity.avatarRole, entity.isFrozen, entity.productionStage)
  const ageSec = Math.max(0, Math.floor(gameTimeSec - entity.birthGameTimeSec))
  const lines = [
    `身份证 ${formatCitizenId(entity)}`,
    `DNA ${formatDnaFingerprint(entity.dnaFingerprint)}`,
    `${entity.name} · ${entity.gender === 'male' ? '男' : '女'} · ${generationLabel(entity.generation)}`,
    formatAgeLine(entity, ageSec, gameTimeSec),
    `出生 ${formatGameTime(entity.birthGameTimeSec)}`,
    `出生地 (${Math.round(entity.birthX)}, ${Math.round(entity.birthY)})`,
    `位置 ${formatLatLng(entity.lat, entity.lng)}`,
    `质量 ${Math.round(entity.mass)} (${massLabel(entity.mass)})`,
    `饱食 ${Math.round(entity.satiety)}/${Math.round(SATIETY_CAP)} (${satietyEvalLabel(entity)})`,
    `知识 ${Math.round(entity.knowledge)} (${knowledgeEvalLabel(entity.knowledge)})`,
    `快乐 ${Math.round(entity.joy)} (${happinessEvalLabel(entity.joy)})`,
    `健康 ${Math.round(entity.health)} ${healthLabel(entity.health)}`,
    `压力 ${entity.pressureFelt.toFixed(1)} · 敌压 ${entity.hostilePressureFelt.toFixed(1)}`,
    `寿命 ${Math.ceil(entity.lifespanSec)}s`,
    `化身者注册 农场${entity.countFarmPractitionerRegs} 校园${entity.countSchoolPractitionerRegs}`,
    `              乐园${entity.countParkPractitionerRegs} 堡垒${entity.countFortressPractitionerRegs}`,
  ]
  const countdown = getAvatarTransformCountdownSec(entity)
  if (countdown !== null) lines.push(`结束化身 ${Math.ceil(countdown)}s`)
  if (roleStatus) lines.push(roleStatus)
  if (entity.avatarRole === 'none' || entity.avatarRole === 'ally') {
    lines.push(`意图 ${intentLabel(entity, gameTimeSec)}`)
  }

  const lineHeight = 12
  const boxWidth = 168
  const boxHeight = lines.length * lineHeight + 8
  const x = entity.x - boxWidth / 2
  const y = entity.y + r + 10

  ctx.save()
  ctx.fillStyle = 'rgba(8, 12, 20, 0.78)'
  roundRect(ctx, x, y, boxWidth, boxHeight, 6)
  ctx.fill()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.font = '11px system-ui, sans-serif'
  lines.forEach((line, index) => {
    const isHighlight = index <= 3 || line.startsWith('意图') || line.startsWith('结束化身')
    ctx.fillStyle = isHighlight ? '#8fd3ff' : '#b8c4dc'
    ctx.fillText(line, entity.x, y + 4 + index * lineHeight)
  })
  ctx.restore()
}

export function drawAvatarCircle(
  ctx: CanvasRenderingContext2D,
  entity: CircleEntity,
  flash = 0,
  _time = 0,
): void {
  const r = avatarEntityRadius(entity)
  const { x, y, colorLight, colorDark, strokeColor, name } = entity

  ctx.save()

  if (entity.productionStage !== 'none') {
    ctx.beginPath()
    ctx.arc(x, y, r + 6, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255, 158, 207, 0.75)'
    ctx.lineWidth = 3
    ctx.stroke()
  }

  if (flash > 0) {
    ctx.beginPath()
    ctx.arc(x, y, r + 8 * flash, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(143, 211, 255, ${0.35 * flash / 0.18})`
    ctx.fill()
  }

  if (r < ENTITY_SIMPLE_DRAW_RADIUS) {
    ctx.fillStyle = colorLight
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = 1.5
    ctx.stroke()
    drawAvatarEntityStats(ctx, entity, _time)
    ctx.restore()
    return
  }

  const gradient = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r)
  gradient.addColorStop(0, colorLight)
  gradient.addColorStop(1, colorDark)
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = 2
  ctx.stroke()

  if (r > 18) {
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.font = `600 ${Math.min(16, r * 0.38)}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(name, x, y)
  }

  drawAvatarEntityStats(ctx, entity, _time)
  ctx.restore()
}

export function drawAvatarHud(
  ctx: CanvasRenderingContext2D,
  width: number,
  _height: number,
  data: AvatarHudData,
): void {
  const demo = data.demographics
  const hint = `${data.farmHint} · ${data.produceHint} · ${data.schoolHint} · ${data.parkHint} · ${data.fortressHint}`
  const practitionerLine = demo.practitionerByFamily
    .map(
      (fam) =>
        `${fam.familyName} 农${fam.farm} 校${fam.school} 乐${fam.park} 堡${fam.fortress}`,
    )
    .join(' · ')
  const tribe = practitionerLine
    ? `活跃化身者 ${practitionerLine}`
    : `活跃化身者 农${demo.practitionerFarm} 校${demo.practitionerSchool} 乐${demo.practitionerPark} 堡${demo.practitionerFortress}`
  const demoLine = `成年 男${demo.adultMale} 女${demo.adultFemale} · 未成年 男${demo.juvenileMale} 女${demo.juvenileFemale}`

  ctx.textAlign = 'left'
  ctx.font = '12px system-ui, sans-serif'

  let y = 16
  const drawPanel = (text: string, h = 24) => {
    ctx.fillStyle = 'rgba(8, 12, 20, 0.78)'
    roundRect(ctx, 16, y, Math.min(ctx.measureText(text).width + 20, width - 32), h, 8)
    ctx.fill()
    ctx.fillStyle = '#8aa0c8'
    ctx.fillText(text, 26, y + 16)
    y += h + 6
  }

  drawPanel(`时间 ${formatGameTime(data.gameTimeSec)} · 玩家 蓝天`)
  if (data.observingOther) {
    drawPanel(`观察视角 · ${data.viewTargetName}（LB/RB 切换 · LB+RB 回自己）`, 28)
  } else {
    drawPanel(`视角 · ${data.viewTargetName}（LB/RB 切换 · LB+RB 回自己）`, 28)
  }
  const haloText =
    data.activeHalos.length > 0
      ? data.activeHalos.map((h) => h.label).join(' · ')
      : '无光环'
  drawPanel(`光环 ${haloText}`, 28)
  drawPanel(hint, 28)
  drawPanel(tribe)
  drawPanel(demoLine)

  for (const fam of demo.families) {
    const market = data.familyMarkets.find((m) => m.familyId === fam.familyId)
    if (market) {
      const chief = data.entities.find((e) => e.id === market.chiefId)
      const chiefId = chief ? formatCitizenId(chief) : '—'
      drawPanel(
        `${fam.familyName} · 资金 ${Math.floor(market.funds)} · 族长 ${market.chiefName}（${chiefId}）`,
        28,
      )
    } else {
      drawPanel(`${fam.familyName}，后代 ${fam.offspringCount}`)
    }
  }
}

const MAX_ORDER_HISTORY_DISPLAY = 5

const KIND_LABEL: Record<string, string> = {
  farm: '农场',
  school: '校园',
  park: '乐园',
  fortress: '堡垒',
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  open: '待接单',
  assigned: '进行中',
  fulfilled: '已完成',
  cancelled: '已取消',
  expired: '已过期',
}

export function drawMarketHud(
  ctx: CanvasRenderingContext2D,
  width: number,
  _height: number,
  data: AvatarHudData,
): void {
  const btn = getStatsButtonRect(width)
  ctx.fillStyle = data.statsOpen ? 'rgba(88, 166, 255, 0.28)' : 'rgba(8, 12, 20, 0.78)'
  roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 8)
  ctx.fill()
  ctx.strokeStyle = data.statsOpen ? '#58a6ff' : '#3d4f6e'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.fillStyle = data.statsOpen ? '#ffffff' : '#8aa0c8'
  ctx.font = '600 12px system-ui, sans-serif'
  ctx.fillText('统计', btn.x + btn.w / 2, btn.y + 18)

  ctx.textAlign = 'right'
  ctx.font = '12px system-ui, sans-serif'

  let y = btn.y + btn.h + 10
  const panelW = Math.min(360, width - 32)

  const drawRightPanel = (text: string, h = 24, color = '#8aa0c8') => {
    ctx.fillStyle = 'rgba(8, 12, 20, 0.78)'
    const tw = Math.min(ctx.measureText(text).width + 20, panelW)
    const x = width - 16 - tw
    roundRect(ctx, x, y, tw, h, 8)
    ctx.fill()
    ctx.fillStyle = color
    ctx.fillText(text, width - 26, y + 16)
    y += h + 6
  }

  drawRightPanel('订单与市场', 24)

  for (const market of data.familyMarkets) {
    const fam = data.demographics.families.find((f) => f.familyId === market.familyId)
    const famName = fam?.familyName ?? `家族${market.familyId}`
    const activeOrder = market.orders.find((o) => o.status === 'open' || o.status === 'assigned')
    const needLine = activeOrder
      ? `需求：${ORDER_DEMAND_LABEL[activeOrder.kind] ?? activeOrder.kind}`
      : '暂无订单需求'
    drawRightPanel(`${famName} · ${needLine}`, 28)

    const cooldown = Math.max(0, market.orderPostCooldownUntil - data.gameTimeSec)
    if (cooldown > 0.5) {
      drawRightPanel(`发单冷却 ${Math.ceil(cooldown)}s`)
    }

    for (const order of market.orders.slice(0, MAX_ORDER_HISTORY_DISPLAY)) {
      const kind = KIND_LABEL[order.kind] ?? order.kind
      const status = ORDER_STATUS_LABEL[order.status] ?? order.status
      const remain = Math.max(0, order.deadline - data.gameTimeSec)
      const color =
        order.status === 'fulfilled'
          ? '#7ddea8'
          : order.status === 'expired' || order.status === 'cancelled'
            ? '#ff9f9f'
            : '#8aa0c8'
      const timeLabel =
        order.status === 'fulfilled'
          ? `完成于 ${formatGameTime(order.completedAt ?? data.gameTimeSec)}`
          : `截止 ${Math.ceil(remain)}s`
      drawRightPanel(
        `#${order.id} ${ORDER_DEMAND_LABEL[order.kind] ?? kind} · ${status} · ${timeLabel} · 赏${order.reward}`,
        28,
        color,
      )
    }
  }

  if (data.statsOpen) {
    drawStatsPanel(ctx, width, _height, data)
  }
}

const STATS_PANEL_LINE_HEIGHT = 16

export function getStatsPanelRect(
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } {
  const panelW = Math.min(420, width - 32)
  const panelH = Math.min(420, height - 48)
  return { x: width - panelW - 16, y: 52, w: panelW, h: panelH }
}

export function getStatsContentHeight(
  data: Pick<AvatarHudData, 'demographics' | 'familyMarkets' | 'genealogies'>,
): number {
  const orders = listAllOrders(data.familyMarkets)
  let lines = 6
  lines += data.demographics.practitionerByFamily.length
  lines += 5
  lines += orders.length
  for (const genealogy of data.genealogies) {
    lines += 2 + genealogy.members.length
  }
  return lines * STATS_PANEL_LINE_HEIGHT + 48
}

export function clampStatsScroll(scrollY: number, contentHeight: number, panelHeight: number): number {
  const maxScroll = Math.max(0, contentHeight - panelHeight + 24)
  return Math.max(0, Math.min(maxScroll, scrollY))
}

function drawStatsSectionTitle(ctx: CanvasRenderingContext2D, x: number, y: number, title: string): number {
  ctx.fillStyle = '#e8f0ff'
  ctx.font = '600 13px system-ui, sans-serif'
  ctx.fillText(title, x, y)
  return y + STATS_PANEL_LINE_HEIGHT
}

function drawStatsLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  color = '#8aa0c8',
): number {
  ctx.fillStyle = color
  ctx.font = '12px system-ui, sans-serif'
  ctx.fillText(text, x, y)
  return y + STATS_PANEL_LINE_HEIGHT
}

function drawStatsPanel(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: AvatarHudData,
): void {
  const rect = getStatsPanelRect(width, height)
  const { x, y, w: panelW, h: panelH } = rect
  const contentHeight = getStatsContentHeight(data)
  const scrollY = clampStatsScroll(data.statsScrollY, contentHeight, panelH)

  ctx.fillStyle = 'rgba(6, 10, 18, 0.92)'
  roundRect(ctx, x, y, panelW, panelH, 12)
  ctx.fill()
  ctx.strokeStyle = '#58a6ff'
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.save()
  ctx.beginPath()
  roundRect(ctx, x, y, panelW, panelH, 12)
  ctx.clip()

  ctx.textAlign = 'left'
  let cy = y + 20 - scrollY
  const textX = x + 14
  const textW = panelW - 28

  cy = drawStatsSectionTitle(ctx, textX, cy, '化身者与订单统计')
  const os = data.orderStats
  cy = drawStatsLine(
    ctx,
    textX,
    cy,
    `订单 完成${os.fulfilled} · 进行中${os.active} · 失效${os.incomplete}`,
  )

  cy = drawStatsSectionTitle(ctx, textX, cy + 6, '各类型订单统计')
  const kindLabels: TransformKind[] = ['farm', 'school', 'park', 'fortress']
  for (const kind of kindLabels) {
    const stats = os.byKind[kind]
    cy = drawStatsLine(
      ctx,
      textX,
      cy,
      `${ORDER_DEMAND_LABEL[kind]} 待${stats.open} 进行${stats.assigned} 完成${stats.fulfilled} 失效${stats.expired}`,
    )
  }

  cy = drawStatsSectionTitle(ctx, textX, cy + 6, '各家族活跃化身者')
  if (data.demographics.practitionerByFamily.length === 0) {
    cy = drawStatsLine(ctx, textX, cy, '暂无注册化身者')
  } else {
    for (const fam of data.demographics.practitionerByFamily) {
      cy = drawStatsLine(
        ctx,
        textX,
        cy,
        `${fam.familyName} 农场${fam.farm} 校园${fam.school} 乐园${fam.park} 堡垒${fam.fortress}`,
      )
    }
  }

  cy = drawStatsSectionTitle(ctx, textX, cy + 6, '订单列表')
  const orders = listAllOrders(data.familyMarkets)
  if (orders.length === 0) {
    cy = drawStatsLine(ctx, textX, cy, '暂无订单记录')
  } else {
    for (const order of orders) {
      const fam = data.demographics.families.find((f) => f.familyId === order.familyId)
      const famName = fam?.familyName ?? `家族${order.familyId}`
      const status = ORDER_STATUS_LABEL[order.status] ?? order.status
      const color =
        order.status === 'fulfilled'
          ? '#7ddea8'
          : order.status === 'expired' || order.status === 'cancelled'
            ? '#ff9f9f'
            : '#8aa0c8'
      const remain = Math.max(0, order.deadline - data.gameTimeSec)
      const timeLabel =
        order.status === 'fulfilled'
          ? `完成 ${formatGameTime(order.completedAt ?? data.gameTimeSec)}`
          : `剩余 ${Math.ceil(remain)}s`
      const line = `#${order.id} ${famName} · ${ORDER_DEMAND_LABEL[order.kind]} · ${status} · (${Math.round(order.x)},${Math.round(order.y)}) · ${timeLabel}`
      ctx.fillStyle = color
      ctx.font = '12px system-ui, sans-serif'
      const chunks = wrapText(line, textW, ctx)
      for (const chunk of chunks) {
        ctx.fillText(chunk, textX, cy)
        cy += STATS_PANEL_LINE_HEIGHT
      }
    }
  }

  cy = drawStatsSectionTitle(ctx, textX, cy + 6, '家族族谱与巡检')
  for (const genealogy of data.genealogies) {
    cy = drawStatsLine(
      ctx,
      textX,
      cy,
      `${genealogy.familyName} 化身者 农${genealogy.practitionerFarm} 校${genealogy.practitionerSchool} 乐${genealogy.practitionerPark} 堡${genealogy.practitionerFortress}`,
      '#b8c4dc',
    )
    for (const member of genealogy.members) {
      cy = drawStatsLine(ctx, textX + 8, cy, formatGenealogyLine(member))
    }
    cy += 4
  }

  ctx.restore()

  const maxScroll = Math.max(0, contentHeight - panelH + 24)
  if (maxScroll > 0) {
    const trackX = x + panelW - 8
    const trackY = y + 12
    const trackH = panelH - 24
    const thumbH = Math.max(24, (panelH / contentHeight) * trackH)
    const thumbY = trackY + (scrollY / maxScroll) * (trackH - thumbH)
    ctx.fillStyle = 'rgba(88, 166, 255, 0.18)'
    ctx.fillRect(trackX, trackY, 4, trackH)
    ctx.fillStyle = 'rgba(88, 166, 255, 0.72)'
    ctx.fillRect(trackX, thumbY, 4, thumbH)
  }
}

function wrapText(text: string, maxWidth: number, ctx: CanvasRenderingContext2D): string[] {
  if (ctx.measureText(text).width <= maxWidth) return [text]
  const chunks: string[] = []
  let current = ''
  for (const ch of text) {
    const next = current + ch
    if (ctx.measureText(next).width > maxWidth && current.length > 0) {
      chunks.push(current)
      current = ch
    } else {
      current = next
    }
  }
  if (current) chunks.push(current)
  return chunks.length > 0 ? chunks : [text]
}

export function drawAvatarStructure(
  ctx: CanvasRenderingContext2D,
  entity: CircleEntity,
  time = 0,
): void {
  const r = avatarEntityRadius(entity)
  const { x, y, avatarRole, colorLight, colorDark, strokeColor, name } = entity

  ctx.save()
  const pulse = 0.85 + 0.15 * Math.sin(time * 2)
  const ringColor =
    avatarRole === 'farm'
      ? 'rgba(143, 211, 255, 0.55)'
      : avatarRole === 'school'
        ? 'rgba(130, 170, 255, 0.58)'
        : avatarRole === 'park'
          ? 'rgba(255, 150, 210, 0.58)'
          : 'rgba(255, 160, 90, 0.62)'

  ctx.beginPath()
  ctx.arc(x, y, r * pulse + 10, 0, Math.PI * 2)
  ctx.strokeStyle = ringColor
  ctx.lineWidth = 3
  ctx.stroke()

  const gradient = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r)
  gradient.addColorStop(0, colorLight)
  gradient.addColorStop(1, colorDark)
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.font = `600 ${Math.min(14, r * 0.34)}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, x, y)
  drawAvatarEntityStats(ctx, entity, time)
  ctx.restore()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
