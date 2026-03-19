// src/jsesh/layout/cadratLayout.ts — mit Farbunterstützung
// Änderung: LayoutResult hat ein optionales color-Feld.
// layoutSign() überträgt glyph.color in das LayoutResult.

import { glyphRegistry } from '../glyphs/glyphsRegistry'
import { resolveGardinerCode } from '../glyphs/mdcToGardiner'
import { DrawingSpec } from './DrawingSpec'
import type { GroupNode } from './groupParser'

export interface LayoutResult {
  kind: GroupNode['type'] | 'cartouche'
  x: number
  y: number
  width: number
  height: number
  label?: string
  /** Farbe des Zeichens — wird vom glyph.color-Feld übertragen */
  color?: string
  naturalWidth?: number
  naturalHeight?: number
  viewBoxW?: number
  viewBoxH?: number
  offsetX?: number
  offsetY?: number
  children: LayoutResult[]
  isCartouche?: boolean
}

export type LayoutBox = LayoutResult

function moveBox(box: LayoutResult, offsetX: number, offsetY: number): LayoutResult {
  return {
    ...box,
    x: box.x + offsetX,
    y: box.y + offsetY,
    children: box.children.map((child) => moveBox(child, offsetX, offsetY)),
  }
}

function scaleBox(box: LayoutResult, factor: number): LayoutResult {
  return {
    ...box,
    x: box.x * factor,
    y: box.y * factor,
    width: box.width * factor,
    height: box.height * factor,
    children: box.children.map((child) => scaleBox(child, factor)),
  }
}

function isAbsoluteSignNode(node: GroupNode): node is Extract<GroupNode, { type: 'sign' }> {
  return node.type === 'sign' && (node.glyph.getX() !== 0 || node.glyph.getY() !== 0)
}

function layoutSign(
  node: Extract<GroupNode, { type: 'sign' }>,
  availW: number,
  availH: number,
  spec: DrawingSpec,
): LayoutResult {
  const glyph = node.glyph
  const metrics = glyphRegistry.getMetrics(glyph.code)

  const naturalW = Math.max(metrics.naturalWidth, 1)
  const naturalH = Math.max(metrics.naturalHeight, 1)
  const aspect = naturalW / naturalH

  let height = availH

  const viewBoxH = Math.max(metrics.viewBoxH, 1)
  const normalizedH = naturalH / viewBoxH
  if (normalizedH < spec.smallSignThreshold) {
    height *= spec.smallSignScale
  }

  if (glyph.getRelativeSize() !== 100) {
    height *= glyph.getRelativeSize() / 100
  }

  let width = height * aspect
  if (width > availW && width > 0) {
    const f = availW / width
    width *= f
    height *= f
  }

  return {
    kind: 'sign',
    x: 0,
    y: 0,
    width,
    height,
    label: resolveGardinerCode(glyph.code),
    // NEU: Farbe aus Hieroglyph übertragen
    color: glyph.color,
    naturalWidth: naturalW,
    naturalHeight: naturalH,
    viewBoxW: metrics.viewBoxW,
    viewBoxH: metrics.viewBoxH,
    offsetX: metrics.offsetX,
    offsetY: metrics.offsetY,
    children: [],
  }
}

function layoutAbsoluteLigature(
  node: Extract<GroupNode, { type: 'ligature' }>,
  spec: DrawingSpec,
): LayoutResult {
  const pxPerUnit = spec.cadratHeight / 1000
  const children: LayoutResult[] = []
  let minX = Number.POSITIVE_INFINITY, minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY, maxY = Number.NEGATIVE_INFINITY

  for (const childNode of node.children) {
    if (childNode.type !== 'sign') continue
    const child = layoutSign(childNode, Number.MAX_SAFE_INTEGER, spec.cadratHeight, spec)
    const x = childNode.glyph.getX() * pxPerUnit
    const y = childNode.glyph.getY() * pxPerUnit
    const placed = moveBox(child, x, y)
    minX = Math.min(minX, placed.x); minY = Math.min(minY, placed.y)
    maxX = Math.max(maxX, placed.x + placed.width); maxY = Math.max(maxY, placed.y + placed.height)
    children.push(placed)
  }

  if (children.length === 0) return { kind: 'ligature', x: 0, y: 0, width: 0, height: 0, children: [] }

  return {
    kind: 'ligature', x: 0, y: 0,
    width: maxX - minX, height: maxY - minY,
    children: children.map((c) => moveBox(c, -minX, -minY)),
  }
}

export function layoutGroupNode(
  node: GroupNode,
  availW?: number,
  availH?: number,
  spec: DrawingSpec = new DrawingSpec(),
): LayoutResult {
  const resolvedAvailW = availW ?? spec.cadratHeight
  const resolvedAvailH = availH ?? spec.cadratHeight
  let result: LayoutResult

  if (node.type === 'sign') {
    result = layoutSign(node, resolvedAvailW, resolvedAvailH, spec)

  } else if (node.type === 'hgroup') {
    const n = Math.max(node.children.length, 1)
    const childSlotW = resolvedAvailW / n
    const laid = node.children.map((child) => layoutGroupNode(child, childSlotW, resolvedAvailH, spec))
    const baseline = Math.max(...laid.map((c) => c.height), 0)
    let x = 0
    const children = laid.map((child) => {
      const moved = moveBox(child, x, baseline - child.height)
      x += child.width
      return moved
    })
    result = { kind: 'hgroup', x: 0, y: 0, width: x, height: baseline, children }

  } else if (node.type === 'vgroup') {
    const n = Math.max(node.children.length, 1)
    const childSlotH = resolvedAvailH / n
    const preCalc = node.children.map((child) => layoutGroupNode(child, resolvedAvailW, childSlotH, spec))
    const cadratWidth = Math.max(...preCalc.map((c) => c.width), 0)
    let slotTop = 0
    const children = preCalc.map((child) => {
      const moved = moveBox(child, (cadratWidth - child.width) / 2, slotTop + (childSlotH - child.height))
      slotTop += childSlotH
      return moved
    })
    result = { kind: 'vgroup', x: 0, y: 0, width: cadratWidth, height: resolvedAvailH, children }

  } else {
    const isAbsoluteGroup = node.children.some((child) => isAbsoluteSignNode(child))
    if (isAbsoluteGroup) {
      result = layoutAbsoluteLigature(node, spec)
    } else {
      const children = node.children.map((child) =>
        layoutGroupNode(child, resolvedAvailW, resolvedAvailH, spec),
      )
      result = {
        kind: 'ligature', x: 0, y: 0,
        width: Math.max(...children.map((c) => c.width), 0),
        height: Math.max(...children.map((c) => c.height), 0),
        children: children.map((child) => moveBox(child, -child.x, -child.y)),
      }
    }
  }

  const maxWidthPx = spec.maxCadratWidth * spec.cadratHeight
  if (result.width > maxWidthPx && result.width > 0) {
    return scaleBox(result, maxWidthPx / result.width)
  }
  return result
}
