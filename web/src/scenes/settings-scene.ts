import type { App } from '../core/app'
import { FocusList } from '../input/focus-list'
import { getMasterVolume, setMasterVolume } from '../audio/synth'
import { clearScreen, drawHint, drawMenuItem, drawTitle } from '../ui/draw'

const ITEMS = ['音量', '摇杆布局', '返回'] as const

export function createSettingsScene(app: App, go: (scene: string) => void) {
  const focus = new FocusList(ITEMS.length)
  let volume = getMasterVolume()

  const activate = (index: number) => {
    const item = ITEMS[index]
    if (item === '摇杆布局') go('layout-editor')
    if (item === '返回') go('menu')
  }

  return {
    enter() {
      volume = getMasterVolume()
      focus.setIndex(0)
    },
    exit() {},
    update(_dt: number) {
      const input = app.input.snapshot()
      if (input.pausePressed) {
        go('menu')
        return
      }
      if (input.backPressed && focus.getIndex() !== 0) {
        go('menu')
        return
      }

      if (focus.getIndex() === 0) {
        if (input.moveX > 0.5) {
          volume = Math.min(1, Math.round((volume + 0.1) * 10) / 10)
          setMasterVolume(volume)
          return
        }
        if (input.moveX < -0.5) {
          volume = Math.max(0, Math.round((volume - 0.1) * 10) / 10)
          setMasterVolume(volume)
          return
        }
      }

      if (input.downPressed) focus.move(1)
      if (input.upPressed) focus.move(-1)
      if (input.confirmPressed) activate(focus.getIndex())
    },
    onTap(x: number, y: number, width: number, height: number) {
      const startY = height * 0.38
      const itemWidth = 320
      const itemHeight = 52
      const left = (width - itemWidth) / 2
      ITEMS.forEach((_, i) => {
        const top = startY + i * 68
        if (x >= left && x <= left + itemWidth && y >= top && y <= top + itemHeight) {
          focus.setIndex(i)
          activate(i)
        }
      })
    },
    render(ctx: CanvasRenderingContext2D, width: number, height: number) {
      clearScreen(ctx, width, height)
      drawTitle(ctx, width, '设置', '调整音量与虚拟摇杆布局')
      const startY = height * 0.38
      const volumeLabel = `音量 (${Math.round(volume * 100)}%)`
      drawMenuItem(ctx, width, startY, volumeLabel, focus.getIndex() === 0)
      drawMenuItem(ctx, width, startY + 68, '摇杆布局', focus.getIndex() === 1)
      drawMenuItem(ctx, width, startY + 136, '返回', focus.getIndex() === 2)
      drawHint(ctx, width, height, '↑↓ 选择 · 左右调音量 · A 确认')
    },
  }
}
