import { DrawingSpec } from './DrawingSpec'
import type { LayoutResult } from './cadratLayout'

export type LineBreakToken = '!' | '/*'

/**
 * One cadrat that has already been layouted by `layoutGroupNode`.
 * `breakAfter` marks an explicit line break trigger from MdC tokens.
 */
export interface LayoutedCadrat {
  layout: LayoutResult
  breakAfter?: LineBreakToken
}

export interface PlacedCadrat {
  x: number
  y: number
  width: number
  height: number
  layout: LayoutResult
  breakAfter?: LineBreakToken
}

export interface LineLayoutResult {
  items: PlacedCadrat[]
  totalWidth: number
  totalHeight: number
}

type CadratLine = LayoutedCadrat[]

function splitIntoLines(cadrats: readonly LayoutedCadrat[]): CadratLine[] {
  if (cadrats.length === 0) {
    return []
  }

  const lines: CadratLine[] = [[]]

  for (const cadrat of cadrats) {
    const current = lines[lines.length - 1]
    current.push(cadrat)

    if (cadrat.breakAfter === '!' || cadrat.breakAfter === '/*') {
      lines.push([])
    }
  }

  return lines.filter((line) => line.length > 0)
}

function measureLineWidth(line: readonly LayoutedCadrat[], spec: DrawingSpec): number {
  if (line.length === 0) {
    return 0
  }

  const widths = line.reduce((sum, item) => sum + item.layout.width, 0)
  return widths + spec.signSpacing * (line.length - 1)
}

function moveLayout(layout: LayoutResult, offsetX: number, offsetY: number): LayoutResult {
  return {
    ...layout,
    x: layout.x + offsetX,
    y: layout.y + offsetY,
    children: layout.children.map((child) => moveLayout(child, offsetX, offsetY)),
  }
}

function placeLineLTR(line: readonly LayoutedCadrat[], startX: number, y: number, spec: DrawingSpec): PlacedCadrat[] {
  const placed: PlacedCadrat[] = []
  let x = startX

  for (const item of line) {
    placed.push({
      x,
      y,
      width: item.layout.width,
      height: item.layout.height,
      layout: moveLayout(item.layout, x, y),
      breakAfter: item.breakAfter,
    })

    x += item.layout.width + spec.signSpacing
  }

  return placed
}

function placeLineRTL(
  line: readonly LayoutedCadrat[],
  lineRightEdgeX: number,
  y: number,
  spec: DrawingSpec,
): PlacedCadrat[] {
  const placed: PlacedCadrat[] = []
  let cursor = lineRightEdgeX

  for (const item of line) {
    cursor -= item.layout.width
    const x = cursor

    placed.push({
      x,
      y,
      width: item.layout.width,
      height: item.layout.height,
      layout: moveLayout(item.layout, x, y),
      breakAfter: item.breakAfter,
    })

    cursor -= spec.signSpacing
  }

  return placed
}

/**
 * Places already-layouted cadrats into text lines.
 *
 * - Applies `signSpacing` only here.
 * - Wraps lines only on explicit break tokens (`!`, `/*`).
 * - Supports LTR and RTL placement.
 * - Returns placed cadrats and total text extent.
 */
export function layoutCadratLines(
  cadrats: readonly LayoutedCadrat[],
  spec: DrawingSpec = new DrawingSpec(),
): LineLayoutResult {
  if (cadrats.length === 0) {
    return {
      items: [],
      totalWidth: spec.leftMargin + spec.rightMargin,
      totalHeight: spec.topMargin + spec.bottomMargin,
    }
  }

  if (spec.direction === 'top-down') {
    const items: PlacedCadrat[] = []
    let y = spec.topMargin
    let maxWidth = 0

    for (const item of cadrats) {
      items.push({
        x: spec.leftMargin,
        y,
        width: item.layout.width,
        height: item.layout.height,
        layout: moveLayout(item.layout, spec.leftMargin, y),
        breakAfter: item.breakAfter,
      })
      y += spec.cadratHeight + spec.lineSpacing
      maxWidth = Math.max(maxWidth, item.layout.width)
    }

    return {
      items,
      totalWidth: spec.leftMargin + maxWidth + spec.rightMargin,
      totalHeight: Math.max(spec.topMargin + spec.bottomMargin, y - spec.lineSpacing + spec.bottomMargin),
    }
  }

  const lines = splitIntoLines(cadrats)
  const lineWidths = lines.map((line) => measureLineWidth(line, spec))
  const contentWidth = Math.max(...lineWidths, 0)
  const totalWidth = spec.leftMargin + contentWidth + spec.rightMargin

  const items: PlacedCadrat[] = []
  let y = spec.topMargin

  for (const line of lines) {
    if (spec.direction === 'rtl') {
      const lineRightEdgeX = totalWidth - spec.rightMargin
      items.push(...placeLineRTL(line, lineRightEdgeX, y, spec))
    } else {
      items.push(...placeLineLTR(line, spec.leftMargin, y, spec))
    }

    y += spec.cadratHeight + spec.lineSpacing
  }

  const totalHeight = Math.max(spec.topMargin + spec.bottomMargin, y - spec.lineSpacing + spec.bottomMargin)

  return {
    items,
    totalWidth,
    totalHeight,
  }
}
