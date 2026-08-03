import { SCHEDULE_DAY_SEC } from './avatar-config'

export type SchedulePhase = 'sleep' | 'eat' | 'learn' | 'play' | 'wander'

const PHASES: SchedulePhase[] = ['sleep', 'eat', 'learn', 'play', 'wander']

export function currentSchedulePhase(entity: { id: number }, gameTimeSec: number): SchedulePhase {
  const t = (gameTimeSec + entity.id * 13.7) % SCHEDULE_DAY_SEC
  const idx = Math.floor((t / SCHEDULE_DAY_SEC) * PHASES.length)
  return PHASES[Math.min(PHASES.length - 1, idx)]
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
