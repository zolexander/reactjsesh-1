// src/jsesh/glyphs/glyphsRegistry.ts
// FIX: resolveGardinerCode() wird jetzt beim Laden verwendet.
// MdC-Codes wie 'i', 'w', 'ra' werden auf Gardiner-SVG-Dateinamen
// ('M17', 'G43', 'N5') aufgelöst bevor der Fetch passiert.

import { parseGlyphSvg, type ParsedGlyphSvgMetrics } from './svgParser'
import { resolveGardinerCode } from './mdcToGardiner'

export type GlyphMetrics = ParsedGlyphSvgMetrics

const FALLBACK_METRICS: GlyphMetrics = {
  naturalWidth: 1000,
  naturalHeight: 1000,
  offsetX: 0,
  offsetY: 0,
  viewBoxW: 1000,
  viewBoxH: 1000,
}

class GlyphRegistry {
  private readonly metricsByCode = new Map<string, GlyphMetrics>()
  private readonly pendingByCode = new Map<string, Promise<void>>()

  private async fetchGlyphSvg(gardinerCode: string): Promise<string | null> {
    if (typeof fetch === 'undefined') return null
    const url = `/glyphs/${encodeURIComponent(gardinerCode)}.svg`
    const response = await fetch(url)
    if (!response.ok) return null
    return response.text()
  }

  getMetrics(mdcCode: string): GlyphMetrics {
    const gardinerCode = resolveGardinerCode(mdcCode)
    return this.metricsByCode.get(gardinerCode) ?? FALLBACK_METRICS
  }

  async ensureLoaded(mdcCode: string): Promise<void> {
    const gardinerCode = resolveGardinerCode(mdcCode)
    if (this.metricsByCode.has(gardinerCode)) return
    const pending = this.pendingByCode.get(gardinerCode)
    if (pending) return pending
    const task = this.fetchGlyphSvg(gardinerCode)
      .then((svgRaw) => {
        if (!svgRaw) { this.metricsByCode.set(gardinerCode, FALLBACK_METRICS); return }
        try {
          const metrics = parseGlyphSvg(svgRaw)
          this.metricsByCode.set(gardinerCode,
            (metrics.naturalWidth === 0 || metrics.naturalHeight === 0) ? FALLBACK_METRICS : metrics)
        } catch { this.metricsByCode.set(gardinerCode, FALLBACK_METRICS) }
      })
      .catch(() => { this.metricsByCode.set(gardinerCode, FALLBACK_METRICS) })
      .finally(() => { this.pendingByCode.delete(gardinerCode) })
    this.pendingByCode.set(gardinerCode, task)
    return task
  }

  async preloadAll(codes?: readonly string[]): Promise<void> {
    if (!codes || codes.length === 0) return
    await Promise.all(codes.map((code) => this.ensureLoaded(code)))
  }
}

let singletonRegistry: GlyphRegistry | null = null
export function getGlyphRegistry(): GlyphRegistry {
  if (!singletonRegistry) singletonRegistry = new GlyphRegistry()
  return singletonRegistry
}
export const glyphRegistry = getGlyphRegistry()