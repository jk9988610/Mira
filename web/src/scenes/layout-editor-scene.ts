import type { App } from '../core/app'
import { LAYOUT_GRID_STEP } from '../input/layout-grid'
import type { VirtualControls } from '../input/virtual-controls'
import { loadVirtualLayout, saveVirtualLayout } from '../settings/settings'
import { clearScreen, drawHint, drawMenuItem, drawTitle } from '../ui/draw'

function drawLayoutGrid(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const step = LAYOUT_GRID_STEP
  ctx.strokeStyle = 'rgba(100, 140, 200, 0.14)'
  ctx.lineWidth = 1
  for (let x = step; x < 1; x += step) {
    const px = x * width
    ctx.beginPath()
    ctx.moveTo(px, 0)
    ctx.lineTo(px, height)
    ctx.stroke()
  }
  for (let y = step; y < 1; y += step) {
    const py = y * height
    ctx.beginPath()
    ctx.moveTo(0, py)
    ctx.lineTo(width, py)
    ctx.stroke()
  }
}

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
      drawLayoutGrid(ctx, width, height)
      drawTitle(ctx, width, '摇杆布局', '拖动各组件，自动吸附网格')
      ctx.textAlign = 'center'
      ctx.fillStyle = '#8aa0c8'
      ctx.font = '14px system-ui, sans-serif'
      ctx.fillText('拖动摇杆、按键与 Start · 松手后吸附到网格', width / 2, height * 0.22)
      drawMenuItem(ctx, width, height * 0.82, '确定并保存', true)
      drawHint(ctx, width, height, '拖动组件 · 点击确定保存')
    },
  }
}
