import { glyphRegistry } from '../glyphs/glyphsRegistry'
import { DrawingSpec } from './DrawingSpec'
import type { GroupNode } from './groupParser'

export interface LayoutResult {
  kind: GroupNode['type']
  x: number
  y: number
  width: number
  height: number
  label?: string
  children: LayoutResult[]
}

// Backward compatibility for renderer imports.
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

function layoutSign(node: Extract<GroupNode, { type: 'sign' }>, availW: number, availH: number, spec: DrawingSpec): LayoutResult {
  const glyph = node.glyph
  const metrics = glyphRegistry.getMetrics(glyph.code)

  const naturalW = Math.max(metrics.naturalWidth, 1)
  const naturalH = Math.max(metrics.naturalHeight, 1)
  const aspect = naturalW / naturalH

  let height = availH

  // Small signs are downscaled relative to the cadrat height baseline.
  if (naturalH < spec.cadratHeight * spec.smallSignThreshold) {
    height *= spec.smallSignScale
  }

  // Explicit relative size from {{x,y,s}} semantics.
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
    label: glyph.code,
    children: [],
  }
}

function layoutAbsoluteLigature(node: Extract<GroupNode, { type: 'ligature' }>, spec: DrawingSpec): LayoutResult {
  const pxPerUnit = spec.cadratHeight / 1000
  const children: LayoutResult[] = []

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const childNode of node.children) {
    if (childNode.type !== 'sign') {
      continue
    }

    const child = layoutSign(childNode, Number.MAX_SAFE_INTEGER, spec.cadratHeight, spec)
    const x = childNode.glyph.getX() * pxPerUnit
    const y = childNode.glyph.getY() * pxPerUnit
    const placed = moveBox(child, x, y)

    minX = Math.min(minX, placed.x)
    minY = Math.min(minY, placed.y)
    maxX = Math.max(maxX, placed.x + placed.width)
    maxY = Math.max(maxY, placed.y + placed.height)

    children.push(placed)
  }

  if (children.length === 0) {
    return { kind: 'ligature', x: 0, y: 0, width: 0, height: 0, children: [] }
  }

  const normalizedChildren = children.map((child) => moveBox(child, -minX, -minY))
  return {
    kind: 'ligature',
    x: 0,
    y: 0,
    width: maxX - minX,
    height: maxY - minY,
    children: normalizedChildren,
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
    const childW = resolvedAvailW / n

    let x = 0
    const children = node.children.map((child) => {
      const laid = layoutGroupNode(child, childW, resolvedAvailH, spec)
      const moved = moveBox(laid, x, 0)
      x += childW
      return moved
    })

    result = {
      kind: 'hgroup',
      x: 0,
      y: 0,
      width: resolvedAvailW,
      height: Math.max(...children.map((c) => c.height), 0),
      children,
    }
  } else if (node.type === 'vgroup') {
    const n = Math.max(node.children.length, 1)
    const childH = resolvedAvailH / n

    let y = 0
    const children = node.children.map((child) => {
      const laid = layoutGroupNode(child, resolvedAvailW, childH, spec)
      const moved = moveBox(laid, 0, y)
      y += childH
      return moved
    })

    result = {
      kind: 'vgroup',
      x: 0,
      y: 0,
      width: Math.max(...children.map((c) => c.width), 0),
      height: resolvedAvailH,
      children,
    }
  } else {
    const isAbsoluteGroup = node.children.some((child) => isAbsoluteSignNode(child))

    if (isAbsoluteGroup) {
      result = layoutAbsoluteLigature(node, spec)
    } else {
      const children = node.children.map((child) => layoutGroupNode(child, resolvedAvailW, resolvedAvailH, spec))
      result = {
        kind: 'ligature',
        x: 0,
        y: 0,
        width: Math.max(...children.map((child) => child.width), 0),
        height: Math.max(...children.map((child) => child.height), 0),
        // overlay: every child starts at origin
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