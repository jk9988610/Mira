import { PLAYER_START_MASS } from './physics'

export const FARM_BUILD_COST = PLAYER_START_MASS * 2.5
export const RANCH_BUILD_COST = PLAYER_START_MASS * 4

/** 饱食度高于此值时暂停摄取颗粒 */
export const SATIETY_ABSORB_PAUSE = 0.82
/** 饱食度低于此值时恢复摄取 */
export const SATIETY_ABSORB_RESUME = 0.72

/** 静止时饱食度下降（每秒，0~1） */
export const SATIETY_IDLE_DECAY = 0.018
/** 移动时额外饱食度下降（每秒） */
export const SATIETY_MOVE_DECAY = 0.006
/** 饱食度低于此值视为「经常挨饿」，影响寿命评估 */
export const SATIETY_LOW_THRESHOLD = 0.28
/** 饱食度为 0 时消耗质量（质量/秒） */
export const SATIETY_STARVE_MASS_DRAIN = PLAYER_START_MASS * 0.004
/** 每摄取相当于初始质量一份颗粒，饱食度上升量 */
export const SATIETY_GAIN_PER_START_MASS = 0.28

/** 基础寿命（秒） */
export const CIRCLE_LIFESPAN_SEC = 360
/** 寿命评估间隔（秒） */
export const LIFESPAN_EVAL_INTERVAL_SEC = 30
/** 化身次数超过此值后开始降低寿命评估 */
export const LIFESPAN_AVATAR_TRANS_THRESHOLD = 3
/** 低质量持续超过此秒数后，寿命消耗翻倍 */
export const LOW_MASS_PENALTY_SEC = 4

export const FARM_PELLET_INTERVAL_SEC = 1.6
export const FARM_PELLET_RING_RADIUS = 130
export const FARM_PELLET_COUNT = 26
/** 单农场感知半径内（含其他农场产出的）颗粒上限 */
export const FARM_NEARBY_PELLET_CAP = 110
export const FARM_PELLET_SENSE_RADIUS = FARM_PELLET_RING_RADIUS + 90
/** 农场产出多少轮颗粒后结束化身 */
export const FARM_PELLET_CYCLES_BEFORE_REVERT = 10
export const RANCH_ALLY_INTERVAL_SEC = 24
export const RANCH_SPAWN_RING_RADIUS = 200
/** 牧场产出多少个圆后结束化身 */
export const RANCH_ALLIES_BEFORE_REVERT = 2
export const AVATAR_INITIAL_PELLETS = 280
export const AVATAR_SPAWN_OFFSET = 100
export const SPAWN_CLEARANCE = 48

/** 开局 4 个圆的质量（可立即化身牧场） */
export const STARTER_OPTIMAL_MASS = RANCH_BUILD_COST

/** 每个牧场最多支撑的农场数（超过则禁止再建农场） */
export const FARMS_PER_RANCH = 8
/** 每个牧场最多同时存在的可移动圆数（玩家 + 后代） */
export const ALLIES_PER_RANCH = 4
/** 化身冷却时间（秒） */
export const AVATAR_TRANSFORM_COOLDOWN_SEC = 3
/** 世界颗粒总量上限（性能保护） */
export const AVATAR_MAX_PELLETS = 1400
/** AI 寻位目标缓存时间（秒） */
export const AVATAR_SEEK_CACHE_SEC = 0.4
/** 寻位失败后的冷却（秒），避免每帧全图搜索导致卡死 */
export const AVATAR_SEEK_FAIL_CACHE_SEC = 1.5

/** @deprecated */
export const AVATAR_FARM_MASS_THRESHOLD = FARM_BUILD_COST
/** @deprecated */
export const AVATAR_RANCH_MASS_THRESHOLD = RANCH_BUILD_COST
