export interface RosterEntry {
  name: string
  colorLight: string
  colorDark: string
  strokeColor: string
}

export const PLAYER_ROSTER: RosterEntry = {
  name: '你',
  colorLight: '#8fd3ff',
  colorDark: '#2f7fd3',
  strokeColor: '#d8f1ff',
}

export const AI_ROSTER: RosterEntry[] = [
  { name: '可乐', colorLight: '#c68a5a', colorDark: '#6b3a1f', strokeColor: '#e8b48a' },
  { name: '桃子', colorLight: '#ffb3d9', colorDark: '#e05a9a', strokeColor: '#ffd4eb' },
  { name: '抹茶', colorLight: '#9fd89f', colorDark: '#3d7a3d', strokeColor: '#c8f0c8' },
  { name: '蓝莓', colorLight: '#7da2ff', colorDark: '#2a4db8', strokeColor: '#b8ccff' },
  { name: '柠檬', colorLight: '#fff06a', colorDark: '#c9a800', strokeColor: '#fff5a8' },
  { name: '葡萄', colorLight: '#c49bff', colorDark: '#6b32b8', strokeColor: '#e0c4ff' },
  { name: '珊瑚', colorLight: '#ff9f8a', colorDark: '#d44a32', strokeColor: '#ffc8bb' },
  { name: '薄荷', colorLight: '#8ff0d4', colorDark: '#2a9a78', strokeColor: '#c0ffe8' },
  { name: '焦糖', colorLight: '#f0b35a', colorDark: '#a86412', strokeColor: '#ffd89a' },
]
