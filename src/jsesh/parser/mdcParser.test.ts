import { describe, expect, it } from 'vitest'
import { parseMdC } from './mdcParser'
import { CartoucheGroup } from '../model/CartoucheGroup'

function expectSigns(mdc: string, expectedCadrats: number, expectedSignsPerCadrat: number[]): ReturnType<typeof parseMdC> {
  const ast = parseMdC(mdc)
  expect(ast.items.length).toBe(expectedCadrats)
  expect(ast.items.map((c) => c.signs.length)).toEqual(expectedSignsPerCadrat)
  return ast
}

describe('mdcParser', () => {
  it('"A1" -> 1 Kadrat, 1 Zeichen, groupOp=NONE', () => {
    const ast = expectSigns('A1', 1, [1])
    expect(ast.items[0].signs[0].groupOp).toBeNull()
  })

  it('"A1-B1" -> 2 Kadraten', () => {
    expectSigns('A1-B1', 2, [1, 1])
  })

  it('"A1*B1" -> 1 Kadrat, 2 Zeichen, zweites mit groupOp=HGROUP', () => {
    const ast = expectSigns('A1*B1', 1, [2])
    expect(ast.items[0].signs[0].groupOp).toBeNull()
    expect(ast.items[0].signs[1].groupOp).toBe('*')
  })

  it('"A1:B1" -> 1 Kadrat, 2 Zeichen, zweites mit groupOp=VGROUP', () => {
    const ast = expectSigns('A1:B1', 1, [2])
    expect(ast.items[0].signs[0].groupOp).toBeNull()
    expect(ast.items[0].signs[1].groupOp).toBe(':')
  })

  it('"A1&B1" -> 1 Kadrat, zweites Zeichen mit groupOp=LIGATURE', () => {
    const ast = expectSigns('A1&B1', 1, [2])
    expect(ast.items[0].signs[0].groupOp).toBeNull()
    expect(ast.items[0].signs[1].groupOp).toBe('&')
  })

  it('"A1*B1:C1" -> 1 Kadrat, 3 Zeichen: A(NONE), B(HGROUP), C(VGROUP)', () => {
    const ast = expectSigns('A1*B1:C1', 1, [3])
    expect(ast.items[0].signs[0].groupOp).toBeNull()
    expect(ast.items[0].signs[1].groupOp).toBe('*')
    expect(ast.items[0].signs[2].groupOp).toBe(':')
  })

  it('"i-w-r:a" -> 3 Kadraten: [i], [w], [r,a(VGROUP)]', () => {
    const ast = expectSigns('i-w-r:a', 3, [1, 1, 2])
    expect(ast.items[0].signs[0].code.toLowerCase()).toBe('i')
    expect(ast.items[1].signs[0].code.toLowerCase()).toBe('w')
    expect(ast.items[2].signs[0].code.toLowerCase()).toBe('r')
    expect(ast.items[2].signs[1].code.toLowerCase()).toBe('a')
    expect(ast.items[2].signs[1].groupOp).toBe(':')
  })

  it('Regression: "i-w-r:a-ra:1-A40-m-(p*t):pt" -> 7 separate Kadraten', () => {
    const ast = parseMdC('i-w-r:a-ra:1-A40-m-(p*t):pt')
    // i, w, r:a, ra:1, A40, m, (p*t):pt
    expect(ast.items.length).toBe(7)
    expect(ast.items[0].signs[0].code.toLowerCase()).toBe('i')
    expect(ast.items[1].signs[0].code.toLowerCase()).toBe('w')
    expect(ast.items[4].signs[0].code).toBe('A40')
  })

  it('"<A1-B1>" -> 1 CartoucheGroup mit 2 inneren Kadraten', () => {
    const ast = parseMdC('<A1-B1>')
    expect(ast.items.length).toBe(1)
    expect(ast.items[0]).toBeInstanceOf(CartoucheGroup)

    const cartouche = ast.items[0] as CartoucheGroup
    expect(cartouche.items.length).toBe(2)
    expect(cartouche.items[0].signs[0].code).toBe('A1')
    expect(cartouche.items[1].signs[0].code).toBe('B1')
  })

  it('"A1{{10,20,80}}" übernimmt absolute Position und Skalierung', () => {
    const ast = parseMdC('A1{{10,20,80}}')
    const glyph = ast.items[0].signs[0]

    expect(glyph.getX()).toBe(10)
    expect(glyph.getY()).toBe(20)
    expect(glyph.getRelativeSize()).toBe(80)
  })

  it('"A1**B1" behandelt ** als Trenner zwischen Kadraten', () => {
    const ast = parseMdC('A1**B1')
    expect(ast.items.length).toBe(2)
    expect(ast.items[0].signs[0].code).toBe('A1')
    expect(ast.items[1].signs[0].code).toBe('B1')
  })
})

describe('mdcParser robustness', () => {
  it('unknown token becomes UNKNOWN glyph and parsing continues', () => {
    // '$' wird inzwischen absichtlich vom Lexer übersprungen (Farbmarker-Rest).
    // Für echte Unknown-Robustheit verwenden wir daher '?'.
    const ast = parseMdC('?')
    expect(ast.items.length).toBe(1)
    expect(ast.items[0].signs.length).toBe(1)
    expect(ast.items[0].signs[0].code.toUpperCase()).toContain('UNKNOWN')
  })

  it('unbalanced parenthesis does not throw and keeps parsed inner signs', () => {
    expect(() => parseMdC('(A1')).not.toThrow()

    const ast = parseMdC('(A1')
    expect(ast.items.length).toBe(1)
    expect(ast.items[0].signs.length).toBe(1)
    expect(ast.items[0].signs[0].code).toBe('A1')
  })

  it('modifier variants are applied: \\r, \\s, \\4', () => {
    const ast = parseMdC('A1\\r\\s\\4')
    const glyph = ast.items[0].signs[0]

    expect(glyph.isReversed()).toBe(true)
    expect(glyph.isWide()).toBe(true)
    expect(glyph.getAngle()).toBe(360)
  })

  it('unknown modifier does not crash parsing', () => {
    expect(() => parseMdC('A1\\m')).not.toThrow()

    const ast = parseMdC('A1\\m')
    expect(ast.items.length).toBe(1)
    expect(ast.items[0].signs.length).toBe(1)
    expect(ast.items[0].signs[0].code).toBe('A1')
  })
})
