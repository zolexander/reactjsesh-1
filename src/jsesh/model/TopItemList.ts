import { Cadrat } from './Cadrat'
import type { CartoucheGroup } from './CartoucheGroup'

export type TopItem = Cadrat | CartoucheGroup

export class TopItemList {
  readonly items: TopItem[]

  constructor(items: TopItem[] = []) {
    this.items = items
  }

  add(item: TopItem): void {
    this.items.push(item)
  }
}