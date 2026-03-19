import { describe, expect, it } from 'vitest'
import { parseGlyFile } from './glyParser'
import { Cadrat } from '../model/Cadrat'
import { CartoucheGroup } from '../model/CartoucheGroup'

describe('glyParser', () => {
  it('parst Legacy-Metadaten und Inhalt', () => {
    const content = [
      '++jsesh_page_direction: right to left +s',
      '++title: Demo +s',
      'A1-B1',
    ].join('\n')

    const doc = parseGlyFile(content)
    expect(doc.metadata.direction).toBe('rtl')
    expect(doc.metadata.title).toBe('Demo')
    expect(doc.content.items.length).toBe(2)
  })

  it('wendet Farbsegmente korrekt an ($r / $b)', () => {
    const doc = parseGlyFile('A1-$r-G7-$b-B1')

    expect(doc.content.items.length).toBe(3)
    const [a, g, b] = doc.content.items as Cadrat[]
    expect(a.signs[0].color).toBe('black')
    expect(g.signs[0].color).toBe('red')
    expect(b.signs[0].color).toBe('black')
  })

  it('setzt breakAfter bei Zeilenumbruch ! auf das letzte Item', () => {
    const doc = parseGlyFile('A1!B1')
    expect(doc.content.items.length).toBe(2)
    expect((doc.content.items[0] as Cadrat).breakAfter).toBe('!')
    expect((doc.content.items[1] as Cadrat).breakAfter).toBeUndefined()
  })

  it('parst XML-Wörter und Cartouche-Struktur', () => {
    const xml = `
      <JSesh direction="right to left">
        <textContent>
          <line>
            <word><sign code="A1"/></word>
            <word type="cartouche">
              <word><sign code="B1"/></word>
              <word><sign code="C1"/></word>
            </word>
          </line>
        </textContent>
      </JSesh>
    `

    const doc = parseGlyFile(xml)
    expect(doc.metadata.direction).toBe('rtl')
    expect(doc.content.items.length).toBe(2)
    expect(doc.content.items[0]).toBeInstanceOf(Cadrat)
    expect(doc.content.items[1]).toBeInstanceOf(CartoucheGroup)

    const cartouche = doc.content.items[1] as CartoucheGroup
    expect(cartouche.items.length).toBe(2)
    expect(cartouche.items[0].signs[0].code).toBe('B1')
    expect(cartouche.items[1].signs[0].code).toBe('C1')
  })
})
