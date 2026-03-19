// src/jsesh/glyphs/mdcToGardiner.ts
//
// Mapping MdC-Code → Gardiner-Code.
// Geladen aus public/signsdescription.xml (aus jsesh.jar extrahieren).
//
// SETUP:
//   jar xf jsesh.jar
//   cp jsesh/hieroglyphs/signsdescription.xml public/
//
// XML-Format (JSesh):
//   Flach: <hasTransliteration sign="M17" transliteration="i" use="keyboard"/>
//   Oder nested:
//     <sign code="M17">
//       <values>
//         <value transliteration="i" use="keyboard"/>
//       </values>
//     </sign>
//
// Lade-Strategie:
//   1. Alle Einträge laden — keyboard-Einträge haben Priorität
//   2. Einträge ohne use-Attribut oder mit anderem use als Fallback
//   3. Zahlen (1, 2, ...) aus eingebetteter Map (fehlen in XML)
//   4. Bereits Gardiner-Codes (A1, M17, ...) werden direkt zurückgegeben

import { DOMParser as XmldomParser } from '@xmldom/xmldom'

export type MdcToGardinerMap = ReadonlyMap<string, string>

// ── Eingebettete Minimal-Fallback-Map ─────────────────────────────────────
// Wird genutzt wenn XML nicht geladen werden kann.
// Zahlen fehlen immer in der XML → werden hier immer ergänzt.

const NUMBERS_MAP: ReadonlyMap<string, string> = new Map([
  ['1', 'Z1'], ['2', 'Z2'], ['3', 'Z3'], ['4', 'V1'],
  ['5', 'Z1'], ['6', 'Z1'], ['7', 'Z1'], ['8', 'Z1'], ['9', 'Z1'],
  ['10', 'V20'], ['20', 'V20'], ['100', 'V1'], ['1000', 'M12'],
  ['10000', 'D50'], ['100000', 'I8'], ['1000000', 'C11'],
])

const FALLBACK_MAP: ReadonlyMap<string, string> = new Map([
  ...NUMBERS_MAP,
  ['A', 'G1'], ['i', 'M17'], ['y', 'M17'], ['a', 'D36'], ['w', 'G43'],
  ['b', 'D58'], ['p', 'Q3'], ['f', 'I9'], ['m', 'G17'], ['n', 'N35'],
  ['r', 'D21'], ['h', 'O4'], ['H', 'V28'], ['x', 'Aa1'], ['X', 'Aa2'],
  ['z', 'O34'], ['s', 'S29'], ['S', 'N37'], ['q', 'N29'], ['k', 'V31'],
  ['g', 'W11'], ['t', 'X1'], ['T', 'V13'], ['d', 'D46'], ['D', 'I10'],
  ['ra', 'N5'], ['Ra', 'N5'], ['pt', 'N1'], ['mn', 'Y5'], ['nfr', 'F35'],
  ['pr', 'O1'], ['nb', 'V30'], ['nTr', 'R8'], ['Htp', 'R4'], ['anx', 'S34'],
  ['wAs', 'S40'], ['Dd', 'R11'], ['xpr', 'L1'], ['bA', 'G29'], ['Ax', 'G25'],
  ['ib', 'F34'], ['ms', 'F31'], ['Hr', 'D2'], ['rnp', 'M4'], ['tA', 'N16'],
  ['sA', 'V17'], ['SA', 'M23'], ['mw', 'N35A'], ['sw', 'S29'], ['ii', 'M17'],

  // Codes die NICHT in signsdescription.xml sind → immer aus Fallback-Map
  ['dw',  'N25'],  // Berg (sehr häufig in Ortsnamen wie Dw=N25)
  ['Dw',  'N25'],  // Variante
  ['W',   'W3'],   // Alabaster-Krug (standalone W ohne Ziffer)
  ['M',   'M17'],  // Schilf (standalone M)
  ['O',   'N5'],   // Großes O → Sonnenscheibe (SymbolCode BLACKPOINT)
  ['Tr',  'U33'],  // Dreschflegel
  ['Trw', 'U33'],  // Dreschflegel Plural
  ['.', 'Z4'],     // Halbabstand
  ['..', 'Z4'],    // Vollabstand
])

// ── Laufzeit-Zustand ──────────────────────────────────────────────────────

let activeMap: MdcToGardinerMap = FALLBACK_MAP
let loadPromise: Promise<void> | null = null
let loaded = false

function getDomParserCtor(): { new (): DOMParser } {
  if (typeof globalThis.DOMParser !== 'undefined') return globalThis.DOMParser
  return XmldomParser as unknown as { new (): DOMParser }
}

// ── XML-Parser ────────────────────────────────────────────────────────────

/**
 * Priorität der use-Werte:
 *   keyboard=1 (höchste) → das ist der direkte MdC-Eingabe-Code
 *   phonogram=2
 *   (alle anderen)=3 (niedrigste)
 *
 * Bei Konflikten (gleicher transliteration-Code, verschiedene Zeichen)
 * gewinnt der Eintrag mit höherer Priorität.
 */
function usePriority(use: string | null): number {
  switch ((use ?? '').toLowerCase()) {
    case 'keyboard': return 1
    case 'phonogram': return 2
    default: return 3
  }
}

/**
 * Parst signsdescription.xml.
 *
 * Unterstützt beide Formate:
 *
 * Format A (flach):
 *   <hasTransliteration sign="M17" transliteration="i" use="keyboard"/>
 *
 * Format B (nested):
 *   <sign code="M17">
 *     <values>
 *       <value transliteration="i" use="keyboard"/>
 *     </values>
 *   </sign>
 *
 * Lädt ALLE Einträge, keyboard hat Vorrang vor anderen use-Typen.
 */
function parseSignsDescriptionXml(xml: string): Map<string, string> {
  const map = new Map<string, string>()
  // Priorität merken: niedrigerer Wert = höhere Priorität
  const priority = new Map<string, number>()

  const ParserCtor = getDomParserCtor()
  const doc = new ParserCtor().parseFromString(xml, 'application/xml')

  function addEntry(sign: string, transliteration: string, use: string | null): void {
    if (!sign || !transliteration) return
    const prio = usePriority(use)
    const existing = priority.get(transliteration)
    if (existing === undefined || prio < existing) {
      map.set(transliteration, sign)
      priority.set(transliteration, prio)
    }
  }

  // Format A: <hasTransliteration sign="..." transliteration="..." use="..."/>
  const flatEls = Array.from(doc.getElementsByTagName('hasTransliteration'))
  for (const el of flatEls) {
    addEntry(
      el.getAttribute('sign') ?? '',
      el.getAttribute('transliteration') ?? '',
      el.getAttribute('use'),
    )
  }

  // Format B: <sign code="..."><values><value transliteration="..." use="..."/></values></sign>
  const signEls = Array.from(doc.getElementsByTagName('sign'))
  for (const signEl of signEls) {
    const code = signEl.getAttribute('code') ?? ''
    if (!code) continue

    // <values> → <value> oder direkte <value>-Kinder
    const valueEls = [
      ...Array.from(signEl.getElementsByTagName('value')),
      ...Array.from(signEl.getElementsByTagName('transliteration')),
    ]
    for (const valEl of valueEls) {
      const tr = valEl.getAttribute('transliteration')
        || valEl.getAttribute('value')
        || valEl.textContent?.trim()
        || ''
      addEntry(code, tr, valEl.getAttribute('use'))
    }
  }

  return map
}

// ── Öffentliche API ───────────────────────────────────────────────────────

/**
 * Lädt signsdescription.xml von /signsdescription.xml.
 * Idempotent — mehrfache Aufrufe sind sicher.
 */
export async function loadMdcToGardinerMap(): Promise<void> {
  if (loaded) return
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    try {
      if (typeof fetch === 'undefined') return

      const response = await fetch('/signsdescription.xml')
      if (!response.ok) {
        console.warn('[mdcToGardiner] /signsdescription.xml nicht gefunden → Fallback-Map aktiv')
        console.warn('[mdcToGardiner] Fix: jar xf jsesh.jar && cp jsesh/hieroglyphs/signsdescription.xml public/')
        return
      }

      const xml = await response.text()
      const map = parseSignsDescriptionXml(xml)

      if (map.size > 0) {
        // FIX: ALLE Fallback-Einträge übertragen die nicht in der XML sind.
        // Nur NUMBERS_MAP zu übertragen reichte nicht — dw/W/M/O/Tr/Trw
        // fehlen in signsdescription.xml und wurden nach XML-Laden gelöscht.
        for (const [k, v] of FALLBACK_MAP) {
          if (!map.has(k)) map.set(k, v)
        }
        activeMap = map
        console.info(`[mdcToGardiner] ${map.size} Einträge aus signsdescription.xml geladen.`)
      } else {
        console.warn('[mdcToGardiner] XML leer oder falsches Format → Fallback-Map aktiv')
      }
    } catch (e) {
      console.warn('[mdcToGardiner] Ladefehler:', e)
    } finally {
      loaded = true
    }
  })()

  return loadPromise
}

/** Für Tests: Map zurücksetzen */
export function resetMdcToGardinerMap(): void {
  activeMap = FALLBACK_MAP
  loaded = false
  loadPromise = null
}

/**
 * Gibt den Gardiner-Code für einen MdC-Code zurück.
 *
 * Reihenfolge:
 *   1. Aktive Map (XML oder Fallback)
 *   2. Direkter Gardiner-Code-Pattern (A1, M17, Aa1, ...)
 *   3. Unverändert zurückgeben (→ wird als Dateiname versucht)
 */
export function resolveGardinerCode(mdcCode: string): string {
  const mapped = activeMap.get(mdcCode)
  if (mapped) return mapped

  // Bereits Gardiner-Code? Pattern: Großbuchstabe + optional 1-2 Kleinbuchstaben + Ziffern + opt. Großbuchstabe
  if (/^[A-Z][a-z]{0,2}[0-9]+[A-Z]?$/.test(mdcCode)) return mdcCode

  return mdcCode
}

export function getGlyphFileName(mdcCode: string): string {
  return resolveGardinerCode(mdcCode)
}

export function getActiveMap(): MdcToGardinerMap {
  return activeMap
}

/** Debug: Gibt alle Codes zurück die NICHT aufgelöst werden können */
export function findUnresolvableCodes(codes: readonly string[]): string[] {
  return codes.filter(code => {
    const resolved = resolveGardinerCode(code)
    // Unauflösbar wenn resolved === code UND kein Gardiner-Pattern
    return resolved === code && !/^[A-Z][a-z]{0,2}[0-9]+[A-Z]?$/.test(code)
  })
}
