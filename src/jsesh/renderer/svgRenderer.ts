import { DOMParser as XmldomParser } from '@xmldom/xmldom'
import type { PlacedCadrat, LineLayoutResult } from '../layout/lineLayout'
import { DrawingSpec } from '../layout/DrawingSpec'
import type { LayoutResult } from '../layout/cadratLayout'

interface GlyphTemplate {
  minX: number
  minY: number
  viewBoxW: number
  viewBoxH: number
  pathsMarkup: string
}

interface SignInstance {
  code: string
  x: number
  y: number
  width: number
  height: number
}

export interface SvgRenderSize {
  totalWidth: number
  totalHeight: number
}

export interface SvgRenderResult {
  svg: string
  totalWidth: number
  totalHeight: number
}

const XML_NS = 'http://www.w3.org/2000/svg'
const glyphTemplateCache = new Map<string, GlyphTemplate | null>()

function getDomParserCtor(): { new (): DOMParser } {
  if (typeof globalThis.DOMParser !== 'undefined') {
    return globalThis.DOMParser
  }

  return XmldomParser as unknown as { new (): DOMParser }
}

function parseViewBox(element: Element): { minX: number; minY: number; width: number; height: number } {
  const raw = element.getAttribute('viewBox')
  if (!raw) {
    const widthAttr = Number.parseFloat((element.getAttribute('width') ?? '').replace(/px$/i, ''))
    const heightAttr = Number.parseFloat((element.getAttribute('height') ?? '').replace(/px$/i, ''))

    return {
      minX: 0,
      minY: 0,
      width: Number.isFinite(widthAttr) && widthAttr > 0 ? widthAttr : 1000,
      height: Number.isFinite(heightAttr) && heightAttr > 0 ? heightAttr : 1000,
    }
  }

  const numbers = raw.trim().split(/\s+/).map(Number)
  if (numbers.length !== 4 || numbers.some((n) => Number.isNaN(n))) {
    const widthAttr = Number.parseFloat((element.getAttribute('width') ?? '').replace(/px$/i, ''))
    const heightAttr = Number.parseFloat((element.getAttribute('height') ?? '').replace(/px$/i, ''))

    return {
      minX: 0,
      minY: 0,
      width: Number.isFinite(widthAttr) && widthAttr > 0 ? widthAttr : 1000,
      height: Number.isFinite(heightAttr) && heightAttr > 0 ? heightAttr : 1000,
    }
  }

  return {
    minX: numbers[0],
    minY: numbers[1],
    width: numbers[2],
    height: numbers[3],
  }
}

function parseStyleFill(style: string | null): string | null {
  if (!style) {
    return null
  }

  const fillPart = style
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.toLowerCase().startsWith('fill:'))

  if (!fillPart) {
    return null
  }

  return fillPart.slice(fillPart.indexOf(':') + 1).trim().toLowerCase()
}

function isBlackPath(path: Element): boolean {
  const directFill = path.getAttribute('fill')?.trim().toLowerCase() ?? null
  const styleFill = parseStyleFill(path.getAttribute('style'))

  const fill = directFill ?? styleFill
  if (fill === null) {
    return true
  }

  if (fill === 'none') {
    return false
  }

  return fill === 'black' || fill === '#000' || fill === '#000000' || fill === 'rgb(0,0,0)'
}

function encodeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function serializePathElement(path: Element): string {
  const withOuterHtml = path as Element & { outerHTML?: string }
  if (typeof withOuterHtml.outerHTML === 'string' && withOuterHtml.outerHTML.length > 0) {
    return withOuterHtml.outerHTML
  }

  const attrs: string[] = []
  for (let i = 0; i < path.attributes.length; i += 1) {
    const attribute = path.attributes.item(i)
    if (!attribute) {
      continue
    }

    attrs.push(`${attribute.name}="${encodeXml(attribute.value)}"`)
  }

  return `<path ${attrs.join(' ')} />`
}

function collectSignsFromLayout(layout: LayoutResult, output: SignInstance[]): void {
  if (layout.kind === 'sign') {
    output.push({
      code: layout.label ?? 'UNKNOWN',
      x: layout.x,
      y: layout.y,
      width: layout.width,
      height: layout.height,
    })
    return
  }

  for (const child of layout.children) {
    collectSignsFromLayout(child, output)
  }
}

function collectSignInstances(placed: readonly PlacedCadrat[]): SignInstance[] {
  const result: SignInstance[] = []
  for (const cadrat of placed) {
    collectSignsFromLayout(cadrat.layout, result)
  }
  return result
}

async function fetchGlyphSvg(code: string): Promise<string | null> {
  if (typeof fetch === 'undefined') {
    return null
  }

  const url = `/glyphs/${encodeURIComponent(code)}.svg`
  const response = await fetch(url)
  if (!response.ok) {
    return null
  }

  return response.text()
}

async function loadGlyphTemplate(code: string): Promise<GlyphTemplate | null> {
  const cached = glyphTemplateCache.get(code)
  if (cached !== undefined) {
    return cached
  }

  const rawSvg = await fetchGlyphSvg(code)
  if (!rawSvg) {
    glyphTemplateCache.set(code, null)
    return null
  }

  try {
    const ParserCtor = getDomParserCtor()
    const doc = new ParserCtor().parseFromString(rawSvg, 'image/svg+xml')
    const svg = doc.documentElement

    if (!svg || svg.tagName.toLowerCase() !== 'svg') {
      glyphTemplateCache.set(code, null)
      return null
    }

    const viewBox = parseViewBox(svg)
    const blackPathMarkup = Array.from(doc.getElementsByTagName('path'))
      .filter((p) => isBlackPath(p))
      .map((p) => serializePathElement(p))
      .join('')

    if (!blackPathMarkup) {
      glyphTemplateCache.set(code, null)
      return null
    }

    const template: GlyphTemplate = {
      minX: viewBox.minX,
      minY: viewBox.minY,
      viewBoxW: viewBox.width,
      viewBoxH: viewBox.height,
      pathsMarkup: blackPathMarkup,
    }

    glyphTemplateCache.set(code, template)
    return template
  } catch {
    glyphTemplateCache.set(code, null)
    return null
  }
}

async function loadTemplates(signs: readonly SignInstance[]): Promise<Map<string, GlyphTemplate>> {
  const uniqueCodes = [...new Set(signs.map((sign) => sign.code))]
  const loaded = await Promise.all(uniqueCodes.map(async (code) => [code, await loadGlyphTemplate(code)] as const))

  const byCode = new Map<string, GlyphTemplate>()
  for (const [code, template] of loaded) {
    if (template) {
      byCode.set(code, template)
    }
  }

  return byCode
}

function renderSignTemplate(sign: SignInstance, template: GlyphTemplate): string {
  const sourceW = Math.max(template.viewBoxW, 1)
  const sourceH = Math.max(template.viewBoxH, 1)
  const sx = sign.width / sourceW
  const sy = sign.height / sourceH
  const tx = sign.x - template.minX * sx
  const ty = sign.y - template.minY * sy

  return `<g data-code="${encodeXml(sign.code)}" transform="translate(${tx} ${ty}) scale(${sx} ${sy})">${template.pathsMarkup}</g>`
}

function renderFallbackRect(sign: SignInstance): string {
  return `<rect x="${sign.x}" y="${sign.y}" width="${sign.width}" height="${sign.height}" fill="none" stroke="#c33" stroke-width="1" /><text x="${sign.x + 2}" y="${sign.y + 12}" font-size="10" fill="#c33">${encodeXml(sign.code)}</text>`
}

function computeTotalSize(placed: readonly PlacedCadrat[], spec: DrawingSpec): SvgRenderSize {
  if (placed.length === 0) {
    return {
      totalWidth: spec.leftMargin + spec.rightMargin,
      totalHeight: spec.topMargin + spec.bottomMargin,
    }
  }

  const maxX = Math.max(...placed.map((p) => p.x + p.width), 0)
  const maxY = Math.max(...placed.map((p) => p.y + p.height), 0)

  return {
    totalWidth: Math.max(spec.leftMargin + spec.rightMargin, maxX + spec.rightMargin),
    totalHeight: Math.max(spec.topMargin + spec.bottomMargin, maxY + spec.bottomMargin),
  }
}

export async function renderPlacedCadratsToSvgString(
  placed: readonly PlacedCadrat[],
  spec: DrawingSpec = new DrawingSpec(),
  size?: SvgRenderSize,
): Promise<SvgRenderResult> {
  const resolvedSize = size ?? computeTotalSize(placed, spec)
  const signs = collectSignInstances(placed)
  const templatesByCode = await loadTemplates(signs)

  const body = signs
    .map((sign) => {
      const template = templatesByCode.get(sign.code)
      return template ? renderSignTemplate(sign, template) : renderFallbackRect(sign)
    })
    .join('')

  const rtlWrapStart = spec.direction === 'rtl' ? `<g transform="scale(-1,1) translate(-${resolvedSize.totalWidth},0)">` : ''
  const rtlWrapEnd = spec.direction === 'rtl' ? '</g>' : ''

  const svg =
    `<svg xmlns="${XML_NS}" width="${resolvedSize.totalWidth}" height="${resolvedSize.totalHeight}" ` +
    `viewBox="0 0 ${resolvedSize.totalWidth} ${resolvedSize.totalHeight}">` +
    `${rtlWrapStart}${body}${rtlWrapEnd}</svg>`

  return {
    svg,
    totalWidth: resolvedSize.totalWidth,
    totalHeight: resolvedSize.totalHeight,
  }
}

export async function renderLineLayoutToSvgString(
  lineLayout: LineLayoutResult,
  spec: DrawingSpec = new DrawingSpec(),
): Promise<string> {
  const result = await renderPlacedCadratsToSvgString(lineLayout.items, spec, {
    totalWidth: lineLayout.totalWidth,
    totalHeight: lineLayout.totalHeight,
  })

  return result.svg
}

export async function renderPlacedCadratsToSvgElement(
  placed: readonly PlacedCadrat[],
  spec: DrawingSpec = new DrawingSpec(),
  size?: SvgRenderSize,
): Promise<Element> {
  const rendered = await renderPlacedCadratsToSvgString(placed, spec, size)
  const ParserCtor = getDomParserCtor()
  const doc = new ParserCtor().parseFromString(rendered.svg, 'image/svg+xml')
  return doc.documentElement
}

export async function renderLineLayoutToSvgElement(
  lineLayout: LineLayoutResult,
  spec: DrawingSpec = new DrawingSpec(),
): Promise<Element> {
  return renderPlacedCadratsToSvgElement(lineLayout.items, spec, {
    totalWidth: lineLayout.totalWidth,
    totalHeight: lineLayout.totalHeight,
  })
}
