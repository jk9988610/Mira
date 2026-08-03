import { isTouchDevice } from './gamepad'
import type { InputManager } from './input-manager'

const JOY_RADIUS = 58
const JOY_DEADZONE = 0.12

/** 默认虚拟手柄布局：左侧 360° 摇杆，右侧 Xbox 功能键 */
export class VirtualControls {
  private readonly root: HTMLElement
  private readonly knob: HTMLElement
  private activePointer: number | null = null
  private joyCenterX = 0
  private joyCenterY = 0

  constructor(private readonly input: InputManager) {
    this.root = document.createElement('div')
    this.root.id = 'virtual-controls'
    this.root.className = 'virtual-controls'
    this.root.innerHTML = `
      <div class="vc-shoulder vc-lb" data-btn="4" aria-label="LB">LB</div>
      <div class="vc-shoulder vc-rb" data-btn="5" aria-label="RB">RB</div>
      <div class="vc-joystick" aria-label="移动摇杆">
        <div class="vc-joystick-base">
          <div class="vc-joystick-knob"></div>
        </div>
      </div>
      <div class="vc-buttons" aria-label="功能键">
        <button type="button" class="vc-btn vc-btn-y" data-btn="3" aria-label="Y">Y</button>
        <button type="button" class="vc-btn vc-btn-x" data-btn="2" aria-label="X">X</button>
        <button type="button" class="vc-btn vc-btn-b" data-btn="1" aria-label="B">B</button>
        <button type="button" class="vc-btn vc-btn-a" data-btn="0" aria-label="A">A</button>
        <button type="button" class="vc-btn vc-btn-start" data-btn="9" aria-label="Start">▣</button>
      </div>
    `
    document.body.appendChild(this.root)
    this.knob = this.root.querySelector('.vc-joystick-knob')!

    if (!isTouchDevice()) {
      this.root.classList.add('virtual-controls--hidden')
      return
    }

    this.bindJoystick()
    this.bindButtons()
    this.input.onStatusChange((status) => {
      const hide = status.connected && status.activated
      this.root.classList.toggle('virtual-controls--hidden', hide)
    })
  }

  destroy(): void {
    this.resetJoystick()
    this.root.remove()
  }

  private bindJoystick(): void {
    const zone = this.root.querySelector('.vc-joystick') as HTMLElement

    zone.addEventListener('pointerdown', (e) => {
      if (this.activePointer !== null) return
      this.activePointer = e.pointerId
      zone.setPointerCapture(e.pointerId)
      this.updateJoystick(e, zone)
      e.preventDefault()
    })

    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.activePointer) return
      this.updateJoystick(e, zone)
    })

    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.activePointer) return
      this.activePointer = null
      this.resetJoystick()
    }
    zone.addEventListener('pointerup', end)
    zone.addEventListener('pointercancel', end)
  }

  private updateJoystick(e: PointerEvent, zone: HTMLElement): void {
    const rect = zone.getBoundingClientRect()
    this.joyCenterX = rect.left + rect.width / 2
    this.joyCenterY = rect.top + rect.height / 2
    const dx = e.clientX - this.joyCenterX
    const dy = e.clientY - this.joyCenterY
    const dist = Math.hypot(dx, dy)
    const clamped = Math.min(dist, JOY_RADIUS)
    const angle = Math.atan2(dy, dx)
    const knobX = dist > 0 ? Math.cos(angle) * clamped : 0
    const knobY = dist > 0 ? Math.sin(angle) * clamped : 0

    this.knob.style.transform = `translate(${knobX}px, ${knobY}px)`

    let nx = knobX / JOY_RADIUS
    let ny = knobY / JOY_RADIUS
    const mag = Math.hypot(nx, ny)
    if (mag < JOY_DEADZONE) {
      nx = 0
      ny = 0
    } else {
      const scaled = (mag - JOY_DEADZONE) / (1 - JOY_DEADZONE)
      nx = (nx / mag) * scaled
      ny = (ny / mag) * scaled
    }
    this.input.setVirtualStick(nx, ny)
  }

  private resetJoystick(): void {
    this.knob.style.transform = 'translate(0, 0)'
    this.input.setVirtualStick(0, 0)
  }

  private bindButtons(): void {
    const buttons = this.root.querySelectorAll<HTMLElement>('[data-btn]')
    for (const btn of buttons) {
      const code = btn.dataset.btn!
      const press = (e: PointerEvent) => {
        this.input.setVirtualButton(code, true)
        btn.classList.add('vc-btn--pressed')
        e.preventDefault()
      }
      const release = (e: PointerEvent) => {
        this.input.setVirtualButton(code, false)
        btn.classList.remove('vc-btn--pressed')
        e.preventDefault()
      }
      btn.addEventListener('pointerdown', (e) => {
        btn.setPointerCapture(e.pointerId)
        press(e)
      })
      btn.addEventListener('pointerup', release)
      btn.addEventListener('pointercancel', release)
      btn.addEventListener('pointerleave', (e) => {
        if (btn.hasPointerCapture(e.pointerId)) release(e)
      })
    }
  }
}
