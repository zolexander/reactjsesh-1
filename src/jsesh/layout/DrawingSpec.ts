export type DrawingDirection = 'ltr' | 'rtl' | 'top-down'

export class DrawingSpec {
  /** Pixel height of a single cadrat cell. */
  cadratHeight = 60

  /** Pixel spacing between cadrats (not inside a cadrat). */
  signSpacing = 4

  /** Extra pixels between lines. */
  lineSpacing = 4

  /** Signs below 50% of cadrat height are treated as "small". */
  smallSignThreshold = 0.5

  /** Relative scale applied to small signs. */
  smallSignScale = 0.75

  /** Max cadrat width as multiple of cadratHeight. */
  maxCadratWidth = 1.5

  leftMargin = 8
  topMargin = 8
  rightMargin = 8
  bottomMargin = 8

  direction: DrawingDirection = 'ltr'

  /** Backward compatibility for existing layout/metrics code. */
  get glyphWidth(): number {
    return this.cadratHeight
  }

  /** Backward compatibility for existing layout/metrics code. */
  get glyphHeight(): number {
    return this.cadratHeight
  }

  /** Backward compatibility for existing layout code. */
  get horizontalGap(): number {
    return this.signSpacing
  }

  /** Backward compatibility for existing layout code. */
  get verticalGap(): number {
    return this.signSpacing
  }

  /** Backward compatibility for old callers that used a single padding value. */
  get padding(): number {
    return this.leftMargin
  }
}