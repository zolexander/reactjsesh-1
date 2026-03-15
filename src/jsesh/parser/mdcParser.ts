import { Cadrat } from '../model/Cadrat'
import { Hieroglyph, type GroupOperator } from '../model/Hieroglyph'
import { TopItemList } from '../model/TopItemList'
import { tokenizeMdC, type MdcToken, type MdcTokenType } from './mdcLexer'

function operatorFromToken(type: MdcTokenType): GroupOperator {
  if (type === 'hyphen') {
    return '-'
  }

  if (type === 'colon') {
    return ':'
  }

  if (type === 'asterisk') {
    return '*'
  }

  return null
}

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
      result.add(this.parseCadrat())
      this.consumeSeparators()
    }

    return result
  }

  private parseCadrat(): Cadrat {
    const cadrat = new Cadrat([this.parseAtom()])

    while (this.is('hyphen') || this.is('colon') || this.is('asterisk')) {
      const operator = operatorFromToken(this.advance().type)
      cadrat.setTrailingGroupOp(operator)
      cadrat.add(this.parseAtom())
    }

    return cadrat
  }

  private parseAtom(): Hieroglyph | Cadrat {
    if (this.is('glyph')) {
      return new Hieroglyph(this.advance().value)
    }

    if (this.is('lparen')) {
      this.advance()
      const grouped = this.parseCadrat()
      this.expect('rparen')
      return grouped
    }

    const token = this.peek()
    throw new Error(`Unexpected token ${token.type} at position ${token.start}.`)
  }

  private consumeSeparators(): void {
    while (this.is('separator')) {
      this.advance()
    }
  }

  private expect(type: MdcTokenType): MdcToken {
    if (!this.is(type)) {
      const token = this.peek()
      throw new Error(`Expected ${type}, got ${token.type} at position ${token.start}.`)
    }

    return this.advance()
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
  return new MdcParser(tokenizeMdC(input)).parse()
}