export interface ViewBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export function computeViewBounds(
  camX: number,
  camY: number,
  renderScale: number,
  width: number,
  height: number,
  pad = 120,
): ViewBounds {
  const halfW = width / renderScale / 2 + pad
  const halfH = height / renderScale / 2 + pad
  return {
    minX: camX - halfW,
    maxX: camX + halfW,
    minY: camY - halfH,
    maxY: camY + halfH,
  }
}

export function isInView(
  x: number,
  y: number,
  bounds: ViewBounds,
  margin = 0,
): boolean {
  return (
    x >= bounds.minX - margin &&
    x <= bounds.maxX + margin &&
    y >= bounds.minY - margin &&
    y <= bounds.maxY + margin
  )
}
