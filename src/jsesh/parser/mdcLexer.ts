export type MdcTokenType =
  | 'glyph'
  | 'colon'
  | 'asterisk'
  | 'hyphen'
  | 'lparen'
  | 'rparen'
  | 'separator'
  | 'eof'

export interface MdcToken {
  type: MdcTokenType
  value: string
  start: number
  end: number
}

const GLYPH_PATTERN = /^[A-Za-z][A-Za-z0-9]*/

export function tokenizeMdC(input: string): MdcToken[] {
  const tokens: MdcToken[] = []
  let index = 0

  while (index < input.length) {
    const chunk = input.slice(index)
    const char = input[index]

    if (char === ' ' || char === '\t' || char === '\r') {
      index += 1
      continue
    }

    if (char === '\n' || char === '!') {
      tokens.push({
        type: 'separator',
        value: char,
        start: index,
        end: index + 1,
      })
      index += 1
      continue
    }

    if (char === ':') {
      tokens.push({ type: 'colon', value: char, start: index, end: index + 1 })
      index += 1
      continue
    }

    if (char === '*') {
      tokens.push({
        type: 'asterisk',
        value: char,
        start: index,
        end: index + 1,
      })
      index += 1
      continue
    }

    if (char === '-') {
      tokens.push({ type: 'hyphen', value: char, start: index, end: index + 1 })
      index += 1
      continue
    }

    if (char === '(') {
      tokens.push({ type: 'lparen', value: char, start: index, end: index + 1 })
      index += 1
      continue
    }

    if (char === ')') {
      tokens.push({ type: 'rparen', value: char, start: index, end: index + 1 })
      index += 1
      continue
    }

    const glyphMatch = chunk.match(GLYPH_PATTERN)
    if (glyphMatch) {
      const value = glyphMatch[0]
      tokens.push({
        type: 'glyph',
        value,
        start: index,
        end: index + value.length,
      })
      index += value.length
      continue
    }

    throw new Error(`Unexpected character "${char}" at position ${index}.`)
  }

  tokens.push({ type: 'eof', value: '', start: index, end: index })
  return tokens
}