export function requestAppFullscreen(): void {
  const el = document.documentElement
  const req =
    el.requestFullscreen?.bind(el) ??
    (el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> })
      .webkitRequestFullscreen?.bind(el)

  if (!req) return
  req().catch(() => {
    // 部分浏览器需用户手势；进入游戏时会再次尝试
  })
}
