import { SymbolCodes, type SymbolCode } from './SymbolCodes'

/**
 * Classifies a MdC glyph code into its kind.
 *
 * - `'gardiner'`     — standard or extended Gardiner sign with a numeric index
 *                      e.g. A1, G17, V49A, Aa1, NL5, NU22
 * - `'placeholder'`  — letter-only code without a numeric index; used as
 *                      a stand-in for an unknown or unspecified sign
 *                      e.g. X, A (alone)
 */
export type GlyphKind = 'gardiner' | 'placeholder'

/**
 * Pattern for a Gardiner code: starts with an uppercase letter, optional
 * 1-2 lowercase letters (category prefix), then one or more digits, then
 * an optional uppercase variant suffix.
 * Examples: A1, G17, V49A, Aa1, NL5
 */
const GARDINER_PATTERN = /^[A-Z][a-z]{0,2}[0-9]+[A-Z]?$/

/**
 * Returns the kind of a MdC glyph code.
 */
export function classifyGlyphCode(code: string): GlyphKind {
  return GARDINER_PATTERN.test(code) ? 'gardiner' : 'placeholder'
}

/**
 * Maps SymbolCode → MdC string (the "manuel de codage" code for lexical items).
 * Mirrors the codesForSymbols array from LexicalSymbolsUtils.java.
 */
const codesForSymbols: Partial<Record<SymbolCode, string>> = {
  [SymbolCodes.HALFSPACE]: '.',
  [SymbolCodes.FULLSPACE]: '..',
  [SymbolCodes.REDPOINT]: 'o',
  [SymbolCodes.BLACKPOINT]: 'O',
  [SymbolCodes.FULLSHADE]: '//',
  [SymbolCodes.VERTICALSHADE]: 'v/',
  [SymbolCodes.HORIZONTALSHADE]: 'h/',
  [SymbolCodes.QUATERSHADE]: '/',
  [SymbolCodes.BEGINERASE]: '[[',
  [SymbolCodes.ENDERASE]: ']]',
  [SymbolCodes.BEGINEDITORADDITION]: '[&',
  [SymbolCodes.ENDEDITORADDITION]: '&]',
  [SymbolCodes.BEGINMINORADDITION]: '[(',
  [SymbolCodes.ENDMINORADDITION]: ')]',
  [SymbolCodes.BEGINDUBIOUS]: '[?',
  [SymbolCodes.ENDDUBIOUS]: '?]',
  [SymbolCodes.BEGINEDITORSUPERFLUOUS]: '[{',
  [SymbolCodes.ENDEDITORSUPERFLUOUS]: '}]',
  [SymbolCodes.BEGINPREVIOUSLYREADABLE]: '["',
  [SymbolCodes.ENDPREVIOUSLYREADABLE]: '"]',
  [SymbolCodes.BEGINSCRIBEADDITION]: "['",
  [SymbolCodes.ENDSCRIBEADDITION]: "']",
  [SymbolCodes.SMALLTEXT]: '""',
}

/** Inverse mapping: MdC string → SymbolCode. */
const integerCodesForString = new Map<string, SymbolCode>(
  (Object.entries(codesForSymbols) as [string, string][]).map(([type, code]) => [
    code,
    Number(type) as SymbolCode,
  ]),
)

export const LexicalSymbolsUtils = {
  /**
   * Returns the MdC code for a simple lexical item (space, halfspace, red
   * point, etc.), or undefined when no code is registered for that type.
   */
  getCodeForLexicalItem(itemType: SymbolCode): string | undefined {
    return codesForSymbols[itemType]
  },

  /**
   * Returns the SymbolCode for a given MdC string, or -1 when not found.
   */
  getCodeForString(mdcString: string): number {
    return integerCodesForString.get(mdcString) ?? -1
  },

  /**
   * Returns the human-readable representation of a philological/special symbol.
   */
  getStringForPhilology(code: SymbolCode): string {
    switch (code) {
      case SymbolCodes.BEGINERASE:               return '['
      case SymbolCodes.ENDERASE:                 return ']'
      case SymbolCodes.BEGINEDITORADDITION:      return '<'
      case SymbolCodes.ENDEDITORADDITION:        return '>'
      case SymbolCodes.BEGINEDITORSUPERFLUOUS:   return '{'
      case SymbolCodes.ENDEDITORSUPERFLUOUS:     return '}'
      case SymbolCodes.BEGINPREVIOUSLYREADABLE:  return '[|'
      case SymbolCodes.ENDPREVIOUSLYREADABLE:    return '|]'
      case SymbolCodes.BEGINSCRIBEADDITION:      return "'"
      case SymbolCodes.ENDSCRIBEADDITION:        return "'"
      case SymbolCodes.BLACKPOINT:               return '●'
      case SymbolCodes.REDPOINT:                 return '○'
      case SymbolCodes.FULLSHADE:
      case SymbolCodes.HORIZONTALSHADE:
      case SymbolCodes.VERTICALSHADE:
      case SymbolCodes.QUATERSHADE:              return '▨'
      case SymbolCodes.FULLSPACE:                return ' '
      case SymbolCodes.HALFSPACE:                return '\u2009'
      default:                                   return '??'
    }
  },

  /**
   * Returns the MdC opening bracket for a philological parenthesis code
   * (ERASEDSIGNS, EDITORADDITION, etc.), or null when not applicable.
   */
  getOpenCodeForPhilology(code: SymbolCode): string | null {
    switch (code) {
      case SymbolCodes.ERASEDSIGNS:          return '[['
      case SymbolCodes.EDITORADDITION:       return '[&'
      case SymbolCodes.EDITORSUPERFLUOUS:    return '[{'
      case SymbolCodes.PREVIOUSLYREADABLE:   return '["'
      case SymbolCodes.SCRIBEADDITION:       return "['";
      default:                               return null
    }
  },

  /**
   * Returns the MdC closing bracket for a philological parenthesis code, or
   * null when not applicable.
   */
  getCloseCodeForPhilology(code: SymbolCode): string | null {
    switch (code) {
      case SymbolCodes.ERASEDSIGNS:          return ']]'
      case SymbolCodes.EDITORADDITION:       return '&]'
      case SymbolCodes.EDITORSUPERFLUOUS:    return '}]'
      case SymbolCodes.PREVIOUSLYREADABLE:   return '"]'
      case SymbolCodes.SCRIBEADDITION:       return "']"
      default:                               return null
    }
  },
} as const
