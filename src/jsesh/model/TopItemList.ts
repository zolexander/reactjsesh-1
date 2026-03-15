import { Cadrat } from './Cadrat'

export class TopItemList {
  readonly items: Cadrat[]

  constructor(items: Cadrat[] = []) {
    this.items = items
  }

  add(cadrat: Cadrat): void {
    this.items.push(cadrat)
  }
}