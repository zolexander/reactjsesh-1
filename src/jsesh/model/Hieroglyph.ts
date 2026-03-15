import { SymbolCodes, type SymbolCode } from '../constants/SymbolCodes'
import { LexicalSymbolsUtils } from '../constants/LexicalSymbolsUtils'

export type GroupOperator = '-' | ':' | '*' | null

abstract class EnumBase {
  readonly id: number
  readonly designation: string

  constructor(id: number, designation: string) {
    this.id = id
    this.designation = designation
  }

  getDesignation(): string {
    return this.designation
  }

  getId(): number {
    return this.id
  }

  equals(other: EnumBase): boolean {
    return this.id === other.id
  }

  toString(): string {
    return this.designation
  }
}

export class WordEndingCode extends EnumBase {
  static readonly NONE = new WordEndingCode(0, 'NONE')
  static readonly WORD_END = new WordEndingCode(1, 'WORD_END')
  static readonly SENTENCE_END = new WordEndingCode(2, 'SENTENCE_END')

  private constructor(id: number, designation: string) {
    super(id, designation)
  }
}



function normalizeCode(code: string): string {
  if (code.startsWith('J')) {
    return `Aa${code.slice(1)}`
  }

  if (code === 'Ff2') {
    return 'V49A'
  }

  return code
}

function compareNumbers(left: number, right: number): number {
  return left - right
}

export class Hieroglyph {
  code: string
  groupOp: GroupOperator
  scale = 100
  angle = 0
  reserved = false
  endingCode: WordEndingCode = WordEndingCode.NONE

  grammar = false
  type: SymbolCode = SymbolCodes.MDCCODE
  x = 0
  y = 0
  reversed = false
  wide = false

  constructor(codeOrType: string | SymbolCode = 'A1', groupOp: GroupOperator = null) {
    this.code = 'A1'
    this.groupOp = groupOp

    if (typeof codeOrType === 'string') {
      this.setCode(codeOrType)
      return
    }

    if (codeOrType === SymbolCodes.MDCCODE) {
      this.setCode('A1')
      return
    }

    this.type = codeOrType
    this.code = LexicalSymbolsUtils.getCodeForLexicalItem(codeOrType) ?? `symbol-${codeOrType}`
  }

  clone(): Hieroglyph {
    return this.deepCopy()
  }

  compareTo(other: Hieroglyph): number {
    const result = this.code.localeCompare(other.code)
    if (result !== 0) {
      return result
    }

    return (
      compareNumbers(this.type, other.type) ||
      compareNumbers(this.x, other.x) ||
      compareNumbers(this.y, other.y) ||
      compareNumbers(this.endingCode.getId(), other.endingCode.getId()) ||
      compareNumbers(Number(this.grammar), Number(other.grammar)) ||
      compareNumbers(this.scale, other.scale) ||
      compareNumbers(this.angle, other.angle) ||
      compareNumbers(Number(this.reversed), Number(other.reversed)) ||
      compareNumbers(Number(this.wide), Number(other.wide))
    )
  }

  deepCopy(): Hieroglyph {
    const result = new Hieroglyph(this.code, this.groupOp)
    result.scale = this.scale
    result.angle = this.angle
    result.reserved = this.reserved
    result.endingCode = this.endingCode
    result.grammar = this.grammar
    result.type = this.type
    result.x = this.x
    result.y = this.y
    result.reversed = this.reversed
    result.wide = this.wide
    return result
  }

  getAngle(): number {
    return this.angle
  }

  getCode(): string {
    return this.code
  }

  getEndingCode(): WordEndingCode {
    return this.endingCode
  }

  getRelativeSize(): number {
    return this.scale
  }

  getType(): SymbolCode {
    return this.type
  }

  getX(): number {
    return this.x
  }

  getY(): number {
    return this.y
  }

  isGrammar(): boolean {
    return this.grammar
  }

  isReversed(): boolean {
    return this.reversed
  }

  isWide(): boolean {
    return this.wide
  }

  setAngle(angle: number): void {
    this.angle = angle
  }

  setCode(code: string): void {
    const normalizedCode = normalizeCode(code)
    this.code = normalizedCode
    const found = LexicalSymbolsUtils.getCodeForString(normalizedCode)
    this.type = found !== -1 ? (found as SymbolCode) : SymbolCodes.MDCCODE
  }

  setEndingCode(endingCode: WordEndingCode): void {
    this.endingCode = endingCode
  }

  setExplicitPosition(x: number, y: number, scale: number): void {
    this.x = x
    this.y = y
    this.scale = scale
  }

  setGrammar(grammar: boolean): void {
    this.grammar = grammar
  }

  setRelativeSize(relativeSize: number): void {
    this.scale = relativeSize
  }

  getFLoatScale(): number {
    return this.getRelativeSize() / 100
  }

  setReversed(reversed: boolean): void {
    this.reversed = reversed
  }

  setType(type: SymbolCode): void {
    this.type = type
  }

  setWide(wide: boolean): void {
    this.wide = wide
  }

  containsOnlyOneSign(): boolean {
    return true
  }

  getLoneSign(): Hieroglyph {
    return this
  }

  getSmallText(): string {
    if (this.type !== SymbolCodes.SMALLTEXT) {
      throw new Error('Incorrect call')
    }

    const start = this.code.indexOf('"')
    if (start === -1 || this.code.at(-1) !== '"') {
      return this.code
    }

    return this.code.slice(start + 1, -1)
  }

  isShadingSign(): boolean {
    switch (this.type) {
      case SymbolCodes.HORIZONTALSHADE:
      case SymbolCodes.VERTICALSHADE:
      case SymbolCodes.FULLSHADE:
      case SymbolCodes.QUATERSHADE:
        return true
      default:
        return false
    }
  }

  equals(other: Hieroglyph): boolean {
    return (
      normalizeCode(this.code) === normalizeCode(other.code) &&
      this.endingCode.equals(other.endingCode) &&
      this.grammar === other.grammar &&
      this.type === other.type &&
      this.x === other.x &&
      this.y === other.y &&
      this.scale === other.scale &&
      this.angle === other.angle &&
      this.reversed === other.reversed &&
      this.wide === other.wide
    )
  }

  toString(): string {
    let result = `(glyph ${this.code}`
    if (this.getRelativeSize() !== 100 || this.getX() !== 0 || this.getY() !== 0) {
      result += ` [${this.getX()},${this.getY()}, ${this.getRelativeSize()}%]`
    }
    result += ')'
    return result
  }
}