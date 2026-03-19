import { describe, expect, it } from 'vitest'
import {
  findUnresolvableCodes,
  resetMdcToGardinerMap,
  resolveGardinerCode,
} from './mdcToGardiner'

describe('mdcToGardiner', () => {
  it('löst bekannte Fallback-Codes auf', () => {
    resetMdcToGardinerMap()
    expect(resolveGardinerCode('i')).toBe('M17')
    expect(resolveGardinerCode('ra')).toBe('N5')
    expect(resolveGardinerCode('dw')).toBe('N25')
    expect(resolveGardinerCode('1')).toBe('Z1')
  })

  it('behält Gardiner-Codes unverändert', () => {
    resetMdcToGardinerMap()
    expect(resolveGardinerCode('A1')).toBe('A1')
    expect(resolveGardinerCode('Aa1')).toBe('Aa1')
  })

  it('meldet nur nicht auflösbare Nicht-Gardiner-Codes', () => {
    resetMdcToGardinerMap()
    const result = findUnresolvableCodes(['i', 'A1', 'zzzz_unknown'])
    expect(result).toEqual(['zzzz_unknown'])
  })
})
