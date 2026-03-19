// src/jsesh/layout/lineLayout.ts
// FIX: y-Vorschub benutzt jetzt die tatsächliche max. Zeilenhöhe
// statt immer cadratHeight — sonst werden Kartuschen (höher als cadratHeight)
// bei mehrzeiligem Text von der nächsten Zeile überlappt.

import { DrawingSpec } from './DrawingSpec'
import type { LayoutResult } from './cadratLayout'

export type LineBreakToken = '!' | '/*'

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
  if (cadrats.length === 0) return []
  const lines: CadratLine[] = [[]]
  for (const cadrat of cadrats) {
    lines[lines.length - 1].push(cadrat)
    if (cadrat.breakAfter === '!' || cadrat.breakAfter === '/*') lines.push([])
  }
  return lines.filter((line) => line.length > 0)
}

function measureLineWidth(line: readonly LayoutedCadrat[], spec: DrawingSpec): number {
  if (line.length === 0) return 0
  return line.reduce((sum, item) => sum + item.layout.width, 0) + spec.signSpacing * (line.length - 1)
}

/** Maximale Höhe aller Elemente einer Zeile */
function measureLineHeight(line: readonly LayoutedCadrat[], spec: DrawingSpec): number {
  if (line.length === 0) return spec.cadratHeight
  return Math.max(...line.map((item) => item.layout.height), spec.cadratHeight)
}

export function moveLayout(layout: LayoutResult, offsetX: number, offsetY: number): LayoutResult {
  return {
    ...layout,
    x: layout.x + offsetX,
    y: layout.y + offsetY,
    children: layout.children.map((child) => moveLayout(child, offsetX, offsetY)),
  }
}

function placeLineLTR(line: readonly LayoutedCadrat[], startX: number, y: number, lineH: number, spec: DrawingSpec): PlacedCadrat[] {
  const placed: PlacedCadrat[] = []
  let x = startX
  for (const item of line) {
    // Vertikal am Boden der Zeile ausrichten (wie Hieroglyphen auf einer Grundlinie)
    const itemY = y + (lineH - item.layout.height)
    placed.push({
      x,
      y: itemY,
      width: item.layout.width,
      height: item.layout.height,
      layout: moveLayout(item.layout, x, itemY),
      breakAfter: item.breakAfter,
    })
    x += item.layout.width + spec.signSpacing
  }
  return placed
}

function placeLineRTL(line: readonly LayoutedCadrat[], lineRightEdgeX: number, y: number, lineH: number, spec: DrawingSpec): PlacedCadrat[] {
  const placed: PlacedCadrat[] = []
  let cursor = lineRightEdgeX
  for (const item of line) {
    cursor -= item.layout.width
    const x = cursor
    const itemY = y + (lineH - item.layout.height)
    placed.push({
      x,
      y: itemY,
      width: item.layout.width,
      height: item.layout.height,
      layout: moveLayout(item.layout, x, itemY),
      breakAfter: item.breakAfter,
    })
    cursor -= spec.signSpacing
  }
  return placed
}

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
      y += item.layout.height + spec.lineSpacing
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
    // FIX: Tatsächliche Zeilenhöhe berechnen (nicht immer cadratHeight)
    const lineH = measureLineHeight(line, spec)

    if (spec.direction === 'rtl') {
      items.push(...placeLineRTL(line, totalWidth - spec.rightMargin, y, lineH, spec))
    } else {
      items.push(...placeLineLTR(line, spec.leftMargin, y, lineH, spec))
    }

    y += lineH + spec.lineSpacing
  }

  const totalHeight = Math.max(spec.topMargin + spec.bottomMargin, y - spec.lineSpacing + spec.bottomMargin)
  return { items, totalWidth, totalHeight }
}