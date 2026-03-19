// src/jsesh/io/glyParser.ts
// FIX KRITISCH: splitByColorMarkers() war falsch implementiert.
//
// JSesh Farb-Syntax: $r = rot an, $b = schwarz/aus
//   Das erste Zeichen nach '$' ist der FARBNAME, kein MdC-Code!
//
// ALT (FALSCH):
//   "$r-G7-$b-A1".split('$') → ['', 'r-G7-', 'b-A1']
//   Segment 'r-G7-' wurde als MdC geparst → 'r' = Hieroglyphe D21  ← FALSCH
//
// NEU (KORREKT):
//   "$r-G7-$b-A1".split('$') → ['', 'r-G7-', 'b-A1']
//   Segment 'r-G7-': colorChar='r'→rot, mdcPart='-G7-' → strip leading '-'
//   Segment 'b-A1':  colorChar='b'→schwarz, mdcPart='-A1' → strip leading '-'

import { DOMParser as XmldomParser } from '@xmldom/xmldom'
import { parseMdC } from '../parser/mdcParser'
import { TopItemList } from '../model/TopItemList'
import { Cadrat } from '../model/Cadrat'
import { Hieroglyph } from '../model/Hieroglyph'
import { CartoucheGroup } from '../model/CartoucheGroup'

export type GlyphColor = 'black' | 'red' | 'green' | 'blue' | 'yellow' | 'white' | string

export interface GlyDocMetadata {
  title?: string
  direction?: 'ltr' | 'rtl'
  orientation?: 'horizontal' | 'vertical'
  source?: string
  author?: string
  date?: string
  [key: string]: string | undefined
}

export interface GlyDocument {
  metadata: GlyDocMetadata
  content: TopItemList
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────

function getDomParserCtor(): { new (): DOMParser } {
  if (typeof globalThis.DOMParser !== 'undefined') return globalThis.DOMParser
  return XmldomParser as unknown as { new (): DOMParser }
}

function detectFormat(content: string): 'xml' | 'legacy-text' {
  const t = content.trimStart()
  return (t.startsWith('<?xml') || t.startsWith('<JSesh') || t.startsWith('<jsesh'))
    ? 'xml' : 'legacy-text'
}

// ── Farb-Parsing ──────────────────────────────────────────────────────────

interface ColoredMdcSegment { mdc: string; color: GlyphColor }

/**
 * Zerlegt einen MdC-String mit JSesh-Farbwechseln in Segmente.
 *
 * JSesh-Syntax: $r = rot ein, $b = schwarz/aus, $g = grün, $y = gelb
 * Das Zeichen DIREKT nach '$' ist der FARBNAME — kein MdC-Code!
 *
 * Beispiel: "A1-$r-G7-$b-B1"
 *   split('$') → ['A1-', 'r-G7-', 'b-B1']
 *   Segment 0: color=schwarz, mdc='A1-'
 *   Segment 1: colorChar='r'→rot, mdc='-G7-' (führendes '-' ist Trenner, OK)
 *   Segment 2: colorChar='b'→schwarz, mdc='-B1'
 */
function splitByColorMarkers(mdc: string): ColoredMdcSegment[] {
  const segments: ColoredMdcSegment[] = []
  const parts = mdc.split('$')

  // Erstes Segment: kein Farbcode-Präfix → immer schwarz
  if (parts[0].length > 0) {
    segments.push({ mdc: parts[0], color: 'black' })
  }

  // Alle weiteren Segmente: erstes Zeichen = Farbname, Rest = MdC
  for (let i = 1; i < parts.length; i++) {
    const segment = parts[i]
    if (segment.length === 0) continue

    const colorChar = segment[0]  // 'r', 'b', 'g', 'y', 'w'
    // FIX: Führendes '-' entfernen — '-A1' → colorChar='r', mdcPart='-A1'
    // Das '-' nach dem Farb-Code ist ein MdC-Trenner, kein Kadrat
    const mdcPart   = segment.slice(1).replace(/^-+/, '')  // Rest ohne führende Trennzeichen

    const color: GlyphColor =
      colorChar === 'r' ? 'red'    :
      colorChar === 'g' ? 'green'  :
      colorChar === 'y' ? 'yellow' :
      colorChar === 'w' ? 'white'  :
      'black'  // 'b' oder unbekannt → schwarz

    if (mdcPart.length > 0) {
      segments.push({ mdc: mdcPart, color })
    }
  }

  return segments
}

function applyColorToTopItemList(list: TopItemList, color: GlyphColor): void {
  for (const item of list.items) {
    const cadrats = item instanceof CartoucheGroup ? item.items : [item as Cadrat]
    for (const c of cadrats)
      for (const s of c.signs)
        s.color = color
  }
}

/**
 * Parst MdC mit Farbwechseln ($r/$b) und Zeilenumbrüchen (!).
 * Setzt breakAfter='!' auf dem letzten Item jeder Zeile.
 */
function parseColoredMdC(mdc: string): TopItemList {
  if (!mdc.includes('$') && !mdc.includes('!')) {
    return parseMdC(mdc)
  }

  // Zuerst bei '!' in Zeilen aufteilen
  const lines = mdc.split('!')
  const combined = new TopItemList()

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx].trim()
    if (!line) continue

    // Dann Farbsegmente verarbeiten
    let lineItems: TopItemList

    if (!line.includes('$')) {
      lineItems = parseMdC(line)
    } else {
      lineItems = new TopItemList()
      for (const { mdc: seg, color } of splitByColorMarkers(line)) {
        const trimmed = seg.trim()
        if (!trimmed) continue
        const parsed = parseMdC(trimmed)
        applyColorToTopItemList(parsed, color)
        for (const item of parsed.items) lineItems.add(item)
      }
    }

    // Letztes Item der Zeile bekommt breakAfter wenn noch Zeilen folgen
    if (lineIdx < lines.length - 1 && lineItems.items.length > 0) {
      const last = lineItems.items[lineItems.items.length - 1]
      if (last instanceof Cadrat) {
        last.breakAfter = '!'
      } else if (last instanceof CartoucheGroup) {
        const breakCadrat = new Cadrat()
        breakCadrat.breakAfter = '!'
        for (const item of lineItems.items) combined.add(item)
        combined.add(breakCadrat)
        continue
      }
    }

    for (const item of lineItems.items) combined.add(item)
  }

  return combined
}

// ── Legacy-Textformat ─────────────────────────────────────────────────────

function parseLegacyTextFormat(content: string): GlyDocument {
  const lines = content.split('\n')
  const metadata: GlyDocMetadata = {}
  const mdcLines: string[] = []
  let inMetadata = true

  for (const line of lines) {
    const trimmed = line.trim()

    if (inMetadata && trimmed.startsWith('++')) {
      const withoutPlus = trimmed.slice(2)
      // JSesh-Metadaten nutzen SPACE als Trennzeichen (nicht ':')
      // Format: "++key value +s" oder "++key: value"
      const colonIdx = withoutPlus.indexOf(':')
      const spaceIdx = withoutPlus.indexOf(' ')
      // Bevorzuge ':' wenn vorhanden, sonst ersten Leerzeichen
      const sepIdx = colonIdx !== -1 ? colonIdx : spaceIdx
      if (sepIdx !== -1) {
        const key   = withoutPlus.slice(0, sepIdx).trim().toLowerCase()
        // Entferne JSesh-Endmarker " +s" oder "+s"
        const value = withoutPlus.slice(sepIdx + 1).trim().replace(/\s*\+s\s*$/i, '').trim()
        if (key === 'jsesh_page_direction') {
          metadata.direction = value.toLowerCase().includes('left') ? 'rtl' : 'ltr'
        } else if (key === 'jsesh_page_orientation') {
          metadata.orientation = value.toLowerCase().includes('vert') ? 'vertical' : 'horizontal'
        } else {
          metadata[key] = value
        }
      }
      continue
    }

    inMetadata = false
    if (trimmed.length > 0) mdcLines.push(trimmed)
  }

  // Zeilen mit '!' verbinden → parseColoredMdC setzt breakAfter korrekt
  const mdcText = mdcLines.join('!')
  return { metadata, content: parseColoredMdC(mdcText) }
}

// ── XML-Format ────────────────────────────────────────────────────────────

function parseXmlColor(attr: string | null): GlyphColor {
  if (!attr) return 'black'
  const known: Record<string, GlyphColor> = {
    red: 'red', green: 'green', blue: 'blue',
    yellow: 'yellow', white: 'white', black: 'black',
  }
  return known[attr.trim().toLowerCase()] ?? attr.trim().toLowerCase()
}

function extractXmlMetadata(doc: Document): GlyDocMetadata {
  const metadata: GlyDocMetadata = {}
  const headerEl = doc.getElementsByTagName('header')[0]
    || doc.getElementsByTagName('metadata')[0]
  if (headerEl) {
    for (let i = 0; i < headerEl.childNodes.length; i++) {
      const node = headerEl.childNodes[i]
      if (node.nodeType === 1) {
        const el = node as Element
        metadata[el.tagName.toLowerCase()] = el.textContent?.trim() ?? ''
      }
    }
  }
  const root = doc.documentElement
  const dir = root.getAttribute('direction') || root.getAttribute('textDirection')
  if (dir) metadata.direction = dir.toLowerCase().includes('right') ? 'rtl' : 'ltr'
  return metadata
}

function parseXmlWord(wordEl: Element): Cadrat | null {
  const signs = [
    ...Array.from(wordEl.getElementsByTagName('s')),
    ...Array.from(wordEl.getElementsByTagName('sign')),
  ]
  if (signs.length === 0) return null
  const cadrat = new Cadrat()
  for (let i = 0; i < signs.length; i++) {
    const el = signs[i]
    const code = el.getAttribute('c') || el.getAttribute('code') || el.getAttribute('mdc') || ''
    if (!code) continue
    const glyph = new Hieroglyph(code)
    const op = el.getAttribute('op') || el.getAttribute('groupOp')
    if (op && i > 0) {
      if (op === ':' || op === 'VGROUP') glyph.groupOp = ':'
      else if (op === '*' || op === 'HGROUP') glyph.groupOp = '*'
      else if (op === '&' || op === 'LIGATURE') glyph.groupOp = '&'
    }
    const col = el.getAttribute('col') || el.getAttribute('color')
    if (col) glyph.color = parseXmlColor(col)
    const size = el.getAttribute('size') || el.getAttribute('scale')
    if (size) { const n = Number(size); if (!isNaN(n) && n > 0) glyph.setRelativeSize(n) }
    const rot = el.getAttribute('rot') || el.getAttribute('angle')
    if (rot) { const n = Number(rot); if (!isNaN(n)) glyph.setAngle(n) }
    const rev = el.getAttribute('rev') || el.getAttribute('reversed')
    if (rev === 'true' || rev === '1') glyph.setReversed(true)
    cadrat.add(glyph)
  }
  return cadrat.signs.length > 0 ? cadrat : null
}

function parseXmlFormat(xmlContent: string): GlyDocument {
  const doc = new (getDomParserCtor())().parseFromString(xmlContent, 'application/xml')
  const metadata = extractXmlMetadata(doc)

  // Variante A: roher MdC
  const textEl = doc.getElementsByTagName('text')[0] || doc.getElementsByTagName('mdc')[0]
  if (textEl?.childNodes.length === 1 && textEl.childNodes[0].nodeType === 3) {
    const mdcText = textEl.textContent?.trim() ?? ''
    if (mdcText && /[A-Za-z0-9]/.test(mdcText))
      return { metadata, content: parseColoredMdC(mdcText) }
  }

  // Variante B: strukturierte Elemente
  const root = doc.getElementsByTagName('textContent')[0]
    || doc.getElementsByTagName('lines')[0]
    || doc.documentElement
  const result = new TopItemList()

  function processElement(el: Element): void {
    const tag = el.tagName.toLowerCase().replace(/^jsesh:/, '')
    switch (tag) {
      case 'l': case 'line':
        for (let i = 0; i < el.childNodes.length; i++) {
          const c = el.childNodes[i]
          if (c.nodeType === 1) processElement(c as Element)
        }
        break
      case 'w': case 'word': case 'quad': case 'cadrat': {
        const type = el.getAttribute('type') || el.getAttribute('t')
        if (type === 'cartouche' || type === 'c') {
          const inner: Cadrat[] = []
          for (let i = 0; i < el.childNodes.length; i++) {
            const c = el.childNodes[i]
            if (c.nodeType === 1) {
              const ct = (c as Element).tagName.toLowerCase().replace(/^jsesh:/, '')
              if (ct === 'w' || ct === 'word' || ct === 'quad') {
                const cad = parseXmlWord(c as Element)
                if (cad) inner.push(cad)
              }
            }
          }
          if (inner.length > 0) result.add(new CartoucheGroup(inner, 'cartouche'))
        } else {
          const cad = parseXmlWord(el)
          if (cad) result.add(cad)
        }
        break
      }
      case 'br': case 'linebreak': case 'lb':
        if (result.items.length > 0) {
          const last = result.items[result.items.length - 1]
          if (last instanceof Cadrat) { last.breakAfter = '!' }
          else { const b = new Cadrat(); b.breakAfter = '!'; result.add(b) }
        }
        break
      default:
        for (let i = 0; i < el.childNodes.length; i++) {
          const c = el.childNodes[i]
          if (c.nodeType === 1) processElement(c as Element)
        }
    }
  }

  for (let i = 0; i < root.childNodes.length; i++) {
    const c = root.childNodes[i]
    if (c.nodeType === 1) processElement(c as Element)
  }

  if (result.items.length === 0) {
    const raw = doc.documentElement.textContent?.trim() ?? ''
    const mdcLines = raw.split('\n').map(l => l.trim())
      .filter(l => !l.startsWith('++') && /[A-Za-z0-9]/.test(l))
    if (mdcLines.length > 0)
      return { metadata, content: parseColoredMdC(mdcLines.join('!')) }
  }

  return { metadata, content: result }
}

// ── Public API ────────────────────────────────────────────────────────────

export function parseGlyFile(fileContent: string): GlyDocument {
  return detectFormat(fileContent) === 'xml'
    ? parseXmlFormat(fileContent)
    : parseLegacyTextFormat(fileContent)
}

export function parseGlyFileToTopItemList(fileContent: string): TopItemList {
  return parseGlyFile(fileContent).content
}
