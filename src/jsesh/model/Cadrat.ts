// src/jsesh/model/Cadrat.ts
// FIX: breakAfter-Feld hinzugefügt für Zeilenumbrüche aus .gly-Dateien

import { Hieroglyph, type GroupOperator } from './Hieroglyph'

export type ShadingType = 'full' | 'vertical' | 'horizontal' | 'quarter'

export class Cadrat {
  signs: Hieroglyph[]
  isAbsoluteGroup = false
  shading?: ShadingType
  _groupOp?: GroupOperator

  /**
   * Wenn true: nach diesem Kadrat folgt ein Zeilenumbruch.
   * Wird vom glyParser gesetzt wenn ein <br/> Element folgt.
   * lineLayout liest dieses Feld und bricht die Zeile dort ab.
   */
  breakAfter?: '!'

  constructor(signs: Hieroglyph[] = []) {
    this.signs = [...signs]
  }

  add(item: Hieroglyph | Cadrat): void {
    if (item instanceof Hieroglyph) {
      this.signs.push(item)
      return
    }
    if (item.signs.length > 0) {
      const first = item.signs[0]
      first.groupOp = first.groupOp ?? item._groupOp ?? null
      this.signs.push(...item.signs)
    }
  }

  setTrailingGroupOp(groupOp: GroupOperator): void {
    const last = this.signs.at(-1)
    if (last) last.groupOp = groupOp
  }

  flattenHieroglyphs(): Hieroglyph[] {
    return this.signs
  }
}