import { PLAYER_START_MASS } from './physics'

/** 饱食/知识/快乐/健康均以质量同类数值表示 */
export const SATIETY_CAP = PLAYER_START_MASS * 3
export const KNOWLEDGE_CAP = PLAYER_START_MASS * 0.85
export const JOY_CAP = PLAYER_START_MASS * 0.85
export const HEALTH_CAP = PLAYER_START_MASS * 5
export const HEALTH_FLOOR = PLAYER_START_MASS * 0.4

export const TRAIT_INTAKE_CAP = PLAYER_START_MASS * 0.55

export const SATIETY_ABSORB_PAUSE_RATIO = 0.88
export const SATIETY_ABSORB_RESUME_RATIO = 0.75
export const SATIETY_IDLE_DECAY = PLAYER_START_MASS * 0.0016
export const SATIETY_MOVE_DECAY = PLAYER_START_MASS * 0.0007
export const SATIETY_SLEEP_DECAY = PLAYER_START_MASS * 0.00035
export const SATIETY_LOW_THRESHOLD = PLAYER_START_MASS * 0.35
export const SATIETY_STARVE_MASS_DRAIN = PLAYER_START_MASS * 0.004
export const SATIETY_GAIN_PER_MASS = 0.38
export const SATIETY_PER_INTAKE_MASS = 0.35
export const SATIETY_ABSORB_BATCH_RATIO = 0.72

export const TRAIT_IDLE_DECAY = PLAYER_START_MASS * 0.0025
export const TRAIT_SLEEP_DECAY = PLAYER_START_MASS * 0.001
export const TRAIT_LOW_THRESHOLD = PLAYER_START_MASS * 0.3
export const TRAIT_DIGEST_RATE = PLAYER_START_MASS * 0.28
export const HEALTH_DECAY_LOW_TRAIT = PLAYER_START_MASS * 0.006

export const BODY_MASS_CAP_BASE = PLAYER_START_MASS * 10
export const INTAKE_MASS_CAP_BASE = PLAYER_START_MASS * 2.2
export const DIGEST_BASE_RATE = PLAYER_START_MASS * 0.12
export const AVG_PELLET_MASS_ESTIMATE = PLAYER_START_MASS * 0.045

export const HEALTH_RECOVER_RATE = PLAYER_START_MASS * 0.01
export const HEALTH_DECAY_STARVE = PLAYER_START_MASS * 0.02
export const HEALTH_DECAY_LOW_SATIETY = PLAYER_START_MASS * 0.008

export const CIRCLE_LIFESPAN_SEC = 360
export const LIFESPAN_EVAL_INTERVAL_SEC = 30
export const LIFESPAN_AVATAR_TRANS_THRESHOLD = 3
export const LOW_MASS_PENALTY_SEC = 4

export const DAY_DURATION_SEC = 24
export const DAY_WORK_SEC = 8
export const DAY_SLEEP_SEC = 8
export const DAY_FORAGE_SEC = 8

/** 每个圆的一日日程循环（秒） */
export const SCHEDULE_DAY_SEC = 100

export const AVATAR_TRANSFORM_DURATION_SEC = 8
export const WORK_PELLET_INTERVAL_SEC = 1.6
export const WORK_PELLET_RING_RADIUS = 58
export const WORK_PELLET_COUNT = 12
export const WORK_NEARBY_PELLET_CAP = 110
export const WORK_PELLET_SENSE_RADIUS = WORK_PELLET_RING_RADIUS + 90
export const LEARN_PELLET_INTERVAL_SEC = 1.8
export const LEARN_PELLET_COUNT = 8
export const PLAY_PELLET_INTERVAL_SEC = 1.8
export const PLAY_PELLET_COUNT = 8
export const PRODUCTION_DURATION_SEC = 2
export const PRODUCTION_COOLDOWN_SEC = 8 // 仅雌性生产后冷却
export const MATE_SIGNAL_RANGE_RATIO = 0.46
export const MATE_SIGNAL_MIN_STRENGTH = 0.08
export const MATE_PURSUIT_SPEED = 240
/** 达到此年龄（秒）视为成年 */
export const ADULT_AGE_SEC = 24

/** 新生后代在母亲身边停留时长（秒） */
export const OFFSPRING_MOTHER_BOND_SEC = 14

/** 超过该年龄后求偶信号大幅衰减 */
export const ELDER_MATE_AGE_SEC = 55

/** 自然闲逛：换向间隔与转向平滑 */
export const WANDER_INTERVAL_MIN_SEC = 3.5
export const WANDER_INTERVAL_MAX_SEC = 7
export const WANDER_STEER = 2.8

/** 家族市场 */
export const INITIAL_FAMILY_FUNDS = 90
export const ORDER_POST_COST = 18
export const ORDER_POST_COOLDOWN_SEC = 22
export const ORDER_DEADLINE_SEC = 35
export const ORDER_REWARD = 28
export const ORDER_FULFILL_RADIUS = 95
export const FAMILY_SHARE_OF_REWARD = 0.5
export const FAMILY_NEED_POST_THRESHOLD = 0.38
export const MAX_ORDER_HISTORY = 5
/** 每种颗粒（食物/知识/快乐）的初始数量 */
export const AVATAR_INITIAL_PELLETS_PER_KIND = 18
export const AVATAR_SPAWN_OFFSET = 100
export const SPAWN_CLEARANCE = 48

export const STARTER_OPTIMAL_MASS = PLAYER_START_MASS * 4
export const AVATAR_BASE_RADIUS = 28
export const AVATAR_TRANSFORM_COOLDOWN_SEC = 3
export const AVATAR_MAX_PELLETS = 1400
export const AVATAR_SEEK_CACHE_SEC = 0.4
export const AVATAR_SEEK_FAIL_CACHE_SEC = 1.5

export const NPC_TARGET_CACHE_SEC = 1.4
export const NPC_ARRIVE_DIST = 36
export const NPC_JITTER_DIST = 8

/** 上次化身类型权重衰减 */
export const TRANSFORM_REPEAT_PENALTY = 0.38

/** 农场/校园/乐园化身权重（农场为主） */
export const FARM_TRANSFORM_WEIGHT = 4.2
export const SCHOOL_TRANSFORM_WEIGHT = 0.35
export const PARK_TRANSFORM_WEIGHT = 0.3
/** 雄性产后化身为农场的额外权重倍率 */
export const MALE_POST_PRODUCTION_FARM_MULT = 3.2

/** 跳过化身的随机概率（越低越常化身） */
export const TRANSFORM_SKIP_CHANCE = 0.18
