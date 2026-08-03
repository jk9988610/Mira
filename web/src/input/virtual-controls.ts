import { isTouchDevice } from './gamepad'
import type { InputManager } from './input-manager'
import { loadVirtualLayout } from '../settings/settings'
import type { VirtualControlId, VirtualControlsLayout } from './virtual-controls-layout'

const JOY_RADIUS = 58
const JOY_DEADZONE = 0.12

/** 虚拟手柄：布局可配置，仅在游戏中显示 */
export class VirtualControls {
  private readonly root: HTMLElement
  private readonly knob: HTMLElement
  private readonly parts = new Map<VirtualControlId, HTMLElement>()
  private activePointer: number | null = null
  private layout: VirtualControlsLayout
  private inGame = false
  private layoutEditMode = false
  private gamepadActive = false
  private dragPointer: number | null = null
  private dragPart: VirtualControlId | null = null

  constructor(private readonly input: InputManager) {
    this.layout = loadVirtualLayout()
    this.root = document.createElement('div')
    this.root.id = 'virtual-controls'
    this.root.className = 'virtual-controls virtual-controls--hidden'
    this.root.innerHTML = `
      <div class="vc-part vc-shoulder" data-part="btnLb" data-btn="4">LB</div>
      <div class="vc-part vc-shoulder" data-part="btnRb" data-btn="5">RB</div>
      <div class="vc-part vc-joystick" data-part="joystick" aria-label="移动摇杆">
        <div class="vc-joystick-base">
          <div class="vc-joystick-knob"></div>
        </div>
      </div>
      <button type="button" class="vc-part vc-btn vc-btn-y" data-part="btnY" data-btn="3">Y</button>
      <button type="button" class="vc-part vc-btn vc-btn-x" data-part="btnX" data-btn="2">X</button>
      <button type="button" class="vc-part vc-btn vc-btn-b" data-part="btnB" data-btn="1">B</button>
      <button type="button" class="vc-part vc-btn vc-btn-a" data-part="btnA" data-btn="0">A</button>
      <button type="button" class="vc-part vc-btn vc-btn-start" data-part="btnStart" data-btn="9">▣</button>
    `
    document.body.appendChild(this.root)
    this.knob = this.root.querySelector('.vc-joystick-knob')!

    this.root.querySelectorAll<HTMLElement>('[data-part]').forEach((el) => {
      const id = el.dataset.part as VirtualControlId
      this.parts.set(id, el)
    })

    if (!isTouchDevice()) return

    this.applyLayout(this.layout)
    this.bindJoystick()
    this.bindButtons()
    this.bindLayoutDrag()
    this.input.onStatusChange((status) => {
      this.gamepadActive = status.connected && status.activated
      this.syncVisibility()
    })
  }

  setInGame(active: boolean): void {
    this.inGame = active
    this.syncVisibility()
  }

  setLayoutEditMode(active: boolean): void {
    this.layoutEditMode = active
    this.root.classList.toggle('virtual-controls--edit', active)
    this.syncVisibility()
  }

  getLayout(): VirtualControlsLayout {
    return { ...this.layout }
  }

  applyLayout(layout: VirtualControlsLayout): void {
    this.layout = { ...layout }
    for (const [id, pos] of Object.entries(layout) as [VirtualControlId, { x: number; y: number }][]) {
      const el = this.parts.get(id)
      if (!el) continue
      el.style.left = `${pos.x * 100}%`
      el.style.top = `${pos.y * 100}%`
    }
  }

  getPartElement(id: VirtualControlId): HTMLElement | undefined {
    return this.parts.get(id)
  }

  destroy(): void {
    this.resetJoystick()
    this.root.remove()
  }

  private syncVisibility(): void {
    const show = isTouchDevice() && (this.inGame || this.layoutEditMode) && !this.gamepadActive
    this.root.classList.toggle('virtual-controls--hidden', !show)
  }

  private bindJoystick(): void {
    const zone = this.parts.get('joystick')!
    zone.addEventListener('pointerdown', (e) => {
      if (this.layoutEditMode) return
      if (this.activePointer !== null) return
      this.activePointer = e.pointerId
      zone.setPointerCapture(e.pointerId)
      this.updateJoystick(e, zone)
      e.preventDefault()
    })
    zone.addEventListener('pointermove', (e) => {
      if (this.layoutEditMode || e.pointerId !== this.activePointer) return
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
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const dx = e.clientX - centerX
    const dy = e.clientY - centerY
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
      const press = () => {
        if (this.layoutEditMode) return
        this.input.setVirtualButton(code, true)
        btn.classList.add('vc-btn--pressed')
      }
      const release = () => {
        if (this.layoutEditMode) return
        this.input.setVirtualButton(code, false)
        btn.classList.remove('vc-btn--pressed')
      }
      btn.addEventListener('pointerdown', (e) => {
        if (this.layoutEditMode) return
        btn.setPointerCapture(e.pointerId)
        press()
        e.preventDefault()
      })
      btn.addEventListener('pointerup', release)
      btn.addEventListener('pointercancel', release)
      btn.addEventListener('lostpointercapture', release)
    }
  }

  private bindLayoutDrag(): void {
    const clamp = (v: number) => Math.max(0.05, Math.min(0.95, v))
    for (const [id, el] of this.parts) {
      el.addEventListener('pointerdown', (e) => {
        if (!this.layoutEditMode) return
        this.dragPart = id
        this.dragPointer = e.pointerId
        el.setPointerCapture(e.pointerId)
        e.preventDefault()
      })
      el.addEventListener('pointermove', (e) => {
        if (!this.layoutEditMode || this.dragPart !== id || e.pointerId !== this.dragPointer) return
        this.layout[id] = {
          x: clamp(e.clientX / window.innerWidth),
          y: clamp(e.clientY / window.innerHeight),
        }
        this.applyLayout(this.layout)
      })
      const endDrag = (e: PointerEvent) => {
        if (e.pointerId !== this.dragPointer) return
        this.dragPart = null
        this.dragPointer = null
      }
      el.addEventListener('pointerup', endDrag)
      el.addEventListener('pointercancel', endDrag)
    }
  }
}
