import { useEffect, useMemo, useState } from 'react'
import { parseMdC } from '../parser/mdcParser'
import { DrawingSpec } from '../layout/DrawingSpec'
import { buildGroupTree } from '../layout/groupParser'
import { layoutGroupNode, type LayoutResult } from '../layout/cadratLayout'
import { layoutCadratLines, type LayoutedCadrat, type LineLayoutResult } from '../layout/lineLayout'
import { renderLineLayoutToSvgString } from './svgRenderer'
import type { TopItemList } from '../model/TopItemList'

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
  if (!partial) {
    return merged
  }

  Object.assign(merged, partial)
  return merged
}

function layoutAll(ast: TopItemList, spec: DrawingSpec): LineLayoutResult {
  const layouted: LayoutedCadrat[] = ast.items.map((cadrat) => {
    const tree = buildGroupTree(cadrat.signs)

    const layout: LayoutResult =
      tree === null
        ? {
            kind: 'hgroup',
            x: 0,
            y: 0,
            width: spec.cadratHeight,
            height: spec.cadratHeight,
            children: [],
          }
        : layoutGroupNode(tree, spec.cadratHeight, spec.cadratHeight, spec)

    return { layout }
  })

  return layoutCadratLines(layouted, spec)
}

async function renderSVG(layout: LineLayoutResult, spec: DrawingSpec): Promise<string> {
  return renderLineLayoutToSvgString(layout, spec)
}

export function HieroglyphCanvas({ mdc, spec, className }: HieroglyphCanvasProps) {
  const mergedSpec = useMemo(() => mergeSpec(spec), [spec])

  const parseResult = useMemo(() => {
    try {
      const ast = parseMdC(mdc)
      return { ok: true as const, ast }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown parse error'
      return { ok: false as const, message }
    }
  }, [mdc, mergedSpec])

  const layoutResult = useMemo(() => {
    if (!parseResult.ok) {
      return null
    }

    try {
      return layoutAll(parseResult.ast, mergedSpec)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown layout error'
      return { error: message }
    }
  }, [parseResult, mergedSpec])

  const [state, setState] = useState<RenderState>({ status: 'idle' })

  useEffect(() => {
    let cancelled = false

    if (!parseResult.ok) {
      setState({ status: 'error', message: parseResult.message })
      return () => {
        cancelled = true
      }
    }

    if (layoutResult === null) {
      setState({ status: 'error', message: 'No layout result.' })
      return () => {
        cancelled = true
      }
    }

    if ('error' in layoutResult) {
      setState({ status: 'error', message: layoutResult.error })
      return () => {
        cancelled = true
      }
    }

    setState({ status: 'loading' })

    void renderSVG(layoutResult, mergedSpec)
      .then((svg) => {
        if (!cancelled) {
          setState({ status: 'ready', svg })
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Unknown render error'
          setState({ status: 'error', message })
        }
      })

    return () => {
      cancelled = true
    }
  }, [parseResult, layoutResult, mergedSpec])

  if (state.status === 'error') {
    return (
      <div
        className={className}
        style={{
          border: '2px solid #d32f2f',
          borderRadius: 6,
          padding: 10,
          color: '#b71c1c',
          background: '#ffebee',
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
        }}
      >
        Parse/Layout Error: {state.message}
      </div>
    )
  }

  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <div
        className={className}
        style={{
          border: '1px solid #b0bec5',
          borderRadius: 6,
          padding: 10,
          color: '#455a64',
          background: '#eceff1',
          fontFamily: 'monospace',
        }}
      >
        Loading glyph SVG assets...
      </div>
    )
  }

  if (state.status !== 'ready') {
    return null
  }

  return <div className={className} dangerouslySetInnerHTML={{ __html: state.svg }} />
}
