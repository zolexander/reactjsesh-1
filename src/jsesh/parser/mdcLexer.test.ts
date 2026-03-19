import { describe, expect, it } from 'vitest'
import { tokenizeMdC } from './mdcLexer'

function valuesOfType(input: string, type: string): string[] {
  return tokenizeMdC(input)
    .filter((t) => t.type === type)
    .map((t) => t.value)
}

describe('mdcLexer (gly/jsesh compatibility)', () => {
  it('ignoriert +l...+s Label-Text komplett', () => {
    const glyphs = valuesOfType('A1 +lTitel+s B1', 'glyph')
    expect(glyphs).toEqual(['A1', 'B1'])
  })

  it('ignoriert Zeilenreferenz und Farbcodes', () => {
    const glyphs = valuesOfType('A1 |1;2 #b B1 #12 C1', 'glyph')
    expect(glyphs).toEqual(['A1', 'B1', 'C1'])
  })

  it('ignoriert quoted annotations wie "sic":', () => {
    const glyphs = valuesOfType('"sic":G7-A1', 'glyph')
    expect(glyphs).toEqual(['G7', 'A1'])
  })

  it('tokenisiert mehrstellige Modifier als ein Modifier-Token', () => {
    const modifier = valuesOfType('A1\\98\\360', 'modifier')
    expect(modifier).toEqual(['\\98', '\\360'])
  })

  it('überspringt philologische Klammern [[ ]] inkl. optionaler Nestnummer', () => {
    const glyphs = valuesOfType('[[\\70A1]]\\70-B1', 'glyph')
    expect(glyphs).toEqual(['A1', 'B1'])
  })
})
