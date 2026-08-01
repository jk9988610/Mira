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
    this.bindTouch()
  }

  private bindTouch(): void {
    const handle = (clientX: number, clientY: number) => {
      const rect = this.canvas.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      const scene = this.scenes.currentScene()
      scene?.onTap?.(x, y, this.canvas.clientWidth, this.canvas.clientHeight)
    }
    this.canvas.addEventListener(
      'pointerdown',
      (e) => {
        if (e.pointerType === 'touch' || e.pointerType === 'pen') {
          handle(e.clientX, e.clientY)
        }
      },
      { passive: true },
    )
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
    requestAnimationFrame((t) => this.loop(t))
  }
}
