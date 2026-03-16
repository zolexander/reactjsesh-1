import { Cadrat } from '../model/Cadrat'
import { Hieroglyph, type GroupOperator } from '../model/Hieroglyph'
import { TopItemList } from '../model/TopItemList'
import { tokenizeMdC, type MdcToken, type MdcTokenType } from './mdcLexer'

// ---------------------------------------------------------------------------
// Absolute-position syntax:  {{x,y,scale}}  or  **G5{{194,0,97}}
// ---------------------------------------------------------------------------
const ABS_COORD_PATTERN = /^\{\{(-?\d+),(-?\d+),(\d+)\}\}/

// ---------------------------------------------------------------------------
// Parser
//
// Grammar (Rosmorduc's JSesh PDF):
//
//   topItemList  → (separator* cadrat)* separator* eof
//   cadrat       → hbox (separator hbox)*
//   hbox         → vbox ('-' vbox)*
//   vbox         → hgroup (':' hgroup)*
//   hgroup       → sign ('*' sign)*
//   sign         → atom absCoord? modifier*
//   atom         → glyph | '(' cadrat ')'
//
// groupOp is stored on the *following* sign (the sign that carries the
// operator that connects it to its left neighbour), NOT on the preceding one.
// ---------------------------------------------------------------------------
export class MdcParser {
  private readonly tokens: MdcToken[]
  private readonly source: string
  private index = 0

  constructor(tokens: MdcToken[], source = '') {
    this.tokens = tokens
    this.source = source
  }

  // -------------------------------------------------------------------------
  // Entry point
  // -------------------------------------------------------------------------
  parse(): TopItemList {
    const result = new TopItemList()

    this.consumeSeparators()
    while (!this.is('eof')) {
      result.add(this.parseCadrat())
      while (this.is('hyphen')) {
        // In this project parser profile, '-' separates cadrats at top level.
        this.advance()
        result.add(this.parseCadrat())
      }
      this.consumeSeparators()
    }

    return result
  }

  // -------------------------------------------------------------------------
  // cadrat  →  hbox (separator hbox)*
  // A cadrat holds one or more hboxes separated by line/word boundaries.
  // For simplicity we use the Cadrat container for both levels.
  // -------------------------------------------------------------------------
  private parseCadrat(): Cadrat {
    const cadrat = new Cadrat()
    this.parseVbox(cadrat, null)
    return cadrat
  }

  // -------------------------------------------------------------------------
  // vbox  →  hgroup (':' hgroup)*
  // Signs joined by ':' are stacked (vertical).
  // -------------------------------------------------------------------------
  private parseVbox(cadrat: Cadrat, incomingOp: GroupOperator): void {
    this.parseHgroup(cadrat, incomingOp)

    while (this.is('colon')) {
      this.advance() // consume ':'
      this.parseHgroup(cadrat, ':')
    }
  }

  // -------------------------------------------------------------------------
  // hgroup  →  sign ('*' sign)*
  // Signs joined by '*' are overlaid.
  // -------------------------------------------------------------------------
  private parseHgroup(cadrat: Cadrat, incomingOp: GroupOperator): void {
    const first = this.parseSign(incomingOp)
    cadrat.add(first)

    while (this.is('asterisk')) {
      this.advance() // consume '*'
      cadrat.add(this.parseSign('*'))
    }
  }

  // -------------------------------------------------------------------------
  // sign  →  atom  absCoord?  modifier*
  // groupOp is attached to THIS sign (the sign following the operator).
  // -------------------------------------------------------------------------
  private parseSign(groupOp: GroupOperator): Hieroglyph | Cadrat {
    const item = this.parseAtom()

    // Consume optional absolute-coordinate annotation {{x,y,scale}}
    if (item instanceof Hieroglyph) {
      this.maybeParseAbsCoord(item)
      this.parseModifiers(item)
      item.groupOp = groupOp
    } else {
      // nested cadrat — propagate groupOp so add() can transfer it to the
      // first inlined sign
      item._groupOp = groupOp
    }

    return item
  }

  // -------------------------------------------------------------------------
  // atom  →  glyph | '(' cadrat ')'
  // -------------------------------------------------------------------------
  private parseAtom(): Hieroglyph | Cadrat {
    if (this.is('glyph')) {
      return new Hieroglyph(this.advance().value)
    }

    if (this.is('lparen')) {
      this.advance() // consume '('
      const inner = this.parseCadrat()
      if (!this.is('rparen')) {
        this.recoverUntil('rparen')
      } else {
        this.advance() // consume ')'
      }

      return inner
    }

    // TAG_OPEN / TAG_CLOSE: skip silently (treated as structural markers)
    if (this.is('TAG_OPEN') || this.is('TAG_CLOSE')) {
      this.advance()
      return new Hieroglyph('A1') // placeholder; caller discards tag-only cadrats
    }

    // Unknown / unrecognised token – error-tolerant: emit UNKNOWN glyph
    const token = this.peek()
    this.advance()
    return new Hieroglyph(`UNKNOWN@${token.start}`)
  }

  // -------------------------------------------------------------------------
  // Absolute coordinates:  {{x,y,scale}}
  // Tries to match the 7-character {{ … }} suffix directly from source.
  // -------------------------------------------------------------------------
  private maybeParseAbsCoord(glyph: Hieroglyph): void {
    // The lexer emitted an ABS_COORD token for '#', but the multi-char
    // {{…}} form is matched here from source.
    if (this.source && this.is('CARTOUCHE_OPEN')) {
      const pos = this.peek().start
      const slice = this.source.slice(pos)
      const m = slice.match(ABS_COORD_PATTERN)
      if (m) {
        glyph.setExplicitPosition(Number(m[1]), Number(m[2]), Number(m[3]))
        // Advance past all tokens that make up {{x,y,scale}}
        const end = pos + m[0].length
        while (this.index < this.tokens.length && this.peek().end <= end) {
          this.advance()
        }

        return
      }
    }
  }

  // -------------------------------------------------------------------------
  // Modifiers:  \s \r \4 …  (one or more after the glyph)
  // -------------------------------------------------------------------------
  private parseModifiers(glyph: Hieroglyph): void {
    while (this.is('modifier')) {
      const tok = this.advance()
      const key = tok.value.slice(1) // strip leading '\'
      switch (key) {
        case 'r':
          glyph.setReversed(true)
          break
        case 's':
          glyph.setWide(true)
          break
        default: {
          const n = Number(key)
          if (!Number.isNaN(n)) {
            glyph.setAngle(n * 90) // \1 = 90°, \2 = 180°, etc.
          }

          break
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Error recovery: skip tokens until we find the expected type or eof.
  // -------------------------------------------------------------------------
  private recoverUntil(type: MdcTokenType): void {
    while (!this.is(type) && !this.is('eof')) {
      this.advance()
    }

    if (this.is(type)) {
      this.advance()
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  private consumeSeparators(): void {
    while (this.is('separator') || this.is('TAG_OPEN') || this.is('TAG_CLOSE')) {
      this.advance()
    }
  }

  private is(type: MdcTokenType): boolean {
    return this.peek().type === type
  }

  private peek(): MdcToken {
    return this.tokens[this.index]
  }

  private advance(): MdcToken {
    const token = this.tokens[this.index]
    this.index += 1
    return token
  }
}

export function parseMdC(input: string): TopItemList {
  return new MdcParser(tokenizeMdC(input), input).parse()
}
