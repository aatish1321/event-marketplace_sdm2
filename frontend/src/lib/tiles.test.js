import { describe, expect, it } from 'vitest'
import { dateParts, tileColor } from './tiles'

describe('tileColor', () => {
  it('gives the same colour for the same key, always one of the poster colours', () => {
    const allowed = ['bg-accent', 'bg-poster-teal', 'bg-poster-plum', 'bg-poster-cobalt']
    for (const key of ['6af61a8e', 'abc', '', undefined]) {
      expect(allowed).toContain(tileColor(key))
      expect(tileColor(key)).toBe(tileColor(key))
    }
  })

  it('uses more than one colour across different ids', () => {
    const colours = new Set(['a', 'b', 'c', 'd', 'e'].map(tileColor))
    expect(colours.size).toBeGreaterThan(1)
  })
})

describe('dateParts', () => {
  it('splits an ISO date into day, month and weekday', () => {
    expect(dateParts('2030-11-13T12:00:00Z')).toEqual({ day: '13', month: 'Nov', weekday: 'Wed' })
  })

  it.each([undefined, null, '', 'not a date'])('returns null for %s', (value) => {
    expect(dateParts(value)).toBeNull()
  })
})
