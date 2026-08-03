import { PLAYER_START_MASS } from './physics'

export const FARM_BUILD_COST = PLAYER_START_MASS * 2.5
export const RANCH_BUILD_COST = PLAYER_START_MASS * 4

/** 质量达到约牧场化身门槛 1.15 倍时暂停摄取颗粒 */
export const ABSORPTION_PAUSE_MASS = RANCH_BUILD_COST * 1.15
/** 质量回落到此值以下时恢复摄取 */
export const ABSORPTION_RESUME_MASS = RANCH_BUILD_COST * 1.05

/** 静止代谢消耗（质量/秒） */
export const METABOLISM_IDLE_RATE = PLAYER_START_MASS * 0.0035
/** 移动时额外代谢消耗（质量/秒） */
export const METABOLISM_MOVE_RATE = PLAYER_START_MASS * 0.014
/** 低温时代谢加速倍率 */
export const METABOLISM_COLD_MULT = 1.8

/** 移动时体温上升（每秒） */
export const TEMPERATURE_MOVE_GAIN = 0.1
/** 静止时自然散热（每秒） */
export const TEMPERATURE_IDLE_DECAY = 0.03
/** 消耗质量维持体温的速率（质量/秒·每单位体温缺口） */
export const TEMPERATURE_MAINTENANCE_RATE = PLAYER_START_MASS * 0.006
/** 体温低于此值时死亡 */
export const TEMPERATURE_DEATH_THRESHOLD = 0.12
/** 代谢产热：每消耗 1 单位质量带来的体温恢复 */
export const TEMPERATURE_METABOLIC_HEAT = 0.08

/** 可移动圆默认寿命（秒） */
export const CIRCLE_LIFESPAN_SEC = 240

export const FARM_PELLET_INTERVAL_SEC = 2.2
export const FARM_PELLET_RING_RADIUS = 130
export const FARM_PELLET_COUNT = 14
/** 单农场感知半径内（含其他农场产出的）颗粒上限 */
export const FARM_NEARBY_PELLET_CAP = 72
export const FARM_PELLET_SENSE_RADIUS = FARM_PELLET_RING_RADIUS + 90
/** 农场产出多少轮颗粒后结束化身 */
export const FARM_PELLET_CYCLES_BEFORE_REVERT = 8
export const RANCH_ALLY_INTERVAL_SEC = 30
export const RANCH_SPAWN_RING_RADIUS = 200
/** 牧场产出多少个圆后结束化身 */
export const RANCH_ALLIES_BEFORE_REVERT = 1
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
/** 寻位失败后的冷却（秒），避免每帧全图搜索导致卡死 */
export const AVATAR_SEEK_FAIL_CACHE_SEC = 1.5

/** 开局农场/牧场的初始质量 */
export const STARTER_FARM_MASS = FARM_BUILD_COST
export const STARTER_RANCH_MASS = RANCH_BUILD_COST

/** @deprecated */
export const AVATAR_FARM_MASS_THRESHOLD = FARM_BUILD_COST
/** @deprecated */
export const AVATAR_RANCH_MASS_THRESHOLD = RANCH_BUILD_COST
