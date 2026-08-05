import type { InputManager } from '../input/input-manager'
import type { SceneManager } from './scene-manager'

export class App {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private lastTime = 0
  private running = false
  scenes!: SceneManager

  constructor(readonly input: InputManager) {
    const canvas = document.getElementById('game')
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error('Canvas #game not found')
    }
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D context unavailable')
    this.ctx = ctx
    this.resize()
    window.addEventListener('resize', () => this.resize())
    this.bindPointers()
  }

  private bindPointers(): void {
    const sceneSize = () => ({
      width: this.canvas.clientWidth,
      height: this.canvas.clientHeight,
    })

    const toLocal = (clientX: number, clientY: number) => {
      const rect = this.canvas.getBoundingClientRect()
      return { x: clientX - rect.left, y: clientY - rect.top }
    }

    this.canvas.addEventListener(
      'pointerdown',
      (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return
        const scene = this.scenes.currentScene()
        const { x, y } = toLocal(e.clientX, e.clientY)
        const { width, height } = sceneSize()
        scene?.onPointerDown?.(x, y, width, height, e.pointerId)
        if (scene?.onPointerMove) {
          try {
            this.canvas.setPointerCapture(e.pointerId)
          } catch {
            /* ignore */
          }
        }
      },
      { passive: true },
    )

    this.canvas.addEventListener(
      'pointermove',
      (e) => {
        const scene = this.scenes.currentScene()
        if (!scene?.onPointerMove) return
        const { x, y } = toLocal(e.clientX, e.clientY)
        const { width, height } = sceneSize()
        scene.onPointerMove(x, y, width, height, e.pointerId)
      },
      { passive: true },
    )

    const endPointer = (e: PointerEvent) => {
      const scene = this.scenes.currentScene()
      const { x, y } = toLocal(e.clientX, e.clientY)
      const { width, height } = sceneSize()
      scene?.onPointerUp?.(x, y, width, height, e.pointerId)
      if (this.canvas.hasPointerCapture(e.pointerId)) {
        try {
          this.canvas.releasePointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
      }
    }

    this.canvas.addEventListener('pointerup', endPointer, { passive: true })
    this.canvas.addEventListener('pointercancel', endPointer, { passive: true })
  }

  start(initialScene: string): void {
    this.scenes.switchTo(initialScene)
    this.running = true
    this.lastTime = performance.now()
    requestAnimationFrame((t) => this.loop(t))
  }

  private resize(): void {
    const dpr = window.devicePixelRatio || 1
    const w = window.innerWidth
    const h = window.innerHeight
    this.canvas.width = Math.floor(w * dpr)
    this.canvas.height = Math.floor(h * dpr)
    this.canvas.style.width = `${w}px`
    this.canvas.style.height = `${h}px`
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  private loop(now: number): void {
    if (!this.running) return
    const dt = Math.min((now - this.lastTime) / 1000, 0.05)
    this.lastTime = now
    this.input.beginFrame()
    this.scenes.update(dt)
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    this.scenes.render(this.ctx, w, h)
    this.input.endFrame()
    requestAnimationFrame((t) => this.loop(t))
  }
}
