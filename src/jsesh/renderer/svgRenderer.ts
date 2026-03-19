// src/jsesh/renderer/svgRenderer.ts — mit Farbunterstützung
// Änderungen:
//  1. SignInstance hat color?: string
//  2. collectFromLayout überträgt layout.color auf sign.color
//  3. renderSignTemplate ersetzt fill-Farben wenn color gesetzt ist

import { DOMParser as XmldomParser } from '@xmldom/xmldom'
import type { PlacedCadrat, LineLayoutResult } from '../layout/lineLayout'
import { DrawingSpec } from '../layout/DrawingSpec'
import type { LayoutResult } from '../layout/cadratLayout'

interface GlyphTemplate {
  minX: number; minY: number
  viewBoxW: number; viewBoxH: number
  naturalWidth: number; naturalHeight: number
  pathsMarkup: string
}

interface SignInstance {
  code: string
  x: number; y: number; width: number; height: number
  naturalWidth?: number; naturalHeight?: number
  viewBoxW?: number; viewBoxH?: number
  offsetX?: number; offsetY?: number
  /** Farbe des Zeichens — undefined oder 'black' = Standard (schwarz) */
  color?: string
}

interface CartoucheInstance {
  x: number; y: number; width: number; height: number
  sw: number; lw: number; ovalH: number; ovalOffX: number; cornerR: number
}

export interface SvgRenderSize { totalWidth: number; totalHeight: number }
export interface SvgRenderResult { svg: string; totalWidth: number; totalHeight: number }

const XML_NS = 'http://www.w3.org/2000/svg'
const glyphTemplateCache = new Map<string, GlyphTemplate | null>()

function getDomParserCtor(): { new (): DOMParser } {
  if (typeof globalThis.DOMParser !== 'undefined') return globalThis.DOMParser
  return XmldomParser as unknown as { new (): DOMParser }
}

function parseViewBox(el: Element): { minX: number; minY: number; width: number; height: number } {
  const raw = el.getAttribute('viewBox')
  if (!raw) {
    const w = Number.parseFloat((el.getAttribute('width') ?? '').replace(/px$/i, ''))
    const h = Number.parseFloat((el.getAttribute('height') ?? '').replace(/px$/i, ''))
    return { minX: 0, minY: 0, width: Number.isFinite(w) && w > 0 ? w : 1000, height: Number.isFinite(h) && h > 0 ? h : 1000 }
  }
  const n = raw.trim().split(/\s+/).map(Number)
  if (n.length !== 4 || n.some(Number.isNaN)) return { minX: 0, minY: 0, width: 1000, height: 1000 }
  return { minX: n[0], minY: n[1], width: n[2], height: n[3] }
}

function parseStyleFill(s: string | null): string | null {
  if (!s) return null
  const p = s.split(';').map(x => x.trim()).find(x => x.toLowerCase().startsWith('fill:'))
  return p ? p.slice(p.indexOf(':') + 1).trim().toLowerCase() : null
}

function isBlackPath(path: Element): boolean {
  const d = path.getAttribute('fill')?.trim().toLowerCase() ?? null
  const s = parseStyleFill(path.getAttribute('style'))
  const f = d ?? s
  if (f === null) return true
  if (f === 'none') return false
  return f === 'black' || f === '#000' || f === '#000000' || f === 'rgb(0,0,0)'
}

function encodeXml(v: string): string {
  return v.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;')
}

function serializePath(path: Element): string {
  const o = path as Element & { outerHTML?: string }
  if (typeof o.outerHTML === 'string' && o.outerHTML.length > 0) return o.outerHTML
  const attrs: string[] = []
  for (let i = 0; i < path.attributes.length; i++) {
    const a = path.attributes.item(i)
    if (a) attrs.push(`${a.name}="${encodeXml(a.value)}"`)
  }
  return `<path ${attrs.join(' ')} />`
}

/** Normalisiert eine Farbe für SVG-Ausgabe */
function normalizeSvgColor(color: string | undefined): string | null {
  if (!color || color === 'black' || color === '#000000' || color === '#000') return null
  // Bekannte Farbnamen → SVG-Farben
  const namedColors: Record<string, string> = {
    red: '#cc0000', green: '#006600', blue: '#0000cc',
    yellow: '#cc9900', white: '#ffffff', gray: '#666666',
  }
  return namedColors[color.toLowerCase()] ?? color
}

/**
 * Ersetzt schwarze fill-Farben im Paths-Markup durch eine neue Farbe.
 * Wird benötigt weil JSesh-SVGs explizit fill="black" oder fill="#000000" haben.
 */
function recolorPathsMarkup(pathsMarkup: string, color: string): string {
  return pathsMarkup
    .replaceAll('fill="#000000"', `fill="${color}"`)
    .replaceAll('fill="black"', `fill="${color}"`)
    .replaceAll('fill:#000000', `fill:${color}`)
    .replaceAll('fill:black', `fill:${color}`)
    .replaceAll('fill:#000"', `fill:${color}"`)
    .replaceAll('fill:#000;', `fill:${color};`)
    .replaceAll('fill:rgb(0,0,0)', `fill:${color}`)
}

function collectFromLayout(
  layout: LayoutResult,
  signs: SignInstance[],
  cartouches: CartoucheInstance[],
): void {
  if (layout.isCartouche) {
    cartouches.push({
      x: layout.x, y: layout.y, width: layout.width, height: layout.height,
      sw:       layout.offsetX  ?? 3,
      lw:       layout.offsetY  ?? 7.5,
      ovalH:    layout.naturalHeight ?? layout.height,
      ovalOffX: layout.naturalWidth  ?? 10.5,
      cornerR:  layout.viewBoxW ?? 9,
    })
    for (const child of layout.children) collectFromLayout(child, signs, cartouches)
    return
  }
  if (layout.kind === 'sign') {
    signs.push({
      code: layout.label ?? 'UNKNOWN',
      x: layout.x, y: layout.y, width: layout.width, height: layout.height,
      naturalWidth: layout.naturalWidth, naturalHeight: layout.naturalHeight,
      viewBoxW: layout.viewBoxW, viewBoxH: layout.viewBoxH,
      offsetX: layout.offsetX, offsetY: layout.offsetY,
      // NEU: Farbe aus LayoutResult übertragen
      color: layout.color,
    })
    return
  }
  for (const child of layout.children) collectFromLayout(child, signs, cartouches)
}

function collectAll(placed: readonly PlacedCadrat[]) {
  const signs: SignInstance[] = []
  const cartouches: CartoucheInstance[] = []
  for (const p of placed) collectFromLayout(p.layout, signs, cartouches)
  return { signs, cartouches }
}

async function fetchGlyphSvg(code: string): Promise<string | null> {
  if (typeof fetch === 'undefined') return null
  const r = await fetch(`/glyphs/${encodeURIComponent(code)}.svg`)
  return r.ok ? r.text() : null
}

async function loadGlyphTemplate(code: string): Promise<GlyphTemplate | null> {
  const cached = glyphTemplateCache.get(code)
  if (cached !== undefined) return cached
  const raw = await fetchGlyphSvg(code)
  if (!raw) { glyphTemplateCache.set(code, null); return null }
  try {
    const doc = new (getDomParserCtor())().parseFromString(raw, 'image/svg+xml')
    const svg = doc.documentElement
    if (!svg || svg.tagName.toLowerCase() !== 'svg') { glyphTemplateCache.set(code, null); return null }
    const vb = parseViewBox(svg)
    const markup = Array.from(doc.getElementsByTagName('path')).filter(isBlackPath).map(serializePath).join('')
    if (!markup) { glyphTemplateCache.set(code, null); return null }
    const t: GlyphTemplate = {
      minX: vb.minX, minY: vb.minY, viewBoxW: vb.width, viewBoxH: vb.height,
      naturalWidth: vb.width, naturalHeight: vb.height, pathsMarkup: markup,
    }
    glyphTemplateCache.set(code, t)
    return t
  } catch { glyphTemplateCache.set(code, null); return null }
}

async function loadTemplates(signs: readonly SignInstance[]): Promise<Map<string, GlyphTemplate>> {
  const codes = [...new Set(signs.map(s => s.code))]
  const loaded = await Promise.all(codes.map(async c => [c, await loadGlyphTemplate(c)] as const))
  const m = new Map<string, GlyphTemplate>()
  for (const [c, t] of loaded) if (t) m.set(c, t)
  return m
}

/**
 * Rendert ein Zeichen als SVG-Gruppe.
 * Wenn color gesetzt ist, werden die schwarzen Paths umgefärbt.
 */
function renderSignTemplate(sign: SignInstance, tmpl: GlyphTemplate): string {
  const nw = sign.naturalWidth ?? tmpl.naturalWidth ?? tmpl.viewBoxW
  const nh = sign.naturalHeight ?? tmpl.naturalHeight ?? tmpl.viewBoxH
  const ox = sign.offsetX ?? tmpl.minX
  const oy = sign.offsetY ?? tmpl.minY
  const sx = sign.width / Math.max(nw, 1)
  const sy = sign.height / Math.max(nh, 1)
  const tx = sign.x - ox * sx
  const ty = sign.y - oy * sy

  // Farbe anwenden: schwarze fill-Werte im Markup ersetzen
  const svgColor = normalizeSvgColor(sign.color)
  const pathsMarkup = svgColor ? recolorPathsMarkup(tmpl.pathsMarkup, svgColor) : tmpl.pathsMarkup

  const colorAttr = svgColor ? ` data-color="${encodeXml(sign.color ?? '')}"` : ''

  return (
    `<g data-code="${encodeXml(sign.code)}"${colorAttr} ` +
    `transform="translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${sx.toFixed(6)} ${sy.toFixed(6)})"` +
    `>${pathsMarkup}</g>`
  )
}

function renderFallbackRect(sign: SignInstance): string {
  const color = normalizeSvgColor(sign.color) ?? '#c33'
  return (
    `<rect x="${sign.x}" y="${sign.y}" width="${sign.width}" height="${sign.height}" fill="none" stroke="${color}" stroke-width="1"/>` +
    `<text x="${sign.x+2}" y="${sign.y+12}" font-size="10" fill="${color}">${encodeXml(sign.code)}</text>`
  )
}

function renderCartouche(c: CartoucheInstance): string {
  const { x, y, sw, lw, ovalH, ovalOffX } = c
  const ovalW  = c.width - ovalOffX - sw / 2
  const ovalX  = x + ovalOffX
  const ovalY  = y + sw / 2
  const r = Math.min(ovalH / 2, ovalW / 2)
  const lineX  = x + sw / 2 + lw / 2
  const lineY1 = ovalY
  const lineY2 = ovalY + ovalH
  const lineSvg = `<line x1="${lineX.toFixed(3)}" y1="${lineY1.toFixed(3)}" x2="${lineX.toFixed(3)}" y2="${lineY2.toFixed(3)}" stroke="black" stroke-width="${lw.toFixed(3)}" stroke-linecap="butt"/>`
  const rectSvg = [
    `<rect`,
    ` x="${ovalX.toFixed(3)}" y="${ovalY.toFixed(3)}"`,
    ` width="${ovalW.toFixed(3)}" height="${ovalH.toFixed(3)}"`,
    ` rx="${r.toFixed(3)}" ry="${r.toFixed(3)}"`,
    ` fill="none" stroke="black" stroke-width="${sw.toFixed(3)}"`,
    `/>`,
  ].join('')
  return lineSvg + rectSvg
}

function computeTotalSize(placed: readonly PlacedCadrat[], spec: DrawingSpec): SvgRenderSize {
  if (placed.length === 0) return { totalWidth: spec.leftMargin + spec.rightMargin, totalHeight: spec.topMargin + spec.bottomMargin }
  const maxX = Math.max(...placed.map(p => p.x + p.width), 0)
  const maxY = Math.max(...placed.map(p => p.y + p.height), 0)
  return {
    totalWidth:  Math.max(spec.leftMargin + spec.rightMargin, maxX + spec.rightMargin),
    totalHeight: Math.max(spec.topMargin + spec.bottomMargin, maxY + spec.bottomMargin),
  }
}

export async function renderPlacedCadratsToSvgString(
  placed: readonly PlacedCadrat[],
  spec: DrawingSpec = new DrawingSpec(),
  size?: SvgRenderSize,
): Promise<SvgRenderResult> {
  const sz = size ?? computeTotalSize(placed, spec)
  const { signs, cartouches } = collectAll(placed)
  const templates = await loadTemplates(signs)

  const cartoucheMarkup = cartouches.map(renderCartouche).join('')
  const signMarkup = signs.map(s => {
    const t = templates.get(s.code)
    return t ? renderSignTemplate(s, t) : renderFallbackRect(s)
  }).join('')

  const rtlStart = spec.direction === 'rtl' ? `<g transform="scale(-1,1) translate(-${sz.totalWidth},0)">` : ''
  const rtlEnd   = spec.direction === 'rtl' ? '</g>' : ''

  const svg = `<svg xmlns="${XML_NS}" width="${sz.totalWidth}" height="${sz.totalHeight}" viewBox="0 0 ${sz.totalWidth} ${sz.totalHeight}">${rtlStart}${cartoucheMarkup}${signMarkup}${rtlEnd}</svg>`
  return { svg, totalWidth: sz.totalWidth, totalHeight: sz.totalHeight }
}

export async function renderLineLayoutToSvgString(lineLayout: LineLayoutResult, spec = new DrawingSpec()): Promise<string> {
  const r = await renderPlacedCadratsToSvgString(lineLayout.items, spec, { totalWidth: lineLayout.totalWidth, totalHeight: lineLayout.totalHeight })
  return r.svg
}

export async function renderPlacedCadratsToSvgElement(placed: readonly PlacedCadrat[], spec = new DrawingSpec(), size?: SvgRenderSize): Promise<Element> {
  const r = await renderPlacedCadratsToSvgString(placed, spec, size)
  return new (getDomParserCtor())().parseFromString(r.svg, 'image/svg+xml').documentElement
}

export async function renderLineLayoutToSvgElement(lineLayout: LineLayoutResult, spec = new DrawingSpec()): Promise<Element> {
  return renderPlacedCadratsToSvgElement(lineLayout.items, spec, { totalWidth: lineLayout.totalWidth, totalHeight: lineLayout.totalHeight })
}
