export const CURRENCIES = ['EUR', 'USD', 'HUF']

export function parsePriceMinor(value) {
  if (typeof value !== 'string' || !/^\d+(\.\d{1,2})?$/.test(value.trim())) return null
  const [whole, fraction = ''] = value.trim().split('.')
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
  return minor <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(minor) : null
}

export function formatMoney(value, currency) {
  if (!CURRENCIES.includes(currency) || !(typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
    && !(typeof value === 'string' && /^\d+$/.test(value)) && !(typeof value === 'bigint' && value >= 0n)) return 'Amount not recorded'
  const minor = BigInt(value)
  const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return formatter.formatToParts(minor / 100n).map((part) => part.type === 'fraction' ? String(minor % 100n).padStart(2, '0') : part.value).join('')
}
