import { parseGlyphSvg, type ParsedGlyphSvgMetrics } from './svgParser'

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

  private async fetchGlyphSvg(code: string): Promise<string | null> {
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

  /**
   * Returns metrics synchronously from in-memory cache.
   *
   * If this glyph wasn't loaded yet, loading is started lazily in background and
   * fallback metrics are returned until the load finishes.
   */
  getMetrics(code: string): GlyphMetrics {
    const cached = this.metricsByCode.get(code)
    if (cached) {
      return cached
    }

    this.ensureLoaded(code)
    return FALLBACK_METRICS
  }

  /**
   * No-op in runtime fetch mode (glyphs are loaded lazily by code).
   */
  async preloadAll(): Promise<void> {
    await Promise.resolve()
  }

  private ensureLoaded(code: string): Promise<void> {
    if (this.metricsByCode.has(code)) {
      return Promise.resolve()
    }

    const pending = this.pendingByCode.get(code)
    if (pending) {
      return pending
    }

    const task = this.fetchGlyphSvg(code)
      .then((svgRaw) => {
        if (!svgRaw) {
          this.metricsByCode.set(code, FALLBACK_METRICS)
          return
        }

        const metrics = parseGlyphSvg(svgRaw)
        this.metricsByCode.set(code, metrics)
      })
      .catch(() => {
        this.metricsByCode.set(code, FALLBACK_METRICS)
      })
      .finally(() => {
        this.pendingByCode.delete(code)
      })

    this.pendingByCode.set(code, task)
    return task
  }
}

let singletonRegistry: GlyphRegistry | null = null

export function getGlyphRegistry(): GlyphRegistry {
  if (!singletonRegistry) {
    singletonRegistry = new GlyphRegistry()
  }

  return singletonRegistry
}

export const glyphRegistry = getGlyphRegistry()
