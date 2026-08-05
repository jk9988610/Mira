export interface Scene {
  enter(): void
  exit(): void
  update(dt: number): void
  render(ctx: CanvasRenderingContext2D, width: number, height: number): void
  onPointerDown?(x: number, y: number, width: number, height: number, pointerId: number): void
  onPointerMove?(x: number, y: number, width: number, height: number, pointerId: number): void
  onPointerUp?(x: number, y: number, width: number, height: number, pointerId: number): void
}

export type SceneFactory = () => Scene

export class SceneManager {
  private current: Scene | null = null

  constructor(private readonly factories: Record<string, SceneFactory>) {}

  currentScene(): Scene | null {
    return this.current
  }

  switchTo(name: string): void {
    this.current?.exit()
    const factory = this.factories[name]
    if (!factory) throw new Error(`Unknown scene: ${name}`)
    this.current = factory()
    this.current.enter()
  }

  update(dt: number): void {
    this.current?.update(dt)
  }

  render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.current?.render(ctx, width, height)
  }
}
