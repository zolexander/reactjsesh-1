import { Hieroglyph, type GroupOperator } from './Hieroglyph'

/**
 * Background shading for a cadrat cell.
 *
 * - `'full'`       — the whole cell is shaded (//)
 * - `'vertical'`   — vertical stripes (v/)
 * - `'horizontal'` — horizontal stripes (h/)
 * - `'quarter'`    — quarter / diagonal shading (/)
 */
export type ShadingType = 'full' | 'vertical' | 'horizontal' | 'quarter'

export class Cadrat {
  /**
   * Flat list of signs inside this cadrat.
   * The `groupOp` field on each sign encodes the operator that connects it
   * to its left neighbour (`-` horizontal, `:` vertical, `*` overlay).
   * The tree structure is reconstructed from these operators at layout time.
   */
  signs: Hieroglyph[]

  /**
   * True when the cadrat was created with the `**{…}` absolute-positioning
   * syntax, e.g.  `A1{{0,357,51}}**G5{{194,0,97}}`.
   */
  isAbsoluteGroup = false

  /**
   * Optional background shading applied to the whole cadrat cell.
   */
  shading?: ShadingType

  /**
   * @internal Set by the parser to propagate an incoming groupOp when a
   * parenthesised sub-cadrat is inlined into its parent.
   */
  _groupOp?: GroupOperator

  constructor(signs: Hieroglyph[] = []) {
    this.signs = [...signs]
  }

  /**
   * Append a glyph or inline a nested (parenthesised) cadrat.
   * Nested cadrats are immediately flattened: their signs are appended in
   * order and the incoming `_groupOp` is transferred to the first sign.
   */
  add(item: Hieroglyph | Cadrat): void {
    if (item instanceof Hieroglyph) {
      this.signs.push(item)
      return
    }

    // Inline nested group — transfer the groupOp to the first inlined sign
    if (item.signs.length > 0) {
      const first = item.signs[0]
      first.groupOp = first.groupOp ?? item._groupOp ?? null
      this.signs.push(...item.signs)
    }
  }

  /**
   * Set the `groupOp` on the *last* sign.
   * Called by the parser after consuming an operator token that follows the
   * last recorded sign.
   */
  setTrailingGroupOp(groupOp: GroupOperator): void {
    const last = this.signs.at(-1)
    if (last) {
      last.groupOp = groupOp
    }
  }

  /**
   * Returns the flat sign list.
   * Alias kept for compatibility with layout/renderer code.
   */
  flattenHieroglyphs(): Hieroglyph[] {
    return this.signs
  }
}