export type MdcTokenType =
  | 'glyph'
  | 'modifier'
  | 'colon'
  | 'asterisk'
  | 'hyphen'
  | 'lparen'
  | 'rparen'
  | 'separator'
  | 'eof'
  | 'EXCLAMATION'
  | 'LIGATURE_OP'
  | 'COMPLEX_LIG_LEFT'
  | 'COMPLEX_LIG_RIGHT'
  | 'ABS_COORD'
  | 'CARTOUCHE_OPEN'
  | 'CARTOUCHE_CLOSE'
  | 'TAG_OPEN'
  | 'TAG_CLOSE'
  | 'unknown'

export interface MdcToken {
  type: MdcTokenType
  value: string
  start: number
  end: number
}

// Matches opening tags like <hiero>, <cartouche>
const TAG_OPEN_PATTERN = /^<([a-zA-Z][a-zA-Z0-9]*)>/
// Matches closing tags like </hiero>, </cartouche>
const TAG_CLOSE_PATTERN = /^<\/([a-zA-Z][a-zA-Z0-9]*)>/

// JSesh sign-code naming convention:
//   1) Gardiner-like codes: [A-Z][a-z]{0,2}[0-9]*[A-Z]?  (A1, Aa1, V49A, X)
//   2) Lowercase MdC sign tokens used in transliteration-like inputs: [a-z]+
//      (i, w, r, a, ...)
const GLYPH_PATTERN = /^([A-Z][a-z]{0,2}[0-9]*[A-Z]?|[a-z]+)/

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
    if (char === '!') {
      tokens.push({ type: 'EXCLAMATION', value: char, start: index, end: index + 1 })
      index += 1
      continue
    }
      if (char === '&') {
      tokens.push({ type: 'LIGATURE_OP', value: char, start: index, end: index + 1 })
      index += 1
      continue
    }
    if (chunk.startsWith('^^^')) {
      tokens.push({ type: 'COMPLEX_LIG_LEFT', value: '^^^', start: index, end: index + 3 })
      index += 3
      continue
    }
    if (chunk.startsWith('***')) {
      tokens.push({ type: 'COMPLEX_LIG_RIGHT', value: '***', start: index, end: index + 3 })
      index += 3
      continue
    }
    if (char === '#') {
      tokens.push({ type: 'ABS_COORD', value: char, start: index, end: index + 1 })
      index += 1
      continue
    }
    if (char === '{' || char === '<') {
      tokens.push({ type: 'CARTOUCHE_OPEN', value: char, start: index, end: index + 1 })
      index += 1
      continue
    }
    if (char === '}' || char === '>') {
      tokens.push({ type: 'CARTOUCHE_CLOSE', value: char, start: index, end: index + 1 })
      index += 1
      continue
    }
 

    if (char === '<') {
      const closeMatch = chunk.match(TAG_CLOSE_PATTERN)
      if (closeMatch) {
        tokens.push({
          type: 'TAG_CLOSE',
          value: closeMatch[0],
          start: index,
          end: index + closeMatch[0].length,
        })
        index += closeMatch[0].length
        continue
      }

      const openMatch = chunk.match(TAG_OPEN_PATTERN)
      if (openMatch) {
        tokens.push({
          type: 'TAG_OPEN',
          value: openMatch[0],
          start: index,
          end: index + openMatch[0].length,
        })
        index += openMatch[0].length
        continue
      }

      throw new Error(`Unexpected "<" at position ${index}: not a valid tag.`)
    }

    if (char === '\\') {
      const next = input[index + 1]
      if (next === undefined) {
        throw new Error(`Unexpected end of input after "\\" at position ${index}.`)
      }

      if (!/[0-9a-zA-Z]/.test(next)) {
        throw new Error(`Invalid modifier character "${next}" at position ${index + 1}.`)
      }

      tokens.push({
        type: 'modifier',
        value: `\\${next}`,
        start: index,
        end: index + 2,
      })
      index += 2
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

    // Unknown character – error-tolerant: emit unknown token and continue
    tokens.push({ type: 'unknown', value: char, start: index, end: index + 1 })
    index += 1
  }

  tokens.push({ type: 'eof', value: '', start: index, end: index })
  return tokens
}