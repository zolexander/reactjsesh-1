// src/jsesh/parser/mdcParser.ts
// FIXES:
//  1. parseHgroup: behandelt jetzt auch '&' (LIGATURE_OP) als Gruppenoperator
//  2. maybeParseAbsCoord: prüft jetzt auf ABS_COORD token (statt CARTOUCHE_OPEN)
//  3. parse/parseCartouche: ABS_SEP (**) wird wie HYP (Kadrat-Trenner) behandelt
//  4. parseAtom: überspringt HYP und ABS_SEP statt UNKNOWN zu erzeugen

import { Cadrat } from '../model/Cadrat'
import { Hieroglyph, type GroupOperator } from '../model/Hieroglyph'
import { TopItemList } from '../model/TopItemList'
import { CartoucheGroup } from '../model/CartoucheGroup'
import { tokenizeMdC, type MdcToken, type MdcTokenType } from './mdcLexer'

export class MdcParser {
  private readonly tokens: MdcToken[]
  private index = 0

  constructor(tokens: MdcToken[]) {
    this.tokens = tokens
  }

  parse(): TopItemList {
    const result = new TopItemList()
    this.consumeSeparators()

    while (!this.is('eof')) {
      if (this.is('CARTOUCHE_OPEN')) {
        const cartouche = this.parseCartouche()
        if (cartouche) result.add(cartouche)
        this.consumeSeparators()
        continue
      }

      result.add(this.parseCadrat())

      // FIX: ABS_SEP (**) = Trenner zwischen absolut-positionierten Kadraten
      while (this.is('hyphen') || this.is('ABS_SEP')) {
        this.advance()
        if (this.is('CARTOUCHE_OPEN')) {
          const cartouche = this.parseCartouche()
          if (cartouche) result.add(cartouche)
        } else if (!this.is('eof')) {
          result.add(this.parseCadrat())
        }
      }

      this.consumeSeparators()
    }

    return result
  }

  private parseCartouche(): CartoucheGroup | null {
    if (!this.is('CARTOUCHE_OPEN')) return null
    this.advance()

    const innerCadrats: Cadrat[] = []

    while (!this.is('CARTOUCHE_CLOSE') && !this.is('eof')) {
      if (this.is('TAG_OPEN') || this.is('TAG_CLOSE') || this.is('separator') || this.is('EXCLAMATION')) {
        this.advance(); continue
      }
      innerCadrats.push(this.parseCadrat())
      while (this.is('hyphen') || this.is('ABS_SEP')) {
        this.advance()
        if (!this.is('CARTOUCHE_CLOSE') && !this.is('eof'))
          innerCadrats.push(this.parseCadrat())
      }
    }

    if (this.is('CARTOUCHE_CLOSE')) this.advance()
    return new CartoucheGroup(innerCadrats, 'cartouche')
  }

  private parseCadrat(): Cadrat {
    const cadrat = new Cadrat()
    this.parseVbox(cadrat, null)
    return cadrat
  }

  private parseVbox(cadrat: Cadrat, incomingOp: GroupOperator): void {
    this.parseHgroup(cadrat, incomingOp)
    while (this.is('colon')) {
      this.advance()
      this.parseHgroup(cadrat, ':')
    }
  }

  private parseHgroup(cadrat: Cadrat, incomingOp: GroupOperator): void {
    cadrat.add(this.parseSign(incomingOp))
    // FIX: auch LIGATURE_OP ('&') als Gruppenoperator behandeln (wie '*')
    while (this.is('asterisk') || this.is('LIGATURE_OP')) {
      const op: GroupOperator = this.is('LIGATURE_OP') ? '&' : '*'
      this.advance()
      cadrat.add(this.parseSign(op))
    }
  }

  private parseSign(groupOp: GroupOperator): Hieroglyph | Cadrat {
    const item = this.parseAtom()
    if (item instanceof Hieroglyph) {
      this.maybeParseAbsCoord(item)
      this.parseModifiers(item)
      item.groupOp = groupOp
    } else {
      item._groupOp = groupOp
    }
    return item
  }

  private parseAtom(): Hieroglyph | Cadrat {
    if (this.is('glyph')) return new Hieroglyph(this.advance().value)

    if (this.is('lparen')) {
      this.advance()
      const inner = this.parseCadrat()
      if (!this.is('rparen')) this.recoverUntil('rparen')
      else this.advance()
      return inner
    }

    if (this.is('TAG_OPEN') || this.is('TAG_CLOSE')) {
      this.advance()
      return new Hieroglyph('A1')
    }

    if (this.is('CARTOUCHE_OPEN')) {
      this.advance()
      while (!this.is('CARTOUCHE_CLOSE') && !this.is('eof')) this.advance()
      if (this.is('CARTOUCHE_CLOSE')) this.advance()
      return new Hieroglyph('X')
    }

    // FIX: HYP und ABS_SEP an falscher Stelle → überspringen statt UNKNOWN
    if (this.is('hyphen') || this.is('ABS_SEP')) {
      this.advance()
      if (this.is('eof')) return new Hieroglyph('UNKNOWN@eof')
      return this.parseAtom()
    }

    // FIX: ABS_COORD an falscher Stelle (ohne vorhergehenden Glyph) → überspringen
    if (this.is('ABS_COORD')) {
      this.advance()
      if (this.is('eof')) return new Hieroglyph('UNKNOWN@eof')
      return this.parseAtom()
    }

    if (this.is('eof')) return new Hieroglyph('UNKNOWN@eof')

    const token = this.peek()
    this.advance()
    return new Hieroglyph(`UNKNOWN@${token.start}`)
  }

  /**
   * FIX: prüft jetzt auf ABS_COORD-Token (statt CARTOUCHE_OPEN).
   * Lexer emittiert {{x,y,s}} als ABS_COORD.
   * Setzt explizite Position/Skalierung auf dem Glyph.
   */
  private maybeParseAbsCoord(glyph: Hieroglyph): void {
    if (this.is('ABS_COORD')) {
      const tok = this.advance()
      // Parse {{x,y,scale}} aus dem Token-Wert
      const m = tok.value.match(/^\{\{(-?\d+),(-?\d+),(\d+)\}\}$/)
      if (m) {
        glyph.setExplicitPosition(Number(m[1]), Number(m[2]), Number(m[3]))
      }
    }
  }

  private parseModifiers(glyph: Hieroglyph): void {
    while (this.is('modifier')) {
      const tok = this.advance()
      const key = tok.value.slice(1)
      switch (key) {
        case 'r': glyph.setReversed(true); break
        case 's': glyph.setWide(true); break
        case 'm': break
        default: {
          const n = Number(key)
          if (!Number.isNaN(n)) {
            glyph.setAngle(key.length === 1 ? n * 90 : n)
          }
          break
        }
      }
    }
  }

  private recoverUntil(type: MdcTokenType): void {
    while (!this.is(type) && !this.is('eof')) this.advance()
    if (this.is(type)) this.advance()
  }

  private consumeSeparators(): void {
    while (
      this.is('separator') ||
      this.is('TAG_OPEN') ||
      this.is('TAG_CLOSE') ||
      this.is('EXCLAMATION') ||
      this.is('hyphen')
    ) this.advance()
  }

  private is(type: MdcTokenType): boolean { return this.peek().type === type }

  private peek(): MdcToken {
    return this.tokens[this.index] ?? this.tokens[this.tokens.length - 1]
  }

  private advance(): MdcToken {
    const token = this.peek()
    if (this.index < this.tokens.length - 1) this.index += 1
    return token
  }
}

export function parseMdC(input: string): TopItemList {
  return new MdcParser(tokenizeMdC(input)).parse()
}
