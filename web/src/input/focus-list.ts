export class FocusList {
  private index = 0

  constructor(private readonly size: number) {}

  getIndex(): number {
    return this.index
  }

  setIndex(index: number): void {
    this.index = ((index % this.size) + this.size) % this.size
  }

  move(delta: number): void {
    this.setIndex(this.index + delta)
  }

  moveVertical(delta: number): void {
    this.move(delta)
  }
}
