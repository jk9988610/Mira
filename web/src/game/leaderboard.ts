import type { CircleEntity } from './entity'
import { isActive } from './entity'
import { getHumanTotalMass } from './player-team'
import { LEADERBOARD_TOP_N } from './match-config'

export interface LeaderboardRow {
  rank: number
  name: string
  mass: number
  isPlayer: boolean
  respawning: boolean
}

export interface LeaderboardView {
  top: LeaderboardRow[]
  playerRank: number | null
  playerMass: number
  playerInTop: boolean
}

function buildRawRows(entities: CircleEntity[]): Omit<LeaderboardRow, 'rank'>[] {
  const rows: Omit<LeaderboardRow, 'rank'>[] = []
  const humanMass = getHumanTotalMass(entities)
  const humanRespawning = entities.filter((e) => e.isPlayer).every((e) => !isActive(e))

  rows.push({
    name: '你',
    mass: humanMass,
    isPlayer: true,
    respawning: humanRespawning,
  })

  for (const e of entities) {
    if (e.isPlayer) continue
    rows.push({
      name: e.name,
      mass: isActive(e) ? e.mass : 0,
      isPlayer: false,
      respawning: !isActive(e),
    })
  }

  return rows.sort((a, b) => b.mass - a.mass)
}

export function buildLeaderboardView(entities: CircleEntity[]): LeaderboardView {
  const sorted = buildRawRows(entities).map((row, i) => ({ ...row, rank: i + 1 }))
  const playerRow = sorted.find((r) => r.isPlayer)
  const top = sorted.slice(0, LEADERBOARD_TOP_N)
  const playerInTop = top.some((r) => r.isPlayer)

  return {
    top,
    playerRank: playerRow?.rank ?? null,
    playerMass: playerRow?.mass ?? 0,
    playerInTop,
  }
}

/** @deprecated use buildLeaderboardView */
export function buildLeaderboard(entities: CircleEntity[]): LeaderboardRow[] {
  return buildRawRows(entities).map((row, i) => ({ ...row, rank: i + 1 }))
}
