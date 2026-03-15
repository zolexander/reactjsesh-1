export class DrawingSpec {
  readonly glyphWidth: number
  readonly glyphHeight: number
  readonly horizontalGap: number
  readonly verticalGap: number
  readonly padding: number

  constructor(
    glyphWidth = 48,
    glyphHeight = 48,
    horizontalGap = 12,
    verticalGap = 12,
    padding = 8,
  ) {
    this.glyphWidth = glyphWidth
    this.glyphHeight = glyphHeight
    this.horizontalGap = horizontalGap
    this.verticalGap = verticalGap
    this.padding = padding
  }
}