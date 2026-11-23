import { describe, expect, it } from 'vitest'
import { formatMoney, parsePriceMinor } from './money'

describe('money values', () => {
  it('parses decimal prices exactly without floating point rounding', () => {
    expect(parsePriceMinor('0.29')).toBe(29)
    expect(parsePriceMinor('12.5')).toBe(1250)
    expect(parsePriceMinor('0')).toBe(0)
    expect(parsePriceMinor('90071992547409.91')).toBe(Number.MAX_SAFE_INTEGER)
  })
  it.each(['-1', '1.001', '1e3', '', 'NaN', '90071992547409.92', null])('rejects invalid price %s', (value) => {
    expect(parsePriceMinor(value)).toBeNull()
  })
  it('distinguishes unknown amounts from free and preserves large exact revenue totals', () => {
    expect(formatMoney(null, 'EUR')).toBe('Amount not recorded')
    expect(formatMoney(0, 'EUR')).toMatch(/0\.00/)
    expect(formatMoney('18014398509481982', 'EUR').replace(/[^0-9]/g, '')).toBe('18014398509481982')
  })
})
