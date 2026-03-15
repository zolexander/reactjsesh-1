import { Hieroglyph, type GroupOperator } from '../model/Hieroglyph'

export type GroupNode =
  | { kind: 'glyph'; glyph: Hieroglyph }
  | { kind: 'horizontal'; children: GroupNode[] }
  | { kind: 'vertical'; children: GroupNode[] }
  | { kind: 'overlay'; children: GroupNode[] }

class FlatGroupParser {
  private readonly items: readonly Hieroglyph[]
  private index = 0

  constructor(items: readonly Hieroglyph[]) {
    this.items = items
  }

  parse(): GroupNode | null {
    if (this.items.length === 0) {
      return null
    }

    return this.parseHorizontal()
  }

  private parseHorizontal(): GroupNode {
    let node = this.parseVertical()

    while (this.previousOperator() === '-') {
      node = {
        kind: 'horizontal',
        children: [node, this.parseVertical()],
      }
    }

    return node
  }

  private parseVertical(): GroupNode {
    let node = this.parseOverlay()

    while (this.previousOperator() === ':') {
      node = {
        kind: 'vertical',
        children: [node, this.parseOverlay()],
      }
    }

    return node
  }

  private parseOverlay(): GroupNode {
    let node = this.parseGlyph()

    while (this.previousOperator() === '*') {
      node = {
        kind: 'overlay',
        children: [node, this.parseGlyph()],
      }
    }

    return node
  }

  private parseGlyph(): GroupNode {
    const item = this.items[this.index]
    this.index += 1
    return { kind: 'glyph', glyph: item }
  }

  private previousOperator(): GroupOperator {
    if (this.index === 0) {
      return null
    }

    return this.items[this.index - 1]?.groupOp ?? null
  }
}

export function buildGroupTree(items: readonly Hieroglyph[]): GroupNode | null {
  return new FlatGroupParser(items).parse()
}