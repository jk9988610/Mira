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

import type { LeaderboardView } from '../game/leaderboard'
import { entityRadius, type CircleEntity } from '../game/entity'

export interface HudData {
  timeRemaining: number
  playerMass: number
  zoom: number
  cloneCount: number
  board: LeaderboardView
}

export function drawHudMass(
  ctx: CanvasRenderingContext2D,
  width: number,
  mass: number,
  zoom = 1,
): void {
  const zoomText = zoom > 1.01 ? ` · ×${zoom.toFixed(1)}` : ''
  const text = `质量 ${mass.toFixed(1)}${zoomText}`
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(8, 12, 20, 0.72)'
  const padding = 12
  ctx.font = '600 18px system-ui, sans-serif'
  const textWidth = ctx.measureText(text).width
  roundRect(ctx, width - textWidth - padding * 2 - 16, 16, textWidth + padding * 2, 36, 8)
  ctx.fill()
  ctx.fillStyle = '#e8f0ff'
  ctx.fillText(text, width - 24, 40)
}

export function formatMatchTime(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds))
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function drawGameHud(
  ctx: CanvasRenderingContext2D,
  width: number,
  _height: number,
  data: HudData,
): void {
  const timerText = `剩余 ${formatMatchTime(data.timeRemaining)}`
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(8, 12, 20, 0.78)'
  ctx.font = '600 20px system-ui, sans-serif'
  const tw = ctx.measureText(timerText).width
  roundRect(ctx, 16, 16, tw + 24, 36, 8)
  ctx.fill()
  ctx.fillStyle = data.timeRemaining <= 10 ? '#ff9f8a' : '#e8f0ff'
  ctx.fillText(timerText, 28, 40)

  drawHudMass(ctx, width, data.playerMass, data.zoom)

  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(8, 12, 20, 0.72)'
  ctx.font = '13px system-ui, sans-serif'
  const hint =
    data.cloneCount > 1
      ? `分身 ${data.cloneCount}/16 · Q分裂 E聚集 · 朝质量中心聚拢`
      : `分身 ${data.cloneCount}/16 · Q分裂 E聚集`
  roundRect(ctx, 16, 58, ctx.measureText(hint).width + 20, 28, 8)
  ctx.fill()
  ctx.fillStyle = '#8aa0c8'
  ctx.fillText(hint, 26, 77)

  const panelW = 168
  const rowH = 22
  const extraRow = data.board.playerInTop ? 0 : 1
  const panelH = 20 + data.board.top.length * rowH + extraRow * (rowH + 6)
  const px = width - panelW - 16
  const py = 60

  ctx.fillStyle = 'rgba(8, 12, 20, 0.82)'
  roundRect(ctx, px, py, panelW, panelH, 10)
  ctx.fill()
  ctx.fillStyle = '#8aa0c8'
  ctx.font = '600 13px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('质量排名 TOP10', px + 12, py + 18)

  data.board.top.forEach((row, i) => {
    const y = py + 34 + i * rowH
    ctx.fillStyle = row.isPlayer ? '#8fd3ff' : row.respawning ? '#6a7588' : '#d7e0f2'
    ctx.font = row.isPlayer ? '600 13px system-ui, sans-serif' : '13px system-ui, sans-serif'
    const suffix = row.respawning ? ' (复活)' : ''
    ctx.fillText(`${row.rank}. ${row.name}${suffix}`, px + 12, y)
    ctx.textAlign = 'right'
    ctx.fillText(row.mass.toFixed(0), px + panelW - 12, y)
    ctx.textAlign = 'left'
  })

  if (!data.board.playerInTop && data.board.playerRank) {
    const y = py + 34 + data.board.top.length * rowH + 14
    ctx.strokeStyle = 'rgba(88, 166, 255, 0.35)'
    ctx.beginPath()
    ctx.moveTo(px + 10, y - 10)
    ctx.lineTo(px + panelW - 10, y - 10)
    ctx.stroke()
    ctx.fillStyle = '#8fd3ff'
    ctx.font = '600 13px system-ui, sans-serif'
    ctx.fillText(`你 · 第 ${data.board.playerRank} 名`, px + 12, y + 6)
    ctx.textAlign = 'right'
    ctx.fillText(data.board.playerMass.toFixed(0), px + panelW - 12, y + 6)
    ctx.textAlign = 'left'
  }
}

export function drawStartCountdown(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  secondsLeft: number,
): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
  ctx.fillRect(0, 0, width, height)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#e8f0ff'
  ctx.font = 'bold 28px system-ui, sans-serif'
  ctx.fillText('准备', width / 2, height * 0.38)
  ctx.fillStyle = '#ffc44d'
  ctx.font = 'bold 72px system-ui, sans-serif'
  const label = secondsLeft > 0 ? String(Math.ceil(secondsLeft)) : '开始!'
  ctx.fillText(label, width / 2, height * 0.5)
  ctx.fillStyle = '#8aa0c8'
  ctx.font = '16px system-ui, sans-serif'
  ctx.fillText('对局即将开始', width / 2, height * 0.58)
}

export function drawRespawnOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  respawnTimer: number,
): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
  ctx.fillRect(0, 0, width, height)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#e8f0ff'
  ctx.font = 'bold 36px system-ui, sans-serif'
  ctx.fillText('被吞噬', width / 2, height * 0.44)
  ctx.fillStyle = '#ffc44d'
  ctx.font = '24px system-ui, sans-serif'
  ctx.fillText(`${Math.ceil(respawnTimer)} 秒后复活`, width / 2, height * 0.52)
}

export function drawLeaderboardModal(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  board: LeaderboardView,
): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.78)'
  ctx.fillRect(0, 0, width, height)

  drawTitle(ctx, width, '对局结束', '最终排行榜 TOP10')

  const panelW = Math.min(420, width - 48)
  const rowH = 36
  const extra = board.playerInTop ? 0 : 1
  const panelH = 48 + board.top.length * rowH + extra * rowH
  const px = (width - panelW) / 2
  const py = height * 0.26

  ctx.fillStyle = 'rgba(14, 20, 32, 0.95)'
  roundRect(ctx, px, py, panelW, panelH, 14)
  ctx.fill()
  ctx.strokeStyle = '#3d5578'
  ctx.lineWidth = 2
  ctx.stroke()

  board.top.forEach((row, i) => {
    const y = py + 40 + i * rowH
    if (row.isPlayer) {
      ctx.fillStyle = 'rgba(88, 166, 255, 0.12)'
      roundRect(ctx, px + 8, y - 22, panelW - 16, rowH - 4, 8)
      ctx.fill()
    }
    ctx.textAlign = 'left'
    ctx.fillStyle = row.isPlayer ? '#8fd3ff' : '#d7e0f2'
    ctx.font = row.isPlayer ? '600 18px system-ui, sans-serif' : '18px system-ui, sans-serif'
    const medal = row.rank === 1 ? '🥇 ' : row.rank === 2 ? '🥈 ' : row.rank === 3 ? '🥉 ' : `${row.rank}. `
    ctx.fillText(`${medal}${row.name}`, px + 20, y)
    ctx.textAlign = 'right'
    ctx.fillText(`质量 ${row.mass.toFixed(1)}`, px + panelW - 20, y)
  })

  if (!board.playerInTop && board.playerRank) {
    const y = py + 40 + board.top.length * rowH
    ctx.fillStyle = 'rgba(88, 166, 255, 0.12)'
    roundRect(ctx, px + 8, y - 22, panelW - 16, rowH - 4, 8)
    ctx.fill()
    ctx.textAlign = 'left'
    ctx.fillStyle = '#8fd3ff'
    ctx.font = '600 18px system-ui, sans-serif'
    ctx.fillText(`你 · 第 ${board.playerRank} 名`, px + 20, y)
    ctx.textAlign = 'right'
    ctx.fillText(`质量 ${board.playerMass.toFixed(1)}`, px + panelW - 20, y)
  }

  ctx.textAlign = 'center'
  ctx.fillStyle = '#b8c2d6'
  ctx.font = '18px system-ui, sans-serif'
  ctx.fillText('按 A / Enter 确认', width / 2, py + panelH + 48)
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
  mass: number
  zoom: number
  farmReady: boolean
  ranchReady: boolean
  incubating: boolean
  farms: number
  ranches: number
  allies: number
}

export function drawAvatarHud(
  ctx: CanvasRenderingContext2D,
  width: number,
  data: AvatarHudData,
): void {
  drawHudMass(ctx, width, data.mass, data.zoom)

  const farmHint = data.farmReady ? 'Q 化身农场' : 'Q 农场(质量不足)'
  const ranchHint = data.ranchReady ? 'E 化身牧场' : 'E 牧场(质量不足)'
  const status = data.incubating ? ' · 化身中…' : ''
  const tribe = `农场 ${data.farms} · 牧场 ${data.ranches} · 后代 ${data.allies}`
  const hint = `${farmHint} · ${ranchHint}${status}`

  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(8, 12, 20, 0.78)'
  ctx.font = '13px system-ui, sans-serif'
  roundRect(ctx, 16, 16, ctx.measureText(hint).width + 20, 28, 8)
  ctx.fill()
  ctx.fillStyle = data.incubating ? '#ffc44d' : '#8aa0c8'
  ctx.fillText(hint, 26, 35)

  ctx.fillStyle = 'rgba(8, 12, 20, 0.72)'
  roundRect(ctx, 16, 50, ctx.measureText(tribe).width + 20, 24, 8)
  ctx.fill()
  ctx.fillStyle = '#7f8ca3'
  ctx.font = '12px system-ui, sans-serif'
  ctx.fillText(tribe, 26, 66)
}

export function drawAvatarStructure(
  ctx: CanvasRenderingContext2D,
  entity: CircleEntity,
  time = 0,
): void {
  const r = entityRadius(entity)
  const { x, y, avatarRole, colorLight, colorDark, strokeColor, name } = entity

  ctx.save()
  const pulse = 0.85 + 0.15 * Math.sin(time * 2)
  const ringColor = avatarRole === 'farm' ? 'rgba(143, 211, 255, 0.55)' : 'rgba(255, 196, 77, 0.55)'

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
