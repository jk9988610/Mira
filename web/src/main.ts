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
import { createLayoutEditorScene } from './scenes/layout-editor-scene'
import { createModesScene } from './scenes/modes-scene'
import { createMenuScene, createPauseScene } from './scenes/menu-scene'
import { createSettingsScene } from './scenes/settings-scene'

const GAME_SCENES = new Set(['game', 'avatar-game'])
const gamePause = { fn: null as (() => void) | null }

function main() {
  let bindings = loadBindings()
  const input = new InputManager(bindings)
  const app = new App(input)
  const virtualControls = new VirtualControls(input)

  let paused = false
  let pauseOverlay: ReturnType<typeof createPauseScene> | null = null

  const scenes = new SceneManager({
    menu: () => createMenuScene(app, (name) => scenes.switchTo(name)),
    modes: () => createModesScene(app, (name) => scenes.switchTo(name)),
    settings: () => createSettingsScene(app, (name) => scenes.switchTo(name)),
    'layout-editor': () => createLayoutEditorScene(app, (name) => scenes.switchTo(name), virtualControls),
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
        gamePause,
      ),
  })

  const originalSwitchTo = scenes.switchTo.bind(scenes)
  scenes.switchTo = (name: string) => {
    originalSwitchTo(name)
    virtualControls.setInGame(GAME_SCENES.has(name))
  }

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
