import { DrawingSpec } from '../layout/DrawingSpec'

export interface GlyphMetric {
  code: string
  width: number
  height: number
}

export type GlyphMetricMap = Map<string, GlyphMetric>

const GLYPH_TAG = /<glyph\b([^>]*)\/>/g
const ATTRIBUTE = /(\w+)="([^"]*)"/g

export function parseGlyphMetricsXml(xml: string): GlyphMetricMap {
  const metrics: GlyphMetricMap = new Map()

  for (const glyphMatch of xml.matchAll(GLYPH_TAG)) {
    const attributes = Object.fromEntries(
      [...glyphMatch[1].matchAll(ATTRIBUTE)].map((match) => [match[1], match[2]]),
    )

    const code = attributes.code
    const width = Number(attributes.width)
    const height = Number(attributes.height)

    if (!code || Number.isNaN(width) || Number.isNaN(height)) {
      continue
    }

    metrics.set(code, { code, width, height })
  }

  return metrics
}

export function getGlyphMetric(
  code: string,
  metrics: GlyphMetricMap,
  spec: DrawingSpec = new DrawingSpec(),
): GlyphMetric {
  return (
    metrics.get(code) ?? {
      code,
      width: spec.glyphWidth,
      height: spec.glyphHeight,
    }
  )
}