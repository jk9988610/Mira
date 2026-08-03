import type { Pellet } from './pellet'

/** 原地移除指定 id 的颗粒，避免每帧 filter 产生新数组 */
export function removePelletsByIds(pellets: Pellet[], ids: Set<number>): Pellet[] {
  if (ids.size === 0) return pellets
  let write = 0
  for (let read = 0; read < pellets.length; read++) {
    if (!ids.has(pellets[read].id)) {
      pellets[write++] = pellets[read]
    }
  }
  if (write < pellets.length) pellets.length = write
  return pellets
}
