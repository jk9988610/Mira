import type { Action, Binding } from './actions'

const AXIS_DEADZONE = 0.35
const STICK_AXIS = { x: 0, y: 1 }

export interface InputSnapshot {
  moveX: number
  moveY: number
  confirm: boolean
  back: boolean
  pause: boolean
  confirmPressed: boolean
  backPressed: boolean
  pausePressed: boolean
  upPressed: boolean
  downPressed: boolean
}

export class InputManager {
  private bindings: Record<Action, Binding>
  private keysDown = new Set<string>()
  private prevKeysDown = new Set<string>()
  private buttonsDown = new Set<string>()
  private prevButtonsDown = new Set<string>()
  private axisState = new Map<string, boolean>()
  private prevAxisState = new Map<string, boolean>()
  private stickX = 0
  private stickY = 0

  constructor(bindings: Record<Action, Binding>) {
    this.bindings = bindings
    window.addEventListener('keydown', (e) => {
      this.keysDown.add(e.code)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault()
      }
    })
    window.addEventListener('keyup', (e) => this.keysDown.delete(e.code))
    window.addEventListener('blur', () => {
      this.keysDown.clear()
      this.buttonsDown.clear()
      this.axisState.clear()
    })
  }

  setBindings(bindings: Record<Action, Binding>): void {
    this.bindings = bindings
  }

  getBindings(): Record<Action, Binding> {
    return this.bindings
  }

  beginFrame(): void {
    this.prevKeysDown = new Set(this.keysDown)
    this.prevButtonsDown = new Set(this.buttonsDown)
    this.prevAxisState = new Map(this.axisState)
    this.buttonsDown.clear()
    this.axisState.clear()
    this.stickX = 0
    this.stickY = 0

    const pads = navigator.getGamepads?.() ?? []
    for (const pad of pads) {
      if (!pad) continue
      pad.buttons.forEach((btn, i) => {
        if (btn.pressed) this.buttonsDown.add(String(i))
      })
      const lx = applyDeadzone(pad.axes[STICK_AXIS.x] ?? 0)
      const ly = applyDeadzone(pad.axes[STICK_AXIS.y] ?? 0)
      if (Math.abs(lx) > 0) this.stickX = lx
      if (Math.abs(ly) > 0) this.stickY = ly
      pad.axes.forEach((value, i) => {
        if (Math.abs(value) > AXIS_DEADZONE) {
          const sign = value > 0 ? 1 : -1
          this.axisState.set(`${i}:${sign}`, true)
        }
      })
    }
  }

  snapshot(): InputSnapshot {
    const moveX =
      this.stickX ||
      (this.isActionHeld('MOVE_RIGHT') ? 1 : 0) - (this.isActionHeld('MOVE_LEFT') ? 1 : 0)
    const moveY =
      this.stickY ||
      (this.isActionHeld('MOVE_DOWN') ? 1 : 0) - (this.isActionHeld('MOVE_UP') ? 1 : 0)

    return {
      moveX,
      moveY,
      confirm: this.isActionHeld('CONFIRM'),
      back: this.isActionHeld('BACK'),
      pause: this.isActionHeld('PAUSE'),
      confirmPressed: this.wasActionPressed('CONFIRM'),
      backPressed: this.wasActionPressed('BACK'),
      pausePressed: this.wasActionPressed('PAUSE'),
      upPressed: this.wasActionPressed('MOVE_UP'),
      downPressed: this.wasActionPressed('MOVE_DOWN'),
    }
  }

  isActionHeld(action: Action): boolean {
    const binding = this.bindings[action]
    if (!binding) return false
    return this.isBindingHeld(binding)
  }

  wasActionPressed(action: Action): boolean {
    const binding = this.bindings[action]
    if (!binding) return false
    return this.isBindingPressed(binding)
  }

  private isBindingHeld(binding: Binding): boolean {
    if (binding.source === 'keyboard') {
      return this.keysDown.has(binding.code)
    }
    if (binding.source === 'gamepad-button') {
      return this.buttonsDown.has(binding.code)
    }
    const key = `${binding.code}:${binding.axisSign ?? 1}`
    return this.axisState.get(key) ?? false
  }

  private isBindingPressed(binding: Binding): boolean {
    if (binding.source === 'keyboard') {
      return this.keysDown.has(binding.code) && !this.prevKeysDown.has(binding.code)
    }
    if (binding.source === 'gamepad-button') {
      return this.buttonsDown.has(binding.code) && !this.prevButtonsDown.has(binding.code)
    }
    const key = `${binding.code}:${binding.axisSign ?? 1}`
    return (this.axisState.get(key) ?? false) && !(this.prevAxisState.get(key) ?? false)
  }

  /** 按键绑定页：捕获下一个输入 */
  captureNextBinding(): Binding | null {
    for (const code of this.keysDown) {
      if (!this.prevKeysDown.has(code)) {
        return { source: 'keyboard', code }
      }
    }
    for (const code of this.buttonsDown) {
      if (!this.prevButtonsDown.has(code)) {
        return { source: 'gamepad-button', code }
      }
    }
    for (const [key] of this.axisState) {
      if (!this.prevAxisState.get(key)) {
        const [axis, sign] = key.split(':')
        return {
          source: 'gamepad-axis',
          code: axis,
          axisSign: Number(sign) as 1 | -1,
        }
      }
    }
    return null
  }
}

function applyDeadzone(value: number): number {
  if (Math.abs(value) < AXIS_DEADZONE) return 0
  const sign = Math.sign(value)
  const scaled = (Math.abs(value) - AXIS_DEADZONE) / (1 - AXIS_DEADZONE)
  return sign * scaled
}
