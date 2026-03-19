// src/jsesh/parser/mdcLexer.ts
// FIXES für JSesh .gly-Dateien:
//   +l...+s    → Label-Text überspringen
//   |1;1       → Zeilen-Referenz überspringen
//   #b #e #12  → JSesh-Farbcodes überspringen
//   "sic":     → Text-Annotation überspringen, Colon auch
//   \98        → Multi-Digit-Modifier (Rotation in Grad)
//   [[ ]] \70  → Philologische Klammern überspringen
//   [ ] allein → Unbekannte Zeichen fehlertolerant überspringen

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
  | 'ABS_SEP'
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

const TAG_OPEN_PATTERN  = /^<([a-zA-Z][a-zA-Z0-9]*)>/
const TAG_CLOSE_PATTERN = /^<\/([a-zA-Z][a-zA-Z0-9]*)>/

// Glyph: Gardiner-Code oder lowercase MdC-Code oder reine Zahl
const GLYPH_PATTERN = /^([A-Z][a-z]{0,2}[0-9]*[A-Z]?|[a-z][a-z0-9]*|[0-9]+)/

export function tokenizeMdC(input: string): MdcToken[] {
  const tokens: MdcToken[] = []
  let index = 0

  while (index < input.length) {
    const chunk = input.slice(index)
    const char  = input[index]

    // ── Whitespace ────────────────────────────────────────────────────────
    if (char === ' ' || char === '\t' || char === '\r') {
      index += 1
      continue
    }

    if (char === '\n') {
      tokens.push({ type: 'separator', value: char, start: index, end: index + 1 })
      index += 1
      continue
    }

    // ── JSesh-Label: +l text +s ───────────────────────────────────────────
    // Alles zwischen +l und +s ist beschreibender Text (kein MdC).
    // Beispiel: "+lIntroduction, Sommaire+s"
    if (char === '+') {
      const next = input[index + 1] ?? ''
      if (next === 'l') {
        // Suche das schließende +s
        const endIdx = input.indexOf('+s', index + 2)
        index = endIdx !== -1 ? endIdx + 2 : input.length
        continue
      }
      if (next === 's') {
        // +s ohne vorheriges +l → einfach überspringen
        index += 2
        continue
      }
      // Anderes + → als unknown überspringen
      tokens.push({ type: 'unknown', value: char, start: index, end: index + 1 })
      index += 1
      continue
    }

    // ── Zeilen-Referenz: |1;1 oder |1.2 ─────────────────────────────────
    // JSesh-Zeilenreferenzen: |Zeile;Spalte → komplett überspringen
    if (char === '|') {
      index += 1
      while (index < input.length && /[0-9;.,]/.test(input[index])) index++
      continue
    }

    // ── JSesh-Farbcodes: #b #e #4 #12 #24 #34 ───────────────────────────
    // #b = begin (fett/hervorheben), #e = end, #N = spezifische Farbe
    // Alle werden übersprungen.
    if (char === '#') {
      index += 1
      while (index < input.length && /[0-9a-zA-Z]/.test(input[index])) index++
      continue
    }

    // ── Text-Annotation: "sic":SIGN ─────────────────────────────────────
    // Quoted text vor einem Zeichen: "text":G7 → "text": überspringen, G7 behalten
    if (char === '"') {
      index += 1
      while (index < input.length && input[index] !== '"') index++
      if (index < input.length) index++ // schließendes "
      if (index < input.length && input[index] === ':') index++ // folgendes :
      continue
    }

    // ── Philologische Klammern: [[ ]] mit optionaler \NUMMER ─────────────
    // [[\70 = Beginn Tilgung (Nest-Level 70)
    // ]]\70 = Ende Tilgung
    // Werden für jetzt übersprungen (keine SVG-Darstellung implementiert)
    if (chunk.startsWith('[[') || chunk.startsWith(']]')) {
      index += 2
      // Optionale Nest-Nummer: \70
      if (index < input.length && input[index] === '\\') {
        index += 1
        while (index < input.length && /[0-9]/.test(input[index])) index++
      }
      continue
    }

    // ── Multi-char Tokens VOR single-char (Reihenfolge wichtig!) ─────────
    if (chunk.startsWith('^^^')) {
      tokens.push({ type: 'COMPLEX_LIG_LEFT', value: '^^^', start: index, end: index + 3 })
      index += 3
      continue
    }

    if (chunk.startsWith('&&&')) {
      tokens.push({ type: 'COMPLEX_LIG_RIGHT', value: '&&&', start: index, end: index + 3 })
      index += 3
      continue
    }

    if (chunk.startsWith('**')) {
      tokens.push({ type: 'ABS_COORD', value: '**', start: index, end: index + 2 })
      index += 2
      continue
    }

    // Absolute Koordinaten {{x,y,s}}
    if (chunk.startsWith('{{')) {
      const endIdx = chunk.indexOf('}}')
      if (endIdx !== -1) {
        const value = chunk.slice(0, endIdx + 2)
        tokens.push({ type: 'ABS_COORD', value, start: index, end: index + value.length })
        index += value.length
        continue
      }
    }

    // ── Single-char Operatoren ────────────────────────────────────────────
    // ── Spezielle MdC-Tokens: . .. // / v/ h/ ─────────────────────────────
    // '..'  = FULLSPACE  → als Glyph '..' emittieren
    // '.'   = HALFSPACE  → als Glyph '.' emittieren
    // '//'  = FULLSHADE
    // 'v/'  = VERTICALSHADE
    // 'h/'  = HORIZONTALSHADE
    // '/'   = QUATERSHADE
    if (chunk.startsWith('..')) {
      tokens.push({ type: 'glyph', value: '..', start: index, end: index + 2 })
      index += 2; continue
    }
    if (char === '.') {
      tokens.push({ type: 'glyph', value: '.', start: index, end: index + 1 })
      index += 1; continue
    }
    if (chunk.startsWith('//')) {
      tokens.push({ type: 'glyph', value: '//', start: index, end: index + 2 })
      index += 2; continue
    }
    if (chunk.startsWith('v/')) {
      tokens.push({ type: 'glyph', value: 'v/', start: index, end: index + 2 })
      index += 2; continue
    }
    if (chunk.startsWith('h/')) {
      tokens.push({ type: 'glyph', value: 'h/', start: index, end: index + 2 })
      index += 2; continue
    }
    if (char === '/') {
      tokens.push({ type: 'glyph', value: '/', start: index, end: index + 1 })
      index += 1; continue
    }

    if (char === ':') {
      tokens.push({ type: 'colon',   value: char, start: index, end: index + 1 })
      index += 1; continue
    }
    if (char === '*') {
      tokens.push({ type: 'asterisk', value: char, start: index, end: index + 1 })
      index += 1; continue
    }
    if (char === '-') {
      tokens.push({ type: 'hyphen',  value: char, start: index, end: index + 1 })
      index += 1; continue
    }
    if (char === '(') {
      tokens.push({ type: 'lparen',  value: char, start: index, end: index + 1 })
      index += 1; continue
    }
    if (char === ')') {
      tokens.push({ type: 'rparen',  value: char, start: index, end: index + 1 })
      index += 1; continue
    }
    if (char === '&') {
      tokens.push({ type: 'LIGATURE_OP', value: char, start: index, end: index + 1 })
      index += 1; continue
    }
    if (char === '!') {
      tokens.push({ type: 'EXCLAMATION', value: char, start: index, end: index + 1 })
      index += 1; continue
    }

    // ── < und > ───────────────────────────────────────────────────────────
    if (char === '<') {
      const closeMatch = chunk.match(TAG_CLOSE_PATTERN)
      if (closeMatch) {
        tokens.push({ type: 'TAG_CLOSE', value: closeMatch[0], start: index, end: index + closeMatch[0].length })
        index += closeMatch[0].length; continue
      }
      const openMatch = chunk.match(TAG_OPEN_PATTERN)
      if (openMatch) {
        tokens.push({ type: 'TAG_OPEN', value: openMatch[0], start: index, end: index + openMatch[0].length })
        index += openMatch[0].length; continue
      }
      tokens.push({ type: 'CARTOUCHE_OPEN', value: char, start: index, end: index + 1 })
      index += 1; continue
    }
    if (char === '>') {
      tokens.push({ type: 'CARTOUCHE_CLOSE', value: char, start: index, end: index + 1 })
      index += 1; continue
    }
    if (char === '{') {
      tokens.push({ type: 'CARTOUCHE_OPEN', value: char, start: index, end: index + 1 })
      index += 1; continue
    }
    if (char === '}') {
      tokens.push({ type: 'CARTOUCHE_CLOSE', value: char, start: index, end: index + 1 })
      index += 1; continue
    }

    // ── Modifier: \s \r \98 \360 ─────────────────────────────────────────
    // FIX: Multi-Digit-Modifier unterstützt.
    // \1 \2 \3  → alte Syntax: × 90° (1=90°, 2=180°, 3=270°)
    // \98 \360  → neue Syntax: direkte Grad-Angabe
    // \s \r     → Spiegelung
    if (char === '\\') {
      const next = input[index + 1]

      if (next === undefined) {
        index += 1
        continue
      }

      if (/[0-9a-zA-Z]/.test(next)) {
        // Alle folgenden alphanumerischen Zeichen als Modifier lesen
        let modStr = ''
        let j = index + 1
        while (j < input.length && /[0-9a-zA-Z]/.test(input[j])) {
          modStr += input[j]
          j++
        }
        const start = index
        index = j
        tokens.push({ type: 'modifier', value: `\\${modStr}`, start, end: index })
        continue
      }

      // Unbekanntes Zeichen nach '\' → '\' überspringen
      index += 1
      continue
    }

    // ── $ (Farbwechsel) ─────────────────────────────────────────────────────
    // glyParser.ts wertet $r/$b VOR Tokenisierung aus (splitByColorMarkers).
    // Im Token-Strom ist $ immer ein Überrest → überspringen.
    if (char === "$") {
      index += 1
      continue
    }

    // ── Glyph ─────────────────────────────────────────────────────────────
    const glyphMatch = chunk.match(GLYPH_PATTERN)
    if (glyphMatch) {
      const value = glyphMatch[0]
      tokens.push({ type: 'glyph', value, start: index, end: index + value.length })
      index += value.length
      continue
    }

    // ── Unbekannt — fehlertolerant ────────────────────────────────────────
    tokens.push({ type: 'unknown', value: char, start: index, end: index + 1 })
    index += 1
  }

  tokens.push({ type: 'eof', value: '', start: index, end: index })
  return tokens
}
