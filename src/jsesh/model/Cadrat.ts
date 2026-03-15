import { Hieroglyph, type GroupOperator } from './Hieroglyph'

export type CadratItem = Hieroglyph | Cadrat

export class Cadrat {
  readonly items: CadratItem[]

  constructor(items: CadratItem[] = []) {
    this.items = items
  }

  add(item: CadratItem): void {
    this.items.push(item)
  }

  setTrailingGroupOp(groupOp: GroupOperator): void {
    const lastItem = this.items.at(-1)
    if (!lastItem) {
      return
    }

    if (lastItem instanceof Hieroglyph) {
      lastItem.groupOp = groupOp
      return
    }

    lastItem.setTrailingGroupOp(groupOp)
  }

  flattenHieroglyphs(): Hieroglyph[] {
    return this.items.flatMap((item) =>
      item instanceof Hieroglyph ? [item] : item.flattenHieroglyphs(),
    )
  }
}