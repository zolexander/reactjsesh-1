// src/jsesh/renderer/HieroglyphCanvas.tsx

import { useEffect, useMemo, useRef, useState } from 'react'
import { parseMdC } from '../parser/mdcParser'
import { DrawingSpec } from '../layout/DrawingSpec'
import { buildGroupTree } from '../layout/groupParser'
import { layoutGroupNode, type LayoutResult } from '../layout/cadratLayout'
import { layoutCadratLines, moveLayout, type LayoutedCadrat, type LineLayoutResult } from '../layout/lineLayout'
import { renderLineLayoutToSvgString } from './svgRenderer'
import { glyphRegistry } from '../glyphs/glyphsRegistry'
import type { CartoucheGroup } from '../model/CartoucheGroup'
import type { Cadrat } from '../model/Cadrat'
import type { TopItem } from '../model/TopItemList'

export interface HieroglyphCanvasProps {
  mdc: string
  spec?: Partial<DrawingSpec>
  className?: string
}

type RenderState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; svg: string }
  | { status: 'error'; message: string }

function mergeSpec(partial?: Partial<DrawingSpec>): DrawingSpec {
  const merged = new DrawingSpec()
  if (partial) Object.assign(merged, partial)
  return merged
}

function isCartoucheGroup(item: TopItem): item is CartoucheGroup {
  return 'kind' in item && item.kind === 'cartouche' && 'items' in item
}

/**
 * Kartusche layouten — echtes Stadium (Halbkreis-Enden).
 *
 * Geometrie:
 *   sw      = cadH × 0.05       Oval-Strichbreite   (3px  bei h=60)
 *   lw      = sw  × 2.5         Knotenlinie-Breite  (7.5px)
 *   padV    = sw  × 1.5         vertikales Padding  (4.5px)
 *   ovalH   = cadH + 2×padV     Oval-Höhe           (69px)
 *   r       = ovalH / 2         Halbkreis-Radius    (34.5px) ← echtes Stadium
 *   padH    = sw  × 6           horiz. Padding      (18px)
 *
 * Warum padH = sw×6?
 *   Mit r=34.5 muss padH ≥ r - sqrt(r²-(cadH/2)²) = 17.46px sein,
 *   damit die Zeichen-Ecken INNERHALB der Halbkreiskurve liegen.
 *   sw×6 = 18px > 17.46px → Sicherheitsmargin ✓
 *
 * Geheimfelder im LayoutResult (für svgRenderer):
 *   offsetX      → sw
 *   offsetY      → lw
 *   naturalHeight → ovalH   (→ r = ovalH/2 im Renderer)
 *   naturalWidth  → ovalOffX
 *   viewBoxW     → 0 (nicht mehr nötig, Stadium statt Rounded Rect)
 */
function layoutCartouche(cartouche: CartoucheGroup, spec: DrawingSpec): LayoutedCadrat {
  const cadH    = spec.cadratHeight
  const sw      = cadH * 0.05
  const lw      = sw * 2.5
  const gap     = sw * 0.5
  const padV    = sw * 1.5
  const padH    = sw * 6              // ← erhöht von sw×4 auf sw×6

  const ovalH   = cadH + 2 * padV    // 69px
  // r = ovalH/2 wird im Renderer berechnet (naturalHeight → r)

  const ovalOffX = sw / 2 + lw + gap // 10.5px

  // Inhalt layouten
  const innerLayouts = cartouche.items.map((cadrat) => {
    const tree = buildGroupTree(cadrat.signs)
    if (!tree) return { kind: 'hgroup' as const, x: 0, y: 0, width: cadH, height: cadH, children: [] } as LayoutResult
    return layoutGroupNode(tree, cadH, cadH, spec)
  })

  const innerH    = cadH
  const contentX  = ovalOffX + padH + sw / 2
  const contentY  = sw / 2 + padV

  let cursorX = contentX
  const placedInner: LayoutResult[] = []
  for (let i = 0; i < innerLayouts.length; i++) {
    const layout = innerLayouts[i]
    const dy = contentY + (innerH - layout.height)
    placedInner.push(moveLayout(layout, cursorX, dy))
    cursorX += layout.width
    if (i < innerLayouts.length - 1) cursorX += spec.signSpacing
  }

  const innerW  = cursorX - contentX
  const ovalW   = innerW + 2 * padH
  const totalW  = ovalOffX + ovalW + sw / 2
  const totalH  = ovalH + sw

  return {
    layout: {
      kind:          'cartouche',
      x:             0,
      y:             0,
      width:         totalW,
      height:        totalH,
      isCartouche:   true,
      offsetX:       sw,
      offsetY:       lw,
      naturalHeight: ovalH,
      naturalWidth:  ovalOffX,
      viewBoxW:      0,
      viewBoxH:      0,
      children:      placedInner,
    },
  }
}

function layoutAll(ast: ReturnType<typeof parseMdC>, spec: DrawingSpec): LineLayoutResult {
  const layouted: LayoutedCadrat[] = ast.items.map((item) => {
    if (isCartoucheGroup(item)) return layoutCartouche(item, spec)
    const cadrat = item as Cadrat
    const tree = buildGroupTree(cadrat.signs)
    const layout: LayoutResult = tree === null
      ? { kind: 'hgroup', x: 0, y: 0, width: spec.cadratHeight, height: spec.cadratHeight, children: [] }
      : layoutGroupNode(tree, spec.cadratHeight, spec.cadratHeight, spec)
    return { layout }
  })
  return layoutCadratLines(layouted, spec)
}

export function HieroglyphCanvas({ mdc, spec: specPartial, className }: HieroglyphCanvasProps) {
  const mergedSpec = useMemo(() => mergeSpec(specPartial), [specPartial])
  const [state, setState] = useState<RenderState>({ status: 'idle' })
  const runIdRef = useRef(0)

  useEffect(() => {
    const runId = ++runIdRef.current
    setState({ status: 'loading' })

    async function run() {
      let ast: ReturnType<typeof parseMdC>
      try { ast = parseMdC(mdc) } catch (e) {
        if (runId === runIdRef.current)
          setState({ status: 'error', message: e instanceof Error ? e.message : String(e) })
        return
      }

      if (ast.items.length === 0) {
        if (runId === runIdRef.current) setState({ status: 'ready', svg: '' })
        return
      }

      const codes = new Set<string>()
      for (const item of ast.items) {
        const cadrats: Cadrat[] = isCartoucheGroup(item) ? item.items : [item as Cadrat]
        for (const c of cadrats) for (const s of c.signs) codes.add(s.code)
      }

      await Promise.all([...codes].map((code) => glyphRegistry.ensureLoaded(code)))
      if (runId !== runIdRef.current) return

      let lineLayout: LineLayoutResult
      try { lineLayout = layoutAll(ast, mergedSpec) } catch (e) {
        if (runId === runIdRef.current)
          setState({ status: 'error', message: e instanceof Error ? e.message : String(e) })
        return
      }

      try {
        const svg = await renderLineLayoutToSvgString(lineLayout, mergedSpec)
        if (runId === runIdRef.current) setState({ status: 'ready', svg })
      } catch (e) {
        if (runId === runIdRef.current)
          setState({ status: 'error', message: e instanceof Error ? e.message : String(e) })
      }
    }

    void run()
  }, [mdc, mergedSpec])

  if (state.status === 'error') {
    return <div className={className} style={{ border: '2px solid #d32f2f', borderRadius: 6, padding: 10, color: '#b71c1c', background: '#ffebee', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>Fehler: {state.message}</div>
  }
  if (state.status === 'loading' || state.status === 'idle') {
    return <div className={className} style={{ border: '1px solid #b0bec5', borderRadius: 6, padding: 10, color: '#455a64', background: '#eceff1', fontFamily: 'monospace' }}>Lade Glyph-Assets…</div>
  }
  if (state.status !== 'ready' || !state.svg) return null
  return <div className={className} dangerouslySetInnerHTML={{ __html: state.svg }} />
}
