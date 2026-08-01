import type { App } from '../core/app'
import { FocusList } from '../input/focus-list'
import {
  clearScreen,
  drawHint,
  drawMenuItem,
  drawTitle,
} from '../ui/draw'

const MENU_ITEMS = ['开始游戏', '按键绑定', '设置（占位）', '返回主菜单说明'] as const

export function createMenuScene(app: App, go: (scene: string) => void) {
  const focus = new FocusList(MENU_ITEMS.length)

  return {
    enter() {
      focus.setIndex(0)
    },
    exit() {},
    update(_dt: number) {
      const input = app.input.snapshot()
      if (input.downPressed) focus.move(1)
      if (input.upPressed) focus.move(-1)

      if (input.confirmPressed) {
        const item = MENU_ITEMS[focus.getIndex()]
        if (item === '开始游戏') go('game')
        if (item === '按键绑定') go('bindings')
      }
    },
    render(ctx: CanvasRenderingContext2D, width: number, height: number) {
      clearScreen(ctx, width, height)
      drawTitle(ctx, width, 'Mira', '手柄全程可操控')
      const startY = height * 0.38
      MENU_ITEMS.forEach((label, i) => {
        drawMenuItem(ctx, width, startY + i * 68, label, focus.getIndex() === i)
      })
      drawHint(ctx, width, height, '↑↓ 切换 · Enter/A 确认 · 摇杆/十字键均可')
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
      if (input.backPressed) resume()
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
      drawHint(ctx, width, height, 'B/Esc 继续 · ↑↓ 选择')
    },
  }
}
