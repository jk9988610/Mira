export type VirtualControlId =
  | 'joystick'
  | 'btnA'
  | 'btnB'
  | 'btnX'
  | 'btnY'
  | 'btnStart'
  | 'btnLb'
  | 'btnRb'

export interface VirtualControlPosition {
  /** 屏幕宽度比例（控件中心点） */
  x: number
  /** 屏幕高度比例（控件中心点） */
  y: number
}

export type VirtualControlsLayout = Record<VirtualControlId, VirtualControlPosition>

export const VIRTUAL_CONTROL_LABELS: Record<VirtualControlId, string> = {
  joystick: '摇杆',
  btnA: 'A',
  btnB: 'B',
  btnX: 'X',
  btnY: 'Y',
  btnStart: 'Start',
  btnLb: 'LB',
  btnRb: 'RB',
}

/** 默认布局：左摇杆，右下 ABXY 十字对齐，Start 顶部居中 */
export const DEFAULT_VIRTUAL_LAYOUT: VirtualControlsLayout = {
  joystick: { x: 0.14, y: 0.84 },
  btnY: { x: 0.88, y: 0.6 },
  btnX: { x: 0.76, y: 0.72 },
  btnB: { x: 0.96, y: 0.72 },
  btnA: { x: 0.88, y: 0.84 },
  btnStart: { x: 0.5, y: 0.07 },
  btnLb: { x: 0.12, y: 0.07 },
  btnRb: { x: 0.88, y: 0.07 },
}
