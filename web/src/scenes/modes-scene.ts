import type { App } from '../core/app'
import { FocusList } from '../input/focus-list'
import { clearScreen, drawHint, drawMenuItem, drawTitle } from '../ui/draw'

const MODE_ITEMS = ['圆的化身', '返回'] as const

export function createModesScene(app: App, go: (scene: string) => void) {
  const focus = new FocusList(MODE_ITEMS.length)

  const activate = (index: number) => {
    const item = MODE_ITEMS[index]
    if (item === '圆的化身') go('avatar-game')
    if (item === '返回') go('menu')
  }

  return {
    enter() {
      focus.setIndex(0)
    },
    exit() {},
    update(_dt: number) {
      const input = app.input.snapshot()
      if (input.downPressed) focus.move(1)
      if (input.upPressed) focus.move(-1)
      if (input.confirmPressed) activate(focus.getIndex())
      if (input.pausePressed) go('menu')
    },
    onTap(x: number, y: number, width: number, height: number) {
      const startY = height * 0.4
      const itemWidth = 320
      const itemHeight = 52
      const left = (width - itemWidth) / 2
      MODE_ITEMS.forEach((_, i) => {
        const top = startY + i * 68
        if (x >= left && x <= left + itemWidth && y >= top && y <= top + itemHeight) {
          focus.setIndex(i)
          activate(i)
        }
      })
    },
    render(ctx: CanvasRenderingContext2D, width: number, height: number) {
      clearScreen(ctx, width, height)
      drawTitle(ctx, width, '其他模式', '选择一种玩法')
      const startY = height * 0.4
      MODE_ITEMS.forEach((label, i) => {
        drawMenuItem(ctx, width, startY + i * 68, label, focus.getIndex() === i)
      })
      drawHint(ctx, width, height, 'A 确认 · Start 返回')
    },
  }
}
