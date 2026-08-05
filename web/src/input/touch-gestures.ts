export interface PointerPoint {
  x: number
  y: number
}

export function pointerDistance(a: PointerPoint, b: PointerPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export function isTap(start: PointerPoint, end: PointerPoint, maxDist = 14): boolean {
  return pointerDistance(start, end) <= maxDist
}

export interface PointerTapHandlers {
  onPointerDown(x: number, y: number, width: number, height: number, pointerId: number): void
  onPointerUp(x: number, y: number, width: number, height: number, pointerId: number): void
}

/** 将 pointer down/up 转为 tap 回调，供菜单等场景复用 */
export function createPointerTapHandler(
  onTap: (x: number, y: number, width: number, height: number) => void,
): PointerTapHandlers {
  const starts = new Map<number, PointerPoint>()
  return {
    onPointerDown(x, y, _width, _height, pointerId) {
      starts.set(pointerId, { x, y })
    },
    onPointerUp(x, y, width, height, pointerId) {
      const start = starts.get(pointerId)
      starts.delete(pointerId)
      if (start && isTap(start, { x, y })) {
        onTap(x, y, width, height)
      }
    },
  }
}
