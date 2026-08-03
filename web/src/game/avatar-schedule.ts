import { SCHEDULE_DAY_SEC } from './avatar-config'
import type { CircleEntity } from './entity'
import { isJuvenile } from './entity'

export type SchedulePhase = 'sleep' | 'eat' | 'learn' | 'play' | 'wander'

interface PhaseWeight {
  phase: SchedulePhase
  weight: number
}

/** 成年圆默认日程 */
const ADULT_WEIGHTS: PhaseWeight[] = [
  { phase: 'sleep', weight: 0.16 },
  { phase: 'eat', weight: 0.34 },
  { phase: 'learn', weight: 0.1 },
  { phase: 'play', weight: 0.1 },
  { phase: 'wander', weight: 0.3 },
]

/** 未成年：觅食为主，极少闲逛 */
const JUVENILE_WEIGHTS: PhaseWeight[] = [
  { phase: 'sleep', weight: 0.14 },
  { phase: 'eat', weight: 0.50 },
  { phase: 'learn', weight: 0.18 },
  { phase: 'play', weight: 0.16 },
  { phase: 'wander', weight: 0.02 },
]

/** 求偶意图：更多闲逛时间 */
const SEEKING_MATE_WEIGHTS: PhaseWeight[] = [
  { phase: 'sleep', weight: 0.12 },
  { phase: 'eat', weight: 0.2 },
  { phase: 'learn', weight: 0.06 },
  { phase: 'play', weight: 0.06 },
  { phase: 'wander', weight: 0.56 },
]

function buildCumulative(weights: PhaseWeight[]): { phase: SchedulePhase; end: number }[] {
  let sum = 0
  return weights.map(({ phase, weight }) => {
    sum += weight
    return { phase, end: sum }
  })
}

const ADULT_CUMULATIVE = buildCumulative(ADULT_WEIGHTS)
const JUVENILE_CUMULATIVE = buildCumulative(JUVENILE_WEIGHTS)
const SEEKING_CUMULATIVE = buildCumulative(SEEKING_MATE_WEIGHTS)

function phaseFromCumulative(
  t: number,
  cumulative: { phase: SchedulePhase; end: number }[],
): SchedulePhase {
  for (const entry of cumulative) {
    if (t < entry.end) return entry.phase
  }
  return 'wander'
}

export function currentSchedulePhase(
  entity: CircleEntity,
  gameTimeSec: number,
  seekingMate = false,
): SchedulePhase {
  const offset = entity.scheduleOffsetSec + entity.id * 2.3
  const t = ((gameTimeSec + offset) % SCHEDULE_DAY_SEC) / SCHEDULE_DAY_SEC
  if (isJuvenile(entity, gameTimeSec)) return phaseFromCumulative(t, JUVENILE_CUMULATIVE)
  if (seekingMate) return phaseFromCumulative(t, SEEKING_CUMULATIVE)
  return phaseFromCumulative(t, ADULT_CUMULATIVE)
}

export function schedulePhaseLabel(phase: SchedulePhase): string {
  switch (phase) {
    case 'sleep':
      return '睡觉'
    case 'eat':
      return '觅食'
    case 'learn':
      return '吸收知识'
    case 'play':
      return '吸收快乐'
    case 'wander':
      return '闲逛'
  }
}

/** 可尝试化身的日程时段 */
export function isTransformPhase(phase: SchedulePhase): boolean {
  return phase === 'wander' || phase === 'eat'
}
