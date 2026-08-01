type WaveType = OscillatorType

class SynthAudio {
  private ctx: AudioContext | null = null

  unlock(): void {
    const Ctx = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    if (!this.ctx) this.ctx = new Ctx()
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  private playTone(
    frequency: number,
    duration: number,
    type: WaveType = 'sine',
    volume = 0.12,
    attack = 0.01,
  ): void {
    const ctx = this.ctx
    if (!ctx) return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(frequency, ctx.currentTime)
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + attack)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration + 0.02)
  }

  private playSweep(
    from: number,
    to: number,
    duration: number,
    type: WaveType = 'sine',
    volume = 0.1,
  ): void {
    const ctx = this.ctx
    if (!ctx) return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(from, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), ctx.currentTime + duration)
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration + 0.02)
  }

  /** 开局倒计时滴答 */
  countdownTick(secondsLeft: number): void {
    const freqs = [392, 494, 587, 784]
    const idx = Math.max(0, Math.min(3, secondsLeft))
    this.playTone(freqs[idx], 0.12, 'square', 0.08)
  }

  /** 对局开始 */
  matchStart(): void {
    this.playTone(523, 0.1, 'sine', 0.1)
    setTimeout(() => this.playTone(659, 0.1, 'sine', 0.1), 80)
    setTimeout(() => this.playTone(784, 0.18, 'sine', 0.12), 160)
  }

  /** 摄取颗粒 */
  absorbPellet(): void {
    this.playSweep(320, 720, 0.07, 'sine', 0.07)
  }

  /** 吞噬其他圆 */
  eatCircle(): void {
    this.playTone(110, 0.22, 'sawtooth', 0.09)
    this.playSweep(180, 90, 0.18, 'triangle', 0.06)
  }

  /** 被吞噬 */
  eaten(): void {
    this.playSweep(420, 120, 0.28, 'sawtooth', 0.08)
  }

  /** 复活 */
  respawn(): void {
    this.playSweep(200, 520, 0.2, 'sine', 0.09)
  }

  /** 对局结束 */
  matchEnd(): void {
    this.playTone(440, 0.15, 'sine', 0.1)
    setTimeout(() => this.playTone(349, 0.15, 'sine', 0.1), 120)
    setTimeout(() => this.playTone(262, 0.35, 'sine', 0.12), 240)
  }
}

export const sfx = new SynthAudio()
