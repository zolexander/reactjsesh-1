// src/jsesh/layout/groupParser.ts
// FIX: '-' als vertikaler Split entfernt — '-' ist der Kadrat-Separator auf
// Top-Level und darf nie als groupOp innerhalb eines Kadrats erscheinen.

import { Hieroglyph, type GroupOperator } from '../model/Hieroglyph'

export type GroupNode =
  | { type: 'sign'; glyph: Hieroglyph }
  | { type: 'vgroup'; children: GroupNode[] }
  | { type: 'hgroup'; children: GroupNode[] }
  | { type: 'ligature'; children: GroupNode[] }

/**
 * Teilt eine flache Zeichen-Liste an jedem Zeichen auf, das den angegebenen
 * groupOp trägt. Das Zeichen MIT dem Operator gehört zum NEUEN Teil (rechts).
 *
 * Beispiel: [A(null), B(*), C(:)] split by ':' → [[A, B], [C]]
 */
function splitByOperator(signs: readonly Hieroglyph[], operator: GroupOperator): Hieroglyph[][] {
  if (signs.length === 0) {
    return []
  }

  const parts: Hieroglyph[][] = [[]]

  for (let i = 0; i < signs.length; i += 1) {
    const sign = signs[i]
    // groupOp am aktuellen Zeichen = Verbindung zum LINKEN Nachbarn
    if (i > 0 && sign.groupOp === operator) {
      parts.push([sign])
      continue
    }
    parts[parts.length - 1].push(sign)
  }

  return parts.filter((part) => part.length > 0)
}

/** Höchste Priorität: & (Ligatur) */
function parseLigature(signs: readonly Hieroglyph[]): GroupNode {
  const parts = splitByOperator(signs, '&' as GroupOperator)

  if (parts.length > 1) {
    return {
      type: 'ligature',
      children: parts.map((part) => parseLigature(part)),
    }
  }

  if (signs.length === 1) {
    return { type: 'sign', glyph: signs[0] }
  }

  // Fallback für fehlerhafte Eingaben ohne explizite Operatoren
  return {
    type: 'ligature',
    children: signs.map((glyph) => ({ type: 'sign' as const, glyph })),
  }
}

/** Mittlere Priorität: * (horizontal nebeneinander) */
function parseHGroup(signs: readonly Hieroglyph[]): GroupNode {
  const parts = splitByOperator(signs, '*' as GroupOperator)

  if (parts.length > 1) {
    return {
      type: 'hgroup',
      children: parts.map((part) => parseLigature(part)),
    }
  }

  return parseLigature(signs)
}

/**
 * Niedrigste Priorität: : (vertikal übereinander)
 *
 * FIX: '-' als vertikaler Split ENTFERNT. '-' ist der Kadrat-Separator auf
 * Top-Level-Ebene und gehört nicht in die Gruppen-Logik innerhalb eines Kadrats.
 * Ein Zeichen mit groupOp='-' darf in einem korrekt geparsten Kadrat nie
 * vorkommen — das wäre ein Parser-Bug.
 */
function parseVGroup(signs: readonly Hieroglyph[]): GroupNode {
  const parts = splitByOperator(signs, ':' as GroupOperator)

  if (parts.length > 1) {
    return {
      type: 'vgroup',
      children: parts.map((part) => parseHGroup(part)),
    }
  }

  return parseHGroup(signs)
}

/**
 * Wandelt eine flache Hieroglyphen-Liste (mit groupOp-Feldern) in einen
 * Gruppen-Baum um. Operator-Priorität (niedrig → hoch): : < * < &
 *
 * Beispiele:
 *   [A(null), B(*), C(:)] → vgroup[ hgroup[A, B], C ]
 *   [A(null), B(:)]       → vgroup[ A, B ]
 *   [A(null), B(*)]       → hgroup[ A, B ]
 *   [A(null), B(&)]       → ligature[ A, B ]
 */
export function buildGroupTree(signs: readonly Hieroglyph[]): GroupNode | null {
  if (signs.length === 0) {
    return null
  }
  return parseVGroup(signs)
}