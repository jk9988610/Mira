import { SATIETY_CAP } from '../game/avatar-config'
import { intentLabel } from '../game/avatar-ai'
import { formatCitizenId } from '../game/citizen-id'
import { formatDnaFingerprint } from '../game/dna'
import { massLabel, satietyEvalLabel } from '../game/avatar-needs'
import { happinessEvalLabel, knowledgeEvalLabel } from '../game/avatar-vitality'
import { getAvatarTransformCountdownSec } from '../game/avatar-system'
import { healthLabel } from '../game/avatar-mass'
import { avatarEntityRadius } from '../game/avatar-radius'
import type { PressureFieldSummary } from '../game/pressure-field'
import type { TribeDemographics } from '../game/tribe-stats'
import { formatLatLng } from '../game/geo'
import { generationLabel } from '../game/naming'
import { formatGameTime } from '../game/game-clock'
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
  cameraX: number
  cameraY: number
  demographics: TribeDemographics
  pressureSummary?: PressureFieldSummary
}

export function getStatsButtonRect(width: number): { x: number; y: number; w: number; h: number } {
  return { x: width - 96, y: 12, w: 80, h: 28 }
}

export function hitTestStatsButton(x: number, y: number, width: number): boolean {
  const rect = getStatsButtonRect(width)
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
}

export function drawStatsButton(
  ctx: CanvasRenderingContext2D,
  width: number,
  active: boolean,
): void {
  const btn = getStatsButtonRect(width)
  ctx.fillStyle = active ? 'rgba(88, 166, 255, 0.28)' : 'rgba(8, 12, 20, 0.78)'
  roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 8)
  ctx.fill()
  ctx.strokeStyle = active ? '#58a6ff' : '#3d4f6e'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.fillStyle = active ? '#ffffff' : '#8aa0c8'
  ctx.font = '600 12px system-ui, sans-serif'
  ctx.fillText('统计', btn.x + btn.w / 2, btn.y + 18)
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
  const practitionerLines =
    demo.practitionerByFamily.length > 0
      ? demo.practitionerByFamily.map(
          (fam) =>
            `${fam.familyName} 农${fam.farm} 校${fam.school} 乐${fam.park} 堡${fam.fortress}`,
        )
      : [
          `全局 农${demo.practitionerFarm} 校${demo.practitionerSchool} 乐${demo.practitionerPark} 堡${demo.practitionerFortress}`,
        ]

  ctx.textAlign = 'left'
  ctx.font = '12px system-ui, sans-serif'

  let y = 16
  const maxPanelW = Math.min(width - 120, 420)
  const lineHeight = 14
  const padX = 10
  const padY = 7

  const drawLinesPanel = (lines: string[]) => {
    const panelH = lines.length * lineHeight + padY * 2
    let contentW = 0
    for (const line of lines) {
      contentW = Math.max(contentW, ctx.measureText(line).width)
    }
    const panelW = Math.min(contentW + padX * 2, maxPanelW)
    ctx.fillStyle = 'rgba(8, 12, 20, 0.78)'
    roundRect(ctx, 16, y, panelW, panelH, 8)
    ctx.fill()
    ctx.fillStyle = '#8aa0c8'
    lines.forEach((line, i) => {
      ctx.fillText(line, 26, y + padY + 11 + i * lineHeight)
    })
    y += panelH + 6
  }

  drawLinesPanel([`时间 ${formatGameTime(data.gameTimeSec)} · 观察者模式`])
  drawLinesPanel([`视角 (${data.cameraX}, ${data.cameraY}) · 触屏拖拽平移`])
  if (data.pressureSummary) {
    const p = data.pressureSummary
    drawLinesPanel([
      `压力 均${p.avgPressure.toFixed(1)} · 敌压峰${p.maxHostile.toFixed(1)} · 敌对族${p.hostileFamilyPairs}`,
    ])
  }
  drawLinesPanel(['活跃化身者', ...practitionerLines])
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
