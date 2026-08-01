import { App } from './core/app'
import { SceneManager } from './core/scene-manager'
import { loadBindings, saveBindings } from './input/actions'
import { InputManager } from './input/input-manager'
import { createBindingsScene } from './scenes/bindings-scene'
import { createGameScene } from './scenes/game-scene'
import { createMenuScene, createPauseScene } from './scenes/menu-scene'

function main() {
  let bindings = loadBindings()
  const input = new InputManager(bindings)
  const app = new App(input)

  let paused = false
  let pauseOverlay: ReturnType<typeof createPauseScene> | null = null

  const scenes = new SceneManager({
    menu: () => createMenuScene(app, (name) => scenes.switchTo(name)),
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
  if (!localStorage.getItem('mira_bindings_v2')) {
    saveBindings(bindings)
  }
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
