import { Hieroglyph, type GroupOperator } from '../model/Hieroglyph'

export type GroupNode =
  | { type: 'sign'; glyph: Hieroglyph }
  | { type: 'vgroup'; children: GroupNode[] }
  | { type: 'hgroup'; children: GroupNode[] }
  | { type: 'ligature'; children: GroupNode[] }

function splitByOperator(signs: readonly Hieroglyph[], operator: GroupOperator): Hieroglyph[][] {
  if (signs.length === 0) {
    return []
  }

  const parts: Hieroglyph[][] = [[]]

  for (let i = 0; i < signs.length; i += 1) {
    const sign = signs[i]

    // groupOp belongs to the current sign and links it to the previous one.
    if (i > 0 && sign.groupOp === operator) {
      parts.push([sign])
      continue
    }

    parts[parts.length - 1].push(sign)
  }

  return parts.filter((part) => part.length > 0)
}

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

  // Fallback for malformed sequences without explicit operators.
  return {
    type: 'ligature',
    children: signs.map((glyph) => ({ type: 'sign', glyph })),
  }
}

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

function parseVGroup(signs: readonly Hieroglyph[]): GroupNode {
  // Legacy compatibility: '-' is treated as vertical split here as well.
  const byColon = splitByOperator(signs, ':' as GroupOperator)
  const parts = byColon.length > 1 ? byColon : splitByOperator(signs, '-' as GroupOperator)

  if (parts.length > 1) {
    return {
      type: 'vgroup',
      children: parts.map((part) => parseHGroup(part)),
    }
  }

  return parseHGroup(signs)
}

export function buildGroupTree(signs: readonly Hieroglyph[]): GroupNode | null {
  if (signs.length === 0) {
    return null
  }

  return parseVGroup(signs)
}