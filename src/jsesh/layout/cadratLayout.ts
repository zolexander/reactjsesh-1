import type { GlyphMetricMap } from '../glyphs/glyphMetrics'
import { getGlyphMetric } from '../glyphs/glyphMetrics'
import { DrawingSpec } from './DrawingSpec'
import type { GroupNode } from './groupParser'

export interface LayoutBox {
  kind: GroupNode['kind']
  x: number
  y: number
  width: number
  height: number
  label?: string
  children: LayoutBox[]
}

function moveBox(box: LayoutBox, offsetX: number, offsetY: number): LayoutBox {
  return {
    ...box,
    x: box.x + offsetX,
    y: box.y + offsetY,
    children: box.children.map((child) => moveBox(child, offsetX, offsetY)),
  }
}

export function layoutGroupNode(
  node: GroupNode,
  spec: DrawingSpec = new DrawingSpec(),
  metrics: GlyphMetricMap = new Map(),
): LayoutBox {
  if (node.kind === 'glyph') {
    const metric = getGlyphMetric(node.glyph.code, metrics, spec)
    return {
      kind: 'glyph',
      x: 0,
      y: 0,
      width: metric.width,
      height: metric.height,
      label: node.glyph.code,
      children: [],
    }
  }

  const childBoxes = node.children.map((child) => layoutGroupNode(child, spec, metrics))

  if (node.kind === 'overlay') {
    const width = Math.max(...childBoxes.map((child) => child.width))
    const height = Math.max(...childBoxes.map((child) => child.height))

    return {
      kind: 'overlay',
      x: 0,
      y: 0,
      width,
      height,
      children: childBoxes.map((child) =>
        moveBox(child, (width - child.width) / 2, (height - child.height) / 2),
      ),
    }
  }

  if (node.kind === 'vertical') {
    let y = 0
    const width = Math.max(...childBoxes.map((child) => child.width))
    const children = childBoxes.map((child, index) => {
      const moved = moveBox(child, (width - child.width) / 2, y)
      y += child.height
      if (index < childBoxes.length - 1) {
        y += spec.verticalGap
      }
      return moved
    })

    return {
      kind: 'vertical',
      x: 0,
      y: 0,
      width,
      height: y,
      children,
    }
  }

  let x = 0
  const height = Math.max(...childBoxes.map((child) => child.height))
  const children = childBoxes.map((child, index) => {
    const moved = moveBox(child, x, (height - child.height) / 2)
    x += child.width
    if (index < childBoxes.length - 1) {
      x += spec.horizontalGap
    }
    return moved
  })

  return {
    kind: 'horizontal',
    x: 0,
    y: 0,
    width: x,
    height,
    children,
  }
}