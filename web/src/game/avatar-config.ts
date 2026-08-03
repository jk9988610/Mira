import { PLAYER_START_MASS } from './physics'

export const FARM_BUILD_COST = PLAYER_START_MASS * 2.5
export const RANCH_BUILD_COST = PLAYER_START_MASS * 4
/** 达到此质量视为成年，可化身工作建筑 */
export const ADULT_MASS_THRESHOLD = FARM_BUILD_COST
export const SCHOOL_BUILD_COST = FARM_BUILD_COST
export const PARK_BUILD_COST = FARM_BUILD_COST

/** 知识/快乐达到此值可化身学校/乐园 */
export const SCHOOL_UNLOCK_KNOWLEDGE = 0.55
export const PARK_UNLOCK_JOY = 0.55

/** 饱食度高于此值时暂停摄取食物颗粒 */
export const SATIETY_ABSORB_PAUSE = 0.82
export const SATIETY_ABSORB_RESUME = 0.72
export const SATIETY_IDLE_DECAY = 0.018
export const SATIETY_MOVE_DECAY = 0.006
export const SATIETY_SLEEP_DECAY = 0.004
export const SATIETY_LOW_THRESHOLD = 0.28
export const SATIETY_STARVE_MASS_DRAIN = PLAYER_START_MASS * 0.004
export const SATIETY_GAIN_PER_START_MASS = 0.08
export const SATIETY_PER_INTAKE_MASS = 0.35
export const SATIETY_ABSORB_BATCH_THRESHOLD = 0.68

/** 知识/快乐代谢 */
export const KNOWLEDGE_ABSORB_PAUSE = 0.85
export const KNOWLEDGE_ABSORB_RESUME = 0.72
export const JOY_ABSORB_PAUSE = 0.85
export const JOY_ABSORB_RESUME = 0.72
export const TRAIT_IDLE_DECAY = 0.01
export const TRAIT_SLEEP_DECAY = 0.003
export const TRAIT_PER_INTAKE = 0.4
export const TRAIT_INTAKE_CAP = 0.55
export const TRAIT_LOW_THRESHOLD = 0.25
export const HEALTH_DECAY_LOW_TRAIT = 0.01

export const HEALTH_MAX = 1
export const HEALTH_MIN = 0.25
export const BODY_MASS_CAP_BASE = PLAYER_START_MASS * 10
export const INTAKE_MASS_CAP_BASE = PLAYER_START_MASS * 2.2
export const DIGEST_BASE_RATE = PLAYER_START_MASS * 0.12
export const TRAIT_DIGEST_RATE = 0.22
export const AVG_PELLET_MASS_ESTIMATE = PLAYER_START_MASS * 0.045

export const HEALTH_RECOVER_RATE = 0.012
export const HEALTH_DECAY_STARVE = 0.04
export const HEALTH_DECAY_LOW_SATIETY = 0.015

export const CIRCLE_LIFESPAN_SEC = 360
export const LIFESPAN_EVAL_INTERVAL_SEC = 30
export const LIFESPAN_AVATAR_TRANS_THRESHOLD = 3
export const LOW_MASS_PENALTY_SEC = 4

export const DAY_DURATION_SEC = 24
export const DAY_WORK_SEC = 8
export const DAY_SLEEP_SEC = 8
export const DAY_FORAGE_SEC = 8
export const WEEKDAY_COUNT = 5
export const RANCH_MOMENT_FARM_STREAK = 3

/** 所有化身固定持续 8 秒 */
export const AVATAR_TRANSFORM_DURATION_SEC = 8
export const FARM_PELLET_INTERVAL_SEC = 1.6
export const FARM_PELLET_RING_RADIUS = 130
export const FARM_PELLET_COUNT = 12
export const FARM_NEARBY_PELLET_CAP = 110
export const FARM_PELLET_SENSE_RADIUS = FARM_PELLET_RING_RADIUS + 90
export const SCHOOL_PELLET_INTERVAL_SEC = 1.8
export const SCHOOL_PELLET_COUNT = 8
export const PARK_PELLET_INTERVAL_SEC = 1.8
export const PARK_PELLET_COUNT = 8
export const RANCH_ALLY_INTERVAL_SEC = 4
export const RANCH_SPAWN_RING_RADIUS = 200
export const RANCH_ALLIES_BEFORE_REVERT = 2
export const AVATAR_INITIAL_PELLETS = 280
export const AVATAR_SPAWN_OFFSET = 100
export const SPAWN_CLEARANCE = 48

export const STARTER_OPTIMAL_MASS = RANCH_BUILD_COST

/** 视觉缩放（L/R），不影响碰撞/质量逻辑 */
export const VISUAL_SCALE_MIN = 0.55
export const VISUAL_SCALE_MAX = 1.75
export const VISUAL_SCALE_DEFAULT = 1
export const VISUAL_SCALE_STEP = 0.06
export const VISUAL_SCALE_SPEED = 1.8
/** 固定显示半径基数 */
export const AVATAR_BASE_RADIUS = 28

export const ALLIES_PER_RANCH = 4
export const AVATAR_TRANSFORM_COOLDOWN_SEC = 3
export const AVATAR_MAX_PELLETS = 1400
export const AVATAR_SEEK_CACHE_SEC = 0.4
export const AVATAR_SEEK_FAIL_CACHE_SEC = 1.5

export const NPC_TARGET_CACHE_SEC = 1.4
export const NPC_ARRIVE_DIST = 36
/** 堆叠时抑制来回微移的阈值 */
export const NPC_JITTER_DIST = 8

/** @deprecated */
export const FARM_PELLET_CYCLES_BEFORE_REVERT = 10
/** @deprecated */
export const AVATAR_FARM_MASS_THRESHOLD = FARM_BUILD_COST
/** @deprecated */
export const AVATAR_RANCH_MASS_THRESHOLD = RANCH_BUILD_COST
