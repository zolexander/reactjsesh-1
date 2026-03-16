import { describe, expect, it, vi } from 'vitest'
import { DrawingSpec } from '../layout/DrawingSpec'
import { buildGroupTree } from '../layout/groupParser'
import { layoutGroupNode } from '../layout/cadratLayout'
import { layoutCadratLines, type LayoutedCadrat } from '../layout/lineLayout'
import { Hieroglyph } from '../model/Hieroglyph'

vi.mock('../glyphs/glyphsRegistry', () => ({
  glyphRegistry: {
    getMetrics: () => ({
      naturalWidth: 1000,
      naturalHeight: 1000,
      offsetX: 0,
      offsetY: 0,
      viewBoxW: 1000,
      viewBoxH: 1000,
    }),
    preloadAll: async () => undefined,
  },
}))

function buildSingleSignLayout(code: string, spec: DrawingSpec) {
  const node = buildGroupTree([new Hieroglyph(code)])
  expect(node).not.toBeNull()
  return layoutGroupNode(node!, spec.cadratHeight, spec.cadratHeight, spec)
}

describe('layout (with mocked square glyph metrics)', () => {
  it('"A1": Kadrat-Breite = cadratHeight * (1000/1000) = 60px', () => {
    const spec = new DrawingSpec()
    const layout = buildSingleSignLayout('A1', spec)

    expect(layout.width).toBe(spec.cadratHeight)
    expect(layout.height).toBe(spec.cadratHeight)
  })

  it('"A1*B1": Gesamtbreite = 2 * (cadratHeight/2) = 60px', () => {
    const spec = new DrawingSpec()

    const a = new Hieroglyph('A1')
    const b = new Hieroglyph('B1')
    b.groupOp = '*'

    const node = buildGroupTree([a, b])
    expect(node).not.toBeNull()

    const layout = layoutGroupNode(node!, spec.cadratHeight, spec.cadratHeight, spec)

    expect(layout.width).toBe(spec.cadratHeight)
  })

  it('Abstand zwischen zwei Kadraten = signSpacing', () => {
    const spec = new DrawingSpec()

    const first = buildSingleSignLayout('A1', spec)
    const second = buildSingleSignLayout('B1', spec)

    const lineInput: LayoutedCadrat[] = [{ layout: first }, { layout: second }]
    const lineLayout = layoutCadratLines(lineInput, spec)

    expect(lineLayout.items.length).toBe(2)

    const gap = lineLayout.items[1].x - (lineLayout.items[0].x + lineLayout.items[0].width)
    expect(gap).toBe(spec.signSpacing)
  })

  it('"A1:B1": Gesamthöhe = cadratHeight (jedes Kind halb so hoch)', () => {
    const spec = new DrawingSpec()

    const a = new Hieroglyph('A1')
    const b = new Hieroglyph('B1')
    b.groupOp = ':'

    const node = buildGroupTree([a, b])
    expect(node).not.toBeNull()

    const layout = layoutGroupNode(node!, spec.cadratHeight, spec.cadratHeight, spec)

    expect(layout.height).toBe(spec.cadratHeight)
  })

  it('Ligatur: beide Zeichen liegen bei x=0, y=0', () => {
    const spec = new DrawingSpec()

    const a = new Hieroglyph('A1')
    const b = new Hieroglyph('B1')
    b.groupOp = '&'

    const node = buildGroupTree([a, b])
    expect(node).not.toBeNull()

    const layout = layoutGroupNode(node!, spec.cadratHeight, spec.cadratHeight, spec)

    expect(layout.kind).toBe('ligature')
    expect(layout.children.length).toBe(2)
    for (const child of layout.children) {
      expect(child.x).toBe(0)
      expect(child.y).toBe(0)
    }
  })
})
