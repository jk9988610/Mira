import { isTouchDevice } from './gamepad'

export type Action =
  | 'MOVE_UP'
  | 'MOVE_DOWN'
  | 'MOVE_LEFT'
  | 'MOVE_RIGHT'
  | 'CONFIRM'
  | 'BACK'
  | 'PAUSE'
  | 'SPLIT'
  | 'GATHER'

export const ALL_ACTIONS: Action[] = [
  'MOVE_UP',
  'MOVE_DOWN',
  'MOVE_LEFT',
  'MOVE_RIGHT',
  'CONFIRM',
  'BACK',
  'PAUSE',
  'SPLIT',
  'GATHER',
]

export const ACTION_LABELS: Record<Action, string> = {
  MOVE_UP: '上移',
  MOVE_DOWN: '下移',
  MOVE_LEFT: '左移',
  MOVE_RIGHT: '右移',
  CONFIRM: '确认',
  BACK: '返回',
  PAUSE: '暂停',
  SPLIT: '分身',
  GATHER: '聚集',
}

export type BindingSource = 'keyboard' | 'gamepad-button' | 'gamepad-axis'

export interface Binding {
  source: BindingSource
  code: string
  /** 摇杆轴方向，仅 gamepad-axis 使用 */
  axisSign?: 1 | -1
}

export type BindingMap = Record<Action, Binding>

export const DEFAULT_BINDINGS: BindingMap = {
  MOVE_UP: { source: 'keyboard', code: 'ArrowUp' },
  MOVE_DOWN: { source: 'keyboard', code: 'ArrowDown' },
  MOVE_LEFT: { source: 'keyboard', code: 'ArrowLeft' },
  MOVE_RIGHT: { source: 'keyboard', code: 'ArrowRight' },
  CONFIRM: { source: 'keyboard', code: 'Enter' },
  BACK: { source: 'keyboard', code: 'Escape' },
  PAUSE: { source: 'keyboard', code: 'KeyP' },
  SPLIT: { source: 'keyboard', code: 'KeyQ' },
  GATHER: { source: 'keyboard', code: 'KeyE' },
}

export const GAMEPAD_DEFAULT_BINDINGS: Partial<BindingMap> = {
  MOVE_UP: { source: 'gamepad-button', code: '12' },
  MOVE_DOWN: { source: 'gamepad-button', code: '13' },
  MOVE_LEFT: { source: 'gamepad-button', code: '14' },
  MOVE_RIGHT: { source: 'gamepad-button', code: '15' },
  CONFIRM: { source: 'gamepad-button', code: '0' },
  BACK: { source: 'gamepad-button', code: '1' },
  PAUSE: { source: 'gamepad-button', code: '9' },
  SPLIT: { source: 'gamepad-button', code: '2' },
  GATHER: { source: 'gamepad-button', code: '3' },
}

const STORAGE_KEY = 'mira_bindings_v5'

function defaultBindingsForDevice(): BindingMap {
  if (isTouchDevice()) {
    return { ...DEFAULT_BINDINGS, ...GAMEPAD_DEFAULT_BINDINGS }
  }
  return { ...DEFAULT_BINDINGS }
}

export function loadBindings(): BindingMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultBindingsForDevice()
    const parsed = JSON.parse(raw) as Partial<BindingMap>
    return { ...defaultBindingsForDevice(), ...parsed }
  } catch {
    return defaultBindingsForDevice()
  }
}

export function saveBindings(bindings: BindingMap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings))
}

export function formatBinding(binding: Binding): string {
  if (binding.source === 'keyboard') {
    return KEYBOARD_LABELS[binding.code] ?? binding.code
  }
  if (binding.source === 'gamepad-button') {
    return GAMEPAD_BUTTON_LABELS[binding.code] ?? `按钮 ${binding.code}`
  }
  const sign = binding.axisSign === -1 ? '-' : '+'
  return `摇杆轴 ${binding.code}${sign}`
}

const KEYBOARD_LABELS: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Enter: 'Enter',
  Escape: 'Esc',
  Space: 'Space',
  KeyW: 'W',
  KeyA: 'A',
  KeyS: 'S',
  KeyD: 'D',
  KeyP: 'P',
  KeyQ: 'Q',
  KeyE: 'E',
}

const GAMEPAD_BUTTON_LABELS: Record<string, string> = {
  '0': 'A',
  '1': 'B',
  '2': 'X',
  '3': 'Y',
  '4': 'LB',
  '5': 'RB',
  '8': 'Select',
  '9': 'Start',
  '12': 'D-Pad 上',
  '13': 'D-Pad 下',
  '14': 'D-Pad 左',
  '15': 'D-Pad 右',
}

export function bindingFromKeyboard(code: string): Binding {
  return { source: 'keyboard', code }
}

export function bindingFromGamepadButton(index: number): Binding {
  return { source: 'gamepad-button', code: String(index) }
}

export function bindingFromGamepadAxis(index: number, sign: 1 | -1): Binding {
  return { source: 'gamepad-axis', code: String(index), axisSign: sign }
}
