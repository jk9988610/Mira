import type { App } from '../core/app'
import type { Action, BindingMap } from '../input/actions'
import { ACTION_LABELS, ALL_ACTIONS, formatBinding, saveBindings } from '../input/actions'
import { FocusList } from '../input/focus-list'
import { clearScreen, drawBindingRow, drawHint, drawTitle } from '../ui/draw'

export function createBindingsScene(
  app: App,
  go: (scene: string) => void,
  getBindings: () => BindingMap,
  setBindings: (bindings: BindingMap) => void,
) {
  const focus = new FocusList(ALL_ACTIONS.length + 1)
  let listening = false
  let working: BindingMap = { ...getBindings() }

  return {
    enter() {
      working = { ...getBindings() }
      focus.setIndex(0)
      listening = false
    },
    exit() {},
    update(_dt: number) {
      const input = app.input.snapshot()
      if (listening) {
        const captured = app.input.captureNextBinding()
        if (captured) {
          const action = ALL_ACTIONS[focus.getIndex()]
          working[action] = captured
          saveBindings(working)
          setBindings(working)
          listening = false
        }
        if (input.backPressed) listening = false
        return
      }

      if (input.backPressed) {
        go('menu')
        return
      }

      if (input.downPressed) focus.move(1)
      if (input.upPressed) focus.move(-1)

      if (input.confirmPressed) {
        if (focus.getIndex() === ALL_ACTIONS.length) {
          go('menu')
        } else {
          listening = true
        }
      }
    },
    render(ctx: CanvasRenderingContext2D, width: number, height: number) {
      clearScreen(ctx, width, height)
      drawTitle(ctx, width, '按键绑定', '选中一行后按确认键，再按下要绑定的键')
      const startY = 170
      ALL_ACTIONS.forEach((action: Action, i) => {
        drawBindingRow(
          ctx,
          width,
          startY + i * 56,
          ACTION_LABELS[action],
          formatBinding(working[action]),
          focus.getIndex() === i,
          listening && focus.getIndex() === i,
        )
      })
      drawBindingRow(
        ctx,
        width,
        startY + ALL_ACTIONS.length * 56 + 16,
        '完成',
        '返回主菜单',
        focus.getIndex() === ALL_ACTIONS.length,
        false,
      )
      drawHint(ctx, width, height, '↑↓ 选择 · Enter/A 重绑 · B/Esc 返回')
    },
  }
}
