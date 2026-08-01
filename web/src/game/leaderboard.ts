import type { CircleEntity } from '../game/entity'
import { isActive } from '../game/entity'

export interface LeaderboardRow {
  rank: number
  name: string
  mass: number
  isPlayer: boolean
  respawning: boolean
}

export function buildLeaderboard(entities: CircleEntity[]): LeaderboardRow[] {
  return [...entities]
    .sort((a, b) => b.mass - a.mass)
    .map((e, i) => ({
      rank: i + 1,
      name: e.name,
      mass: e.mass,
      isPlayer: e.isPlayer,
      respawning: !isActive(e),
    }))
}
