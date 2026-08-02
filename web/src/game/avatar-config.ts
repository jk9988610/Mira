import { PLAYER_START_MASS } from './physics'

export const FARM_BUILD_COST = PLAYER_START_MASS * 2.5
export const RANCH_BUILD_COST = PLAYER_START_MASS * 4
export const FARM_STRUCTURE_MASS = PLAYER_START_MASS * 1.8
export const RANCH_STRUCTURE_MASS = PLAYER_START_MASS * 2.8
export const FARM_PELLET_INTERVAL_SEC = 3
export const FARM_PELLET_RING_RADIUS = 130
export const FARM_PELLET_COUNT = 8
/** 单农场感知半径内（含其他农场产出的）颗粒上限 */
export const FARM_NEARBY_PELLET_CAP = 48
export const FARM_PELLET_SENSE_RADIUS = FARM_PELLET_RING_RADIUS + 90
export const RANCH_ALLY_INTERVAL_SEC = 30
export const RANCH_SPAWN_RING_RADIUS = 200
export const AVATAR_INITIAL_PELLETS = 220
export const AVATAR_SPAWN_OFFSET = 100
export const STARTER_FARM_OFFSET = { x: 200, y: -70 }
export const STARTER_RANCH_OFFSET = { x: -180, y: 60 }
export const SPAWN_CLEARANCE = 48

/** 每个牧场最多支撑的农场数（超过则禁止再建农场） */
export const FARMS_PER_RANCH = 8
/** 每个牧场最多同时存在的可移动圆数（玩家 + 后代） */
export const ALLIES_PER_RANCH = 4
/** 化身冷却时间（秒） */
export const AVATAR_TRANSFORM_COOLDOWN_SEC = 3
/** 世界颗粒总量上限（性能保护） */
export const AVATAR_MAX_PELLETS = 1200
/** AI 寻位目标缓存时间（秒） */
export const AVATAR_SEEK_CACHE_SEC = 0.4

/** @deprecated */
export const AVATAR_FARM_MASS_THRESHOLD = FARM_BUILD_COST
/** @deprecated */
export const AVATAR_RANCH_MASS_THRESHOLD = RANCH_BUILD_COST
