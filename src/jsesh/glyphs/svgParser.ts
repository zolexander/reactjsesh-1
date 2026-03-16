import { DOMParser as XmldomParser } from '@xmldom/xmldom'
import { SVGPathData } from 'svg-pathdata'

type RectZone = { x: number; y: number; w: number; h: number }

export interface ParsedGlyphSvgMetrics {
  /** Natuerliche Breite in SVG-Einheiten (aus schwarzer Path-BBox). */
  naturalWidth: number
  /** Natuerliche Hoehe in SVG-Einheiten (aus schwarzer Path-BBox). */
  naturalHeight: number
  /** Linker Offset der schwarzen Path-BBox. */
  offsetX: number
  /** Oberer Offset der schwarzen Path-BBox. */
  offsetY: number
  /** viewBox-Breite des SVG root. */
  viewBoxW: number
  /** viewBox-Hoehe des SVG root. */
  viewBoxH: number
  /** optionale Zone-Definition aus <rect id="zone1" .../> */
  zone1?: RectZone
  /** optionale Zone-Definition aus <rect id="zone2" .../> */
  zone2?: RectZone
}

type Bounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
  hasPoints: boolean
}

function createEmptyBounds(): Bounds {
  return {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
    hasPoints: false,
  }
}

function expandBounds(bounds: Bounds, x: number, y: number): void {
  bounds.minX = Math.min(bounds.minX, x)
  bounds.minY = Math.min(bounds.minY, y)
  bounds.maxX = Math.max(bounds.maxX, x)
  bounds.maxY = Math.max(bounds.maxY, y)
  bounds.hasPoints = true
}

function parseStyleFill(styleAttr: string | null): string | null {
  if (!styleAttr) {
    return null
  }

  const fillPart = styleAttr
    .split(';')
    .map((p) => p.trim())
    .find((p) => p.toLowerCase().startsWith('fill:'))

  if (!fillPart) {
    return null
  }

  return fillPart.slice(fillPart.indexOf(':') + 1).trim()
}

function normalizeFill(fill: string | null): string | null {
  if (!fill) {
    return null
  }

  return fill.trim().toLowerCase()
}

function isBlackPath(path: Element): boolean {
  const directFill = normalizeFill(path.getAttribute('fill'))
  const styleFill = normalizeFill(parseStyleFill(path.getAttribute('style')))

  // Explicit fill has precedence over style fill.
  const fill = directFill ?? styleFill

  // Missing fill attribute defaults to black in SVG rendering.
  if (fill === null) {
    return true
  }

  if (fill === 'none') {
    return false
  }

  return fill === 'black' || fill === '#000' || fill === '#000000' || fill === 'rgb(0,0,0)'
}

function parseRectZone(rect: Element | undefined): RectZone | undefined {
  if (!rect) {
    return undefined
  }

  return {
    x: Number(rect.getAttribute('x') ?? '0'),
    y: Number(rect.getAttribute('y') ?? '0'),
    w: Number(rect.getAttribute('width') ?? '0'),
    h: Number(rect.getAttribute('height') ?? '0'),
  }
}

function parseViewBox(svg: Element): { minX: number; minY: number; width: number; height: number } {
  const raw = svg.getAttribute('viewBox')
  if (!raw) {
    return { minX: 0, minY: 0, width: 0, height: 0 }
  }

  const parts = raw
    .trim()
    .split(/\s+/)
    .map((n) => Number(n))

  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    return { minX: 0, minY: 0, width: 0, height: 0 }
  }

  return { minX: parts[0], minY: parts[1], width: parts[2], height: parts[3] }
}

function getPathBounds(d: string): Bounds {
  const bounds = createEmptyBounds()
  const commands = new SVGPathData(d).toAbs().commands

  let currentX = 0
  let currentY = 0
  let subPathStartX = 0
  let subPathStartY = 0

  for (const command of commands) {
    // MOVE_TO / LINE_TO / QUAD_TO / CURVE_TO / ARC / ...
    if ('x1' in command && typeof command.x1 === 'number' && 'y1' in command && typeof command.y1 === 'number') {
      expandBounds(bounds, command.x1, command.y1)
    }

    if ('x2' in command && typeof command.x2 === 'number' && 'y2' in command && typeof command.y2 === 'number') {
      expandBounds(bounds, command.x2, command.y2)
    }

    if ('x' in command && typeof command.x === 'number' && 'y' in command && typeof command.y === 'number') {
      currentX = command.x
      currentY = command.y
      expandBounds(bounds, currentX, currentY)

      if (command.type === SVGPathData.MOVE_TO) {
        subPathStartX = currentX
        subPathStartY = currentY
      }

      continue
    }

    if ('x' in command && typeof command.x === 'number') {
      currentX = command.x
      expandBounds(bounds, currentX, currentY)
      continue
    }

    if ('y' in command && typeof command.y === 'number') {
      currentY = command.y
      expandBounds(bounds, currentX, currentY)
      continue
    }

    if (command.type === SVGPathData.ARC) {
      if ('cX' in command && typeof command.cX === 'number' && 'cY' in command && typeof command.cY === 'number') {
        expandBounds(bounds, command.cX, command.cY)
      }

      continue
    }

    if (command.type === SVGPathData.CLOSE_PATH) {
      currentX = subPathStartX
      currentY = subPathStartY
      expandBounds(bounds, currentX, currentY)
    }
  }

  return bounds
}

function getDomParserCtor(): { new (): DOMParser } {
  if (typeof globalThis.DOMParser !== 'undefined') {
    return globalThis.DOMParser
  }

  // Node fallback
  return XmldomParser as unknown as { new (): DOMParser }
}

/**
 * Parse glyph metrics from one SVG string.
 *
 * Data source for dimensions is strictly the bounding box of black paths
 * (fill="black" or missing fill attribute).
 */
export function parseGlyphSvg(svgContent: string): ParsedGlyphSvgMetrics {
  const DomParserCtor = getDomParserCtor()
  const doc = new DomParserCtor().parseFromString(svgContent, 'image/svg+xml')
  const svg = doc.documentElement

  if (!svg || svg.tagName.toLowerCase() !== 'svg') {
    throw new Error('Invalid SVG input: missing <svg> root element.')
  }

  const viewBox = parseViewBox(svg)

  const paths = Array.from(doc.getElementsByTagName('path'))
  const blackPaths = paths.filter((path) => isBlackPath(path))

  const globalBounds = createEmptyBounds()
  for (const path of blackPaths) {
    const d = path.getAttribute('d')
    if (!d) {
      continue
    }

    const pathBounds = getPathBounds(d)
    if (!pathBounds.hasPoints) {
      continue
    }

    expandBounds(globalBounds, pathBounds.minX, pathBounds.minY)
    expandBounds(globalBounds, pathBounds.maxX, pathBounds.maxY)
  }

  const rects = Array.from(doc.getElementsByTagName('rect'))
  const zone1 = parseRectZone(rects.find((r) => r.getAttribute('id') === 'zone1'))
  const zone2 = parseRectZone(rects.find((r) => r.getAttribute('id') === 'zone2'))

  if (!globalBounds.hasPoints) {
    return {
      naturalWidth: 0,
      naturalHeight: 0,
      offsetX: 0,
      offsetY: 0,
      viewBoxW: viewBox.width,
      viewBoxH: viewBox.height,
      zone1,
      zone2,
    }
  }

  return {
    naturalWidth: globalBounds.maxX - globalBounds.minX,
    naturalHeight: globalBounds.maxY - globalBounds.minY,
    offsetX: globalBounds.minX,
    offsetY: globalBounds.minY,
    viewBoxW: viewBox.width,
    viewBoxH: viewBox.height,
    zone1,
    zone2,
  }
}
