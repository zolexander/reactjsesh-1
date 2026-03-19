// src/jsesh/model/CartoucheGroup.ts
// Repräsentiert eine Kartusche: <content> in MdC.
// Der Inhalt sind normale Kadraten, der Renderer zeichnet das Oval drum herum.

import type { Cadrat } from './Cadrat'
import type { Hieroglyph } from './Hieroglyph'

export type CartoucheType =
  | 'cartouche'      // <  ...  >  normales Königsoval
  | 'serekh'         // keine MdC-Syntax, JSesh-intern
  | 'wormhole'       // <-  ...  -> horizontale Variante

export class CartoucheGroup {
  readonly kind = 'cartouche' as const
  readonly items: Cadrat[]
  readonly cartoucheType: CartoucheType

  constructor(items: Cadrat[] = [], cartoucheType: CartoucheType = 'cartouche') {
    this.items = items
    this.cartoucheType = cartoucheType
  }

  /** Compatibility surface: flatten all inner cadrat signs. */
  get signs(): Hieroglyph[] {
    return this.items.flatMap((cadrat) => cadrat.signs)
  }

  /** Compatibility helper used by existing app/test code. */
  flattenHieroglyphs(): Hieroglyph[] {
    return this.signs
  }
}