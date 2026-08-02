const AXIS_DEADZONE = 0.35

export interface StandardGamepadFrame {
  connected: boolean
  activated: boolean
  id: string
  moveX: number
  moveY: number
  buttonsHeld: Set<string>
  buttonsPressed: Set<string>
}

export function readStandardGamepad(
  prevHeld: Set<string>,
): StandardGamepadFrame {
  const empty: StandardGamepadFrame = {
    connected: false,
    activated: false,
    id: '',
    moveX: 0,
    moveY: 0,
    buttonsHeld: new Set(),
    buttonsPressed: new Set(),
  }

  if (!('getGamepads' in navigator)) return empty

  const pads = navigator.getGamepads()
  const pad = pads[0] ?? pads[1] ?? pads[2] ?? pads[3]
  if (!pad) return empty

  const buttonsHeld = new Set<string>()
  const buttonsPressed = new Set<string>()
  pad.buttons.forEach((btn, i) => {
    if (btn.pressed || btn.value > 0.5) {
      const code = String(i)
      buttonsHeld.add(code)
      if (!prevHeld.has(code)) buttonsPressed.add(code)
    }
  })

  const moveX = applyDeadzone(pad.axes[0] ?? 0)
  const moveY = applyDeadzone(pad.axes[1] ?? 0)

  // 十字键作为按钮 12-15；部分手柄用 axes 2/3 表示十字键
  const dpadX = applyDeadzone(pad.axes[2] ?? 0)
  const dpadY = applyDeadzone(pad.axes[3] ?? 0)
  if (dpadX < -0.5) markButton(buttonsHeld, buttonsPressed, prevHeld, '14')
  if (dpadX > 0.5) markButton(buttonsHeld, buttonsPressed, prevHeld, '15')
  if (dpadY < -0.5) markButton(buttonsHeld, buttonsPressed, prevHeld, '12')
  if (dpadY > 0.5) markButton(buttonsHeld, buttonsPressed, prevHeld, '13')

  const activated =
    buttonsHeld.size > 0 || Math.abs(moveX) > 0 || Math.abs(moveY) > 0 || Math.abs(dpadX) > 0 || Math.abs(dpadY) > 0

  return {
    connected: true,
    activated,
    id: pad.id,
    moveX,
    moveY,
    buttonsHeld,
    buttonsPressed,
  }
}

export function installGamepadListeners(onChange: () => void): void {
  window.addEventListener('gamepadconnected', () => onChange())
  window.addEventListener('gamepaddisconnected', () => onChange())
}

function markButton(
  held: Set<string>,
  pressed: Set<string>,
  prevHeld: Set<string>,
  code: string,
): void {
  held.add(code)
  if (!prevHeld.has(code)) pressed.add(code)
}

function applyDeadzone(value: number): number {
  if (Math.abs(value) < AXIS_DEADZONE) return 0
  const sign = Math.sign(value)
  const scaled = (Math.abs(value) - AXIS_DEADZONE) / (1 - AXIS_DEADZONE)
  return sign * scaled
}

/** 标准 Xbox 布局回退映射 */
export const STANDARD_GAMEPAD_ACTIONS = {
  MOVE_UP: ['12'],
  MOVE_DOWN: ['13'],
  MOVE_LEFT: ['14'],
  MOVE_RIGHT: ['15'],
  CONFIRM: ['0'],
  BACK: ['1'],
  PAUSE: ['9'],
  SPLIT: ['2'],
  GATHER: ['3'],
} as const

export function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

export function isGamepadApiAvailable(): boolean {
  return 'getGamepads' in navigator
}
