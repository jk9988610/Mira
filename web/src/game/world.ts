import { massToRadius, PLAYER_START_MASS } from './physics'

/** 参考 16:9 屏幕在默认缩放下可见的一屏世界尺寸 */
const VIEW_FILL = 0.48
const REF_SCREEN_W = 1280
const REF_SCREEN_H = 720
const BASE_VIEW_RADIUS = massToRadius(PLAYER_START_MASS) * 3.2
const REF_RENDER_SCALE = (Math.min(REF_SCREEN_W, REF_SCREEN_H) * VIEW_FILL) / BASE_VIEW_RADIUS
const WORLD_SCALE = 4

export const WORLD_WIDTH = Math.round((REF_SCREEN_W / REF_RENDER_SCALE) * WORLD_SCALE)
export const WORLD_HEIGHT = Math.round((REF_SCREEN_H / REF_RENDER_SCALE) * WORLD_SCALE)
