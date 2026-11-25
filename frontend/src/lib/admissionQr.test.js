import { describe, expect, it } from 'vitest'
import { admissionQrDataUrl } from './admissionQr'

const code = `0123456789abcdef01234567:${'A'.repeat(43)}`

describe('admission QR image', () => {
  it('encodes a signed admission code locally with a square image and quiet zone', () => {
    const url = admissionQrDataUrl(code)
    expect(url).toMatch(/^data:image\/gif;base64,/)
    const bytes = atob(url.split(',')[1])
    expect(bytes.slice(0, 6)).toBe('GIF87a')
    const width = bytes.charCodeAt(6) | bytes.charCodeAt(7) << 8
    const height = bytes.charCodeAt(8) | bytes.charCodeAt(9) << 8
    expect(width).toBe(height)
    expect(width).toBeGreaterThanOrEqual((21 + 8) * 6)
  })

  it('changes the QR image when the signed admission code changes', () => {
    expect(admissionQrDataUrl(code)).not.toBe(admissionQrDataUrl(`${code.slice(0, -1)}B`))
  })
})
