import { App } from './core/app'
import { sfx } from './audio/synth'
import { requestAppFullscreen } from './core/fullscreen'
import { SceneManager } from './core/scene-manager'
import { loadBindings, saveBindings } from './input/actions'
import { InputManager } from './input/input-manager'
import { VirtualControls } from './input/virtual-controls'
import { createBindingsScene } from './scenes/bindings-scene'
import { createAvatarGameScene } from './scenes/avatar-game-scene'
import { createGameScene } from './scenes/game-scene'
import { createModesScene } from './scenes/modes-scene'
import { createMenuScene, createPauseScene } from './scenes/menu-scene'

function main() {
  let bindings = loadBindings()
  const input = new InputManager(bindings)
  const app = new App(input)
  new VirtualControls(input)

  let paused = false
  let pauseOverlay: ReturnType<typeof createPauseScene> | null = null

  const scenes = new SceneManager({
    menu: () => createMenuScene(app, (name) => scenes.switchTo(name)),
    modes: () => createModesScene(app, (name) => scenes.switchTo(name)),
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
      ),
    'avatar-game': () =>
      createAvatarGameScene(
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
      ),
  })

  app.scenes = scenes
  if (!localStorage.getItem('mira_bindings_v5')) {
    saveBindings(bindings)
  }
  requestAppFullscreen()
  const unlockAudio = () => sfx.unlock()
  window.addEventListener('pointerdown', unlockAudio, { once: true })
  window.addEventListener('keydown', unlockAudio, { once: true })
  app.start('menu')

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
