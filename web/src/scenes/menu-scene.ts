import type { App } from '../core/app'
import type { GamepadStatus } from '../input/input-manager'
import { requestAppFullscreen } from '../core/fullscreen'
import { FocusList } from '../input/focus-list'
import {
  clearScreen,
  drawGamepadBanner,
  drawHint,
  drawMenuItem,
  drawTitle,
} from '../ui/draw'

const MENU_ITEMS = ['开始游戏', '其他模式', '按键绑定', '设置（占位）'] as const

export function createMenuScene(app: App, go: (scene: string) => void) {
  const focus = new FocusList(MENU_ITEMS.length)
  let gamepadStatus: GamepadStatus = app.input.getGamepadStatus()
  let unsubscribe = () => {}

  const activate = (index: number) => {
    const item = MENU_ITEMS[index]
    if (item === '开始游戏') go('game')
    if (item === '其他模式') go('modes')
    if (item === '按键绑定') go('bindings')
  }

  return {
    enter() {
      focus.setIndex(0)
      unsubscribe = app.input.onStatusChange((status) => {
        gamepadStatus = status
      })
      requestAppFullscreen()
    },
    exit() {
      unsubscribe()
    },
    update(_dt: number) {
      const input = app.input.snapshot()
      if (input.downPressed) focus.move(1)
      if (input.upPressed) focus.move(-1)
      if (input.confirmPressed) activate(focus.getIndex())
    },
    onTap(x: number, y: number, width: number, height: number) {
      const startY = height * 0.38
      const itemWidth = 320
      const itemHeight = 52
      const left = (width - itemWidth) / 2
      MENU_ITEMS.forEach((_, i) => {
        const top = startY + i * 68
        if (x >= left && x <= left + itemWidth && y >= top && y <= top + itemHeight) {
          focus.setIndex(i)
          activate(i)
        }
      })
    },
    render(ctx: CanvasRenderingContext2D, width: number, height: number) {
      clearScreen(ctx, width, height)
      drawTitle(ctx, width, 'Mira', '手柄全程可操控')
      drawGamepadBanner(ctx, width, gamepadStatus)
      const startY = height * 0.38
      MENU_ITEMS.forEach((label, i) => {
        drawMenuItem(ctx, width, startY + i * 68, label, focus.getIndex() === i)
      })
      drawHint(ctx, width, height, '十字键/摇杆切换 · A 确认 · Start 暂停')
    },
  }
}

export function createPauseScene(app: App, go: (scene: string) => void, resume: () => void) {
  const focus = new FocusList(2)

  return {
    enter() {
      focus.setIndex(0)
    },
    exit() {},
    update(_dt: number) {
      const input = app.input.snapshot()
      if (input.downPressed) focus.move(1)
      if (input.upPressed) focus.move(-1)
      if (input.pausePressed) resume()
      if (input.confirmPressed) {
        if (focus.getIndex() === 0) resume()
        else go('menu')
      }
    },
    render(ctx: CanvasRenderingContext2D, width: number, height: number) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
      ctx.fillRect(0, 0, width, height)
      drawTitle(ctx, width, '暂停')
      const startY = height * 0.42
      ;['继续游戏', '返回主菜单'].forEach((label, i) => {
        drawMenuItem(ctx, width, startY + i * 68, label, focus.getIndex() === i)
      })
      drawHint(ctx, width, height, 'A 继续 · Start 关闭暂停')
    },
  }
}
