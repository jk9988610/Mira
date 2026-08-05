import { App } from './core/app'
import { sfx } from './audio/synth'
import { requestAppFullscreen } from './core/fullscreen'
import { SceneManager } from './core/scene-manager'
import { loadBindings, saveBindings } from './input/actions'
import { InputManager } from './input/input-manager'
import { createBindingsScene } from './scenes/bindings-scene'
import { createGameScene } from './scenes/game-scene'
import { createMenuScene, createPauseScene } from './scenes/menu-scene'
import { createSettingsScene } from './scenes/settings-scene'

const gamePause = { fn: null as (() => void) | null }

function main() {
  let bindings = loadBindings()
  const input = new InputManager(bindings)
  const app = new App(input)

  let paused = false
  let pauseOverlay: ReturnType<typeof createPauseScene> | null = null

  const scenes = new SceneManager({
    menu: () => createMenuScene(app, (name) => scenes.switchTo(name)),
    settings: () => createSettingsScene(app, (name) => scenes.switchTo(name)),
    bindings: () =>
      createBindingsScene(
        app,
        (name) => scenes.switchTo(name),
        () => bindings,
        (next) => {
          bindings = next
          input.setBindings(next)
        },
      ),
    game: () =>
      createGameScene(
        app,
        (name) => scenes.switchTo(name),
        (visible) => {
          paused = visible
          if (visible) {
            pauseOverlay = createPauseScene(app, (name) => scenes.switchTo(name), () => {
              paused = false
              pauseOverlay = null
            })
            pauseOverlay.enter()
          } else {
            pauseOverlay?.exit()
            pauseOverlay = null
          }
        },
        () => paused,
        gamePause,
      ),
  })

  app.scenes = scenes
  if (!localStorage.getItem('mira_bindings_v10')) {
    saveBindings(bindings)
  }
  requestAppFullscreen()
  const unlockAudio = () => sfx.unlock()
  window.addEventListener('pointerdown', unlockAudio, { once: true })
  window.addEventListener('keydown', unlockAudio, { once: true })
  app.start('menu')

  const canvas = document.getElementById('game')
  const toLocal = (clientX: number, clientY: number) => {
    if (!(canvas instanceof HTMLCanvasElement)) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const forwardPausePointer = (
    type: 'down' | 'up',
    e: PointerEvent,
  ) => {
    if (!paused || !pauseOverlay) return
    const { x, y } = toLocal(e.clientX, e.clientY)
    const w = canvas instanceof HTMLCanvasElement ? canvas.clientWidth : 800
    const h = canvas instanceof HTMLCanvasElement ? canvas.clientHeight : 600
    if (type === 'down') pauseOverlay.onPointerDown?.(x, y, w, h, e.pointerId)
    else pauseOverlay.onPointerUp?.(x, y, w, h, e.pointerId)
  }

  canvas?.addEventListener('pointerdown', (e) => forwardPausePointer('down', e), { passive: true })
  canvas?.addEventListener('pointerup', (e) => forwardPausePointer('up', e), { passive: true })
  canvas?.addEventListener('pointercancel', (e) => forwardPausePointer('up', e), { passive: true })

  const originalUpdate = scenes.update.bind(scenes)
  scenes.update = (dt: number) => {
    originalUpdate(dt)
    if (paused && pauseOverlay) pauseOverlay.update(dt)
  }

  const originalRender = scenes.render.bind(scenes)
  scenes.render = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    originalRender(ctx, width, height)
    if (paused && pauseOverlay) pauseOverlay.render(ctx, width, height)
  }
}

main()
