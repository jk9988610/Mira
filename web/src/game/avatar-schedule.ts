import { SCHEDULE_DAY_SEC } from './avatar-config'

export type SchedulePhase = 'sleep' | 'eat' | 'learn' | 'play' | 'wander'

/** 日程权重：觅食与闲逛为主，知识/快乐为辅 */
const PHASE_WEIGHTS: { phase: SchedulePhase; weight: number }[] = [
  { phase: 'sleep', weight: 0.16 },
  { phase: 'eat', weight: 0.34 },
  { phase: 'learn', weight: 0.1 },
  { phase: 'play', weight: 0.1 },
  { phase: 'wander', weight: 0.3 },
]

const PHASE_CUMULATIVE: { phase: SchedulePhase; end: number }[] = (() => {
  let sum = 0
  return PHASE_WEIGHTS.map(({ phase, weight }) => {
    sum += weight
    return { phase, end: sum }
  })
})()

export function currentSchedulePhase(entity: { id: number }, gameTimeSec: number): SchedulePhase {
  const t = ((gameTimeSec + entity.id * 13.7) % SCHEDULE_DAY_SEC) / SCHEDULE_DAY_SEC
  for (const entry of PHASE_CUMULATIVE) {
    if (t < entry.end) return entry.phase
  }
  return 'wander'
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
