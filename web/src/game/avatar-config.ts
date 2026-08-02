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

/** @deprecated */
export const AVATAR_FARM_MASS_THRESHOLD = FARM_BUILD_COST
/** @deprecated */
export const AVATAR_RANCH_MASS_THRESHOLD = RANCH_BUILD_COST
