import type { App } from '../core/app'
import type { VirtualControls } from '../input/virtual-controls'
import { loadVirtualLayout, saveVirtualLayout } from '../settings/settings'
import { clearScreen, drawHint, drawMenuItem, drawTitle } from '../ui/draw'

export function createLayoutEditorScene(
  app: App,
  go: (scene: string) => void,
  virtualControls: VirtualControls,
) {
  const saveAndExit = () => {
    saveVirtualLayout(virtualControls.getLayout())
    go('settings')
  }

  const cancel = () => {
    virtualControls.applyLayout(loadVirtualLayout())
    go('settings')
  }

  return {
    enter() {
      virtualControls.setLayoutEditMode(true)
    },
    exit() {
      virtualControls.setLayoutEditMode(false)
    },
    update(_dt: number) {
      const input = app.input.snapshot()
      if (input.pausePressed || input.backPressed) cancel()
      if (input.confirmPressed) saveAndExit()
    },
    onTap(x: number, y: number, width: number, height: number) {
      const top = height * 0.82
      const itemWidth = 280
      const left = (width - itemWidth) / 2
      if (x >= left && x <= left + itemWidth && y >= top && y <= top + 52) {
        saveAndExit()
      }
    },
    render(ctx: CanvasRenderingContext2D, width: number, height: number) {
      clearScreen(ctx, width, height)
      drawTitle(ctx, width, '摇杆布局', '拖动各组件到合适位置')
      ctx.textAlign = 'center'
      ctx.fillStyle = '#8aa0c8'
      ctx.font = '14px system-ui, sans-serif'
      ctx.fillText('拖动摇杆、按键与 Start 到目标位置', width / 2, height * 0.22)
      drawMenuItem(ctx, width, height * 0.82, '确定并保存', true)
      drawHint(ctx, width, height, '拖动组件 · 点击确定保存')
    },
  }
}
