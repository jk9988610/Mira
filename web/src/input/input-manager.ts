import type { Action, Binding } from './actions'
import {
  isGamepadApiAvailable,
  readStandardGamepad,
  STANDARD_GAMEPAD_ACTIONS,
  installGamepadListeners,
} from './gamepad'

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
  splitPressed: boolean
  upPressed: boolean
  downPressed: boolean
}

export interface GamepadStatus {
  apiAvailable: boolean
  connected: boolean
  activated: boolean
  id: string
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
  private prevStickY = 0
  private standardHeld = new Set<string>()
  private standardFrame = readStandardGamepad(this.standardHeld)
  private statusListeners = new Set<(status: GamepadStatus) => void>()

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
    installGamepadListeners(() => this.notifyStatus())
  }

  setBindings(bindings: Record<Action, Binding>): void {
    this.bindings = bindings
  }

  getBindings(): Record<Action, Binding> {
    return this.bindings
  }

  onStatusChange(listener: (status: GamepadStatus) => void): () => void {
    this.statusListeners.add(listener)
    listener(this.getGamepadStatus())
    return () => this.statusListeners.delete(listener)
  }

  getGamepadStatus(): GamepadStatus {
    return {
      apiAvailable: isGamepadApiAvailable(),
      connected: this.standardFrame.connected,
      activated: this.standardFrame.activated,
      id: this.standardFrame.id,
    }
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
        if (btn.pressed || btn.value > 0.5) this.buttonsDown.add(String(i))
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

    this.standardFrame = readStandardGamepad(this.standardHeld)
    this.standardHeld = new Set(this.standardFrame.buttonsHeld)

    if (Math.abs(this.standardFrame.moveX) > 0) this.stickX = this.standardFrame.moveX
    if (Math.abs(this.standardFrame.moveY) > 0) this.stickY = this.standardFrame.moveY

    this.notifyStatus()
  }

  snapshot(): InputSnapshot {
    const moveX =
      this.stickX ||
      actionAxis(this, 'MOVE_RIGHT', 'MOVE_LEFT')
    const moveY =
      this.stickY ||
      actionAxis(this, 'MOVE_DOWN', 'MOVE_UP')

    const upPressed =
      this.wasActionPressed('MOVE_UP') || stickEdge(this.prevStickY, this.stickY, -1)
    const downPressed =
      this.wasActionPressed('MOVE_DOWN') || stickEdge(this.prevStickY, this.stickY, 1)

    this.prevStickY = this.stickY

    return {
      moveX,
      moveY,
      confirm: this.isActionHeld('CONFIRM'),
      back: this.isActionHeld('BACK'),
      pause: this.isActionHeld('PAUSE'),
      confirmPressed: this.wasActionPressed('CONFIRM'),
      backPressed: this.wasActionPressed('BACK'),
      pausePressed: this.wasActionPressed('PAUSE'),
      splitPressed: this.wasActionPressed('SPLIT'),
      upPressed,
      downPressed,
    }
  }

  isActionHeld(action: Action): boolean {
    return this.isBindingHeld(this.bindings[action]) || this.isStandardHeld(action)
  }

  wasActionPressed(action: Action): boolean {
    return this.isBindingPressed(this.bindings[action]) || this.isStandardPressed(action)
  }

  private isBindingHeld(binding: Binding): boolean {
    if (!binding) return false
    if (binding.source === 'keyboard') return this.keysDown.has(binding.code)
    if (binding.source === 'gamepad-button') return this.buttonsDown.has(binding.code)
    const key = `${binding.code}:${binding.axisSign ?? 1}`
    return this.axisState.get(key) ?? false
  }

  private isBindingPressed(binding: Binding): boolean {
    if (!binding) return false
    if (binding.source === 'keyboard') {
      return this.keysDown.has(binding.code) && !this.prevKeysDown.has(binding.code)
    }
    if (binding.source === 'gamepad-button') {
      return this.buttonsDown.has(binding.code) && !this.prevButtonsDown.has(binding.code)
    }
    const key = `${binding.code}:${binding.axisSign ?? 1}`
    return (this.axisState.get(key) ?? false) && !(this.prevAxisState.get(key) ?? false)
  }

  private isStandardHeld(action: Action): boolean {
    if (!this.standardFrame.connected) return false
    const codes = STANDARD_GAMEPAD_ACTIONS[action as keyof typeof STANDARD_GAMEPAD_ACTIONS]
    if (!codes) return false
    return codes.some((code) => this.standardFrame.buttonsHeld.has(code))
  }

  private isStandardPressed(action: Action): boolean {
    if (!this.standardFrame.connected) return false
    const codes = STANDARD_GAMEPAD_ACTIONS[action as keyof typeof STANDARD_GAMEPAD_ACTIONS]
    if (!codes) return false
    return codes.some((code) => this.standardFrame.buttonsPressed.has(code))
  }

  captureNextBinding(): Binding | null {
    for (const code of this.keysDown) {
      if (!this.prevKeysDown.has(code)) return { source: 'keyboard', code }
    }
    for (const code of this.buttonsDown) {
      if (!this.prevButtonsDown.has(code)) return { source: 'gamepad-button', code }
    }
    for (const code of this.standardFrame.buttonsPressed) {
      return { source: 'gamepad-button', code }
    }
    for (const [key] of this.axisState) {
      if (!this.prevAxisState.get(key)) {
        const [axis, sign] = key.split(':')
        return { source: 'gamepad-axis', code: axis, axisSign: Number(sign) as 1 | -1 }
      }
    }
    const lx = this.standardFrame.moveX
    const ly = this.standardFrame.moveY
    if (Math.abs(lx) > 0.5) return { source: 'gamepad-axis', code: '0', axisSign: lx > 0 ? 1 : -1 }
    if (Math.abs(ly) > 0.5) return { source: 'gamepad-axis', code: '1', axisSign: ly > 0 ? 1 : -1 }
    return null
  }

  private notifyStatus(): void {
    const status = this.getGamepadStatus()
    for (const listener of this.statusListeners) listener(status)
  }
}

function actionAxis(self: InputManager, positive: Action, negative: Action): number {
  return (self.isActionHeld(positive) ? 1 : 0) - (self.isActionHeld(negative) ? 1 : 0)
}

function applyDeadzone(value: number): number {
  if (Math.abs(value) < AXIS_DEADZONE) return 0
  const sign = Math.sign(value)
  const scaled = (Math.abs(value) - AXIS_DEADZONE) / (1 - AXIS_DEADZONE)
  return sign * scaled
}

function stickEdge(prev: number, current: number, direction: 1 | -1): boolean {
  const threshold = 0.6
  if (direction < 0) return prev > -threshold && current <= -threshold
  return prev < threshold && current >= threshold
}
