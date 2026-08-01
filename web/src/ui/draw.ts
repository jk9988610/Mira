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

export function drawHudMass(
  ctx: CanvasRenderingContext2D,
  width: number,
  mass: number,
): void {
  const text = `质量 ${mass.toFixed(1)}`
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
