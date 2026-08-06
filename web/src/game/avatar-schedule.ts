import { SCHEDULE_DAY_SEC } from './avatar-config'
import type { CircleEntity } from './entity'
import { isJuvenile } from './entity'

export type SchedulePhase = 'sleep' | 'eat' | 'learn' | 'play'

interface PhaseWeight {
  phase: SchedulePhase
  weight: number
}

/** 成年圆默认日程（已移除闲逛） */
const ADULT_WEIGHTS: PhaseWeight[] = [
  { phase: 'sleep', weight: 0.2 },
  { phase: 'eat', weight: 0.38 },
  { phase: 'learn', weight: 0.14 },
  { phase: 'play', weight: 0.28 },
]

const JUVENILE_WEIGHTS: PhaseWeight[] = [
  { phase: 'sleep', weight: 0.18 },
  { phase: 'eat', weight: 0.32 },
  { phase: 'learn', weight: 0.18 },
  { phase: 'play', weight: 0.32 },
]

/** 求偶意图：提高觅食与吸收快乐权重以便移动相遇 */
const SEEKING_MATE_WEIGHTS: PhaseWeight[] = [
  { phase: 'sleep', weight: 0.12 },
  { phase: 'eat', weight: 0.34 },
  { phase: 'learn', weight: 0.08 },
  { phase: 'play', weight: 0.46 },
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
  return 'eat'
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
  }
}

/** 可尝试化身的日程时段 */
export function isTransformPhase(phase: SchedulePhase): boolean {
  return phase === 'eat'
}
