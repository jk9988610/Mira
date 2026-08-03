/** 盟友 AI 隔帧更新：实体数超过阈值时降低更新频率 */
export function allyUpdateStride(entityCount: number): number {
  if (entityCount > 200) return 3
  if (entityCount > 120) return 2
  return 1
}

/** 半径低于此值时用纯色绘制，跳过渐变 */
export const ENTITY_SIMPLE_DRAW_RADIUS = 14
