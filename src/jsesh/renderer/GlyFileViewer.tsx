// src/jsesh/renderer/GlyFileViewer.tsx
// FIXES:
//  1. State wird sofort auf 'loading' gesetzt → keine alten Ergebnisse sichtbar
//  2. UNKNOWN-Symbole werden in der Konsole geloggt mit Original-Code
//  3. loadMdcToGardinerMap() einmalig beim Mount aufgerufen (nicht pro Render)

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DrawingSpec } from '../layout/DrawingSpec'
import { buildGroupTree } from '../layout/groupParser'
import { layoutGroupNode, type LayoutResult } from '../layout/cadratLayout'
import { layoutCadratLines, moveLayout, type LayoutedCadrat, type LineLayoutResult } from '../layout/lineLayout'
import { renderLineLayoutToSvgString } from './svgRenderer'
import { glyphRegistry } from '../glyphs/glyphsRegistry'
import { loadMdcToGardinerMap, findUnresolvableCodes } from '../glyphs/mdcToGardiner'
import { parseGlyFile, type GlyDocument, type GlyDocMetadata } from '../io/glyParser'
import type { CartoucheGroup } from '../model/CartoucheGroup'
import type { Cadrat } from '../model/Cadrat'
import type { TopItem } from '../model/TopItemList'

export interface GlyFileViewerProps {
  glyContent?: string
  spec?: Partial<DrawingSpec>
  showMetadata?: boolean
  /** Zeige Debug-Info für UNKNOWN-Symbole an */
  debug?: boolean
  className?: string
}

type RenderState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; svg: string; metadata: GlyDocMetadata; unknownCodes: string[] }
  | { status: 'error'; message: string }

function mergeSpec(partial?: Partial<DrawingSpec>): DrawingSpec {
  const s = new DrawingSpec()
  if (partial) Object.assign(s, partial)
  return s
}

function isCartoucheGroup(item: TopItem): item is CartoucheGroup {
  return 'kind' in item && item.kind === 'cartouche' && 'items' in item
}

function layoutCartouche(cartouche: CartoucheGroup, spec: DrawingSpec): LayoutedCadrat {
  const cadH = spec.cadratHeight
  const sw = cadH * 0.05; const lw = sw * 2.5; const gap = sw * 0.5
  const padV = sw * 1.5; const padH = sw * 6
  const ovalH = cadH + 2 * padV
  const ovalOffX = sw / 2 + lw + gap
  const contentX = ovalOffX + padH + sw / 2
  const contentY = sw / 2 + padV

  const innerLayouts = cartouche.items.map((cadrat) => {
    const tree = buildGroupTree(cadrat.signs)
    if (!tree) return { kind: 'hgroup' as const, x: 0, y: 0, width: cadH, height: cadH, children: [] } as LayoutResult
    return layoutGroupNode(tree, cadH, cadH, spec)
  })

  const innerH = cadH
  let cursorX = contentX
  const placedInner: LayoutResult[] = []
  for (let i = 0; i < innerLayouts.length; i++) {
    const layout = innerLayouts[i]
    placedInner.push(moveLayout(layout, cursorX, contentY + (innerH - layout.height)))
    cursorX += layout.width
    if (i < innerLayouts.length - 1) cursorX += spec.signSpacing
  }

  const innerW = cursorX - contentX
  const totalW = ovalOffX + innerW + 2 * padH + sw / 2
  const totalH = ovalH + sw

  return {
    layout: {
      kind: 'cartouche', x: 0, y: 0, width: totalW, height: totalH,
      isCartouche: true, offsetX: sw, offsetY: lw,
      naturalHeight: ovalH, naturalWidth: ovalOffX, viewBoxW: 0, viewBoxH: 0,
      children: placedInner,
    },
  }
}

function layoutAll(doc: GlyDocument, spec: DrawingSpec): LineLayoutResult {
  const layouted: LayoutedCadrat[] = []

  for (const item of doc.content.items) {
    if (isCartoucheGroup(item)) {
      layouted.push(layoutCartouche(item, spec))
      continue
    }

    const cadrat = item as Cadrat

    if (cadrat.signs.length === 0 && cadrat.breakAfter) {
      layouted.push({
        layout: { kind: 'hgroup', x: 0, y: 0, width: 0, height: spec.cadratHeight, children: [] },
        breakAfter: cadrat.breakAfter,
      })
      continue
    }

    const tree = buildGroupTree(cadrat.signs)
    const layout: LayoutResult = tree === null
      ? { kind: 'hgroup', x: 0, y: 0, width: spec.cadratHeight, height: spec.cadratHeight, children: [] }
      : layoutGroupNode(tree, spec.cadratHeight, spec.cadratHeight, spec)

    layouted.push({ layout, breakAfter: cadrat.breakAfter })
  }

  const specWithDir = new DrawingSpec()
  Object.assign(specWithDir, spec)
  if (doc.metadata.direction === 'rtl') specWithDir.direction = 'rtl'

  return layoutCadratLines(layouted, specWithDir)
}

// FIX: XML einmalig beim App-Start laden
const mapLoadPromise = loadMdcToGardinerMap()

export function GlyFileViewer({ glyContent, spec: specPartial, showMetadata = true, debug = false, className }: GlyFileViewerProps) {
  const mergedSpec = useMemo(() => mergeSpec(specPartial), [specPartial])

  // FIX: Startzustand ist 'loading' wenn glyContent vorhanden → keine alten Daten sichtbar
  const [state, setState] = useState<RenderState>(
    glyContent ? { status: 'loading' } : { status: 'idle' }
  )
  const runIdRef = useRef(0)

  const render = useCallback(async (content: string) => {
    const runId = ++runIdRef.current

    // FIX: Sofort auf loading setzen → alte SVG verschwindet sofort
    setState({ status: 'loading' })

    try {
      // Warte auf XML-Map (ist meistens schon fertig)
      await mapLoadPromise

      if (runId !== runIdRef.current) return

      const doc = parseGlyFile(content)

      if (doc.content.items.length === 0) {
        if (runId === runIdRef.current)
          setState({ status: 'ready', svg: '', metadata: doc.metadata, unknownCodes: [] })
        return
      }

      // Alle Codes sammeln
      const allCodes = new Set<string>()
      for (const item of doc.content.items) {
        const cadrats: Cadrat[] = isCartoucheGroup(item) ? item.items : [item as Cadrat]
        for (const c of cadrats) for (const s of c.signs) allCodes.add(s.code)
      }

      // FIX: UNKNOWN-Codes vor dem Laden loggen
      const unknownCodes = findUnresolvableCodes([...allCodes])
      if (unknownCodes.length > 0) {
        console.warn('[GlyFileViewer] Nicht aufgelöste MdC-Codes (kein SVG verfügbar):',
          unknownCodes.sort().join(', '))
      }

      // Glyph-Metriken laden
      await Promise.all([...allCodes].map(code => glyphRegistry.ensureLoaded(code)))
      if (runId !== runIdRef.current) return

      const lineLayout = layoutAll(doc, mergedSpec)
      const svg = await renderLineLayoutToSvgString(lineLayout, mergedSpec)

      if (runId === runIdRef.current)
        setState({ status: 'ready', svg, metadata: doc.metadata, unknownCodes })
    } catch (e) {
      if (runId === runIdRef.current)
        setState({ status: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }, [mergedSpec])

  useEffect(() => {
    if (glyContent) {
      void render(glyContent)
    } else {
      // FIX: Content entfernt → sofort idle, keine alten Ergebnisse
      setState({ status: 'idle' })
    }
  }, [glyContent, render])

  // ── Render ──

  if (state.status === 'error') {
    return (
      <div className={className} style={{ border: '2px solid #d32f2f', borderRadius: 6, padding: 10, color: '#b71c1c', background: '#ffebee', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
        Parse-Fehler: {state.message}
      </div>
    )
  }

  if (state.status === 'idle') {
    return (
      <div className={className} style={{ color: '#999', fontStyle: 'italic', padding: 8, fontFamily: 'monospace', fontSize: 13 }}>
        Keine .gly-Datei geladen.
      </div>
    )
  }

  if (state.status === 'loading') {
    return (
      <div className={className} style={{ border: '1px solid #b0bec5', borderRadius: 6, padding: 10, color: '#455a64', background: '#eceff1', fontFamily: 'monospace' }}>
        Lade…
      </div>
    )
  }

  // ready
  return (
    <div className={className}>
      {showMetadata && state.metadata && Object.keys(state.metadata).length > 0 && (
        <div style={{ marginBottom: 8, fontSize: 12, color: '#666', fontFamily: 'monospace' }}>
          {state.metadata.title && <div><strong>Titel:</strong> {state.metadata.title}</div>}
          {state.metadata.direction && <div><strong>Richtung:</strong> {state.metadata.direction.toUpperCase()}</div>}
          {state.metadata.source && <div><strong>Quelle:</strong> {state.metadata.source}</div>}
        </div>
      )}

      {/* FIX: Debug-Panel für UNKNOWN-Symbole */}
      {debug && state.unknownCodes.length > 0 && (
        <details style={{ marginBottom: 8, fontSize: 11, fontFamily: 'monospace', color: '#c33' }}>
          <summary style={{ cursor: 'pointer' }}>
            ⚠ {state.unknownCodes.length} unbekannte MdC-Codes (kein SVG)
          </summary>
          <div style={{ marginTop: 4, padding: '4px 8px', background: '#fff5f5', border: '1px solid #fcc', borderRadius: 4 }}>
            {state.unknownCodes.sort().join(', ')}
          </div>
        </details>
      )}

      {state.svg
        ? <div dangerouslySetInnerHTML={{ __html: state.svg }} />
        : <div style={{ color: '#999', fontStyle: 'italic', fontSize: 13 }}>Leerer Text.</div>
      }
    </div>
  )
}

export function GlyFileUploader({ spec, className, debug }: { spec?: Partial<DrawingSpec>; className?: string; debug?: boolean }) {
  const [content, setContent] = useState<string | undefined>()
  const [filename, setFilename] = useState<string>('')

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFilename(file.name)
    // FIX: content erst auf undefined setzen → GlyFileViewer zeigt sofort 'idle'
    // dann nach kurzer Verzögerung den neuen Inhalt setzen → loading-State sauber
    setContent(undefined)
    const reader = new FileReader()
    reader.onload = (ev) => setContent(ev.target?.result as string)
    reader.readAsText(file, 'UTF-8')
  }, [])

  return (
    <div className={className}>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{ cursor: 'pointer', padding: '6px 14px', background: '#1976d2', color: 'white', borderRadius: 4, fontSize: 13, fontFamily: 'monospace', display: 'inline-block' }}>
          .gly-Datei öffnen
          <input type="file" accept=".gly" onChange={handleFileChange} style={{ display: 'none' }} />
        </label>
        {filename && <span style={{ fontSize: 12, color: '#666', fontFamily: 'monospace' }}>{filename}</span>}
      </div>
      <GlyFileViewer glyContent={content} spec={spec} showMetadata debug={debug} />
    </div>
  )
}
