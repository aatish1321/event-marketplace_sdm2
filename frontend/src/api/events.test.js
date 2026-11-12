import { describe, expect, it, vi } from 'vitest'
import { ApiError } from './auth'
import { createEvent, listEvents } from './events'

describe('events API responses', () => {
  it('propagates the abort signal for requests', async () => {
    const controller = new AbortController()
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
    vi.stubGlobal('fetch', fetch)
    await listEvents('token', controller.signal)
    expect(fetch).toHaveBeenCalledWith('/api/events/?mine=1', expect.objectContaining({ signal: controller.signal }))
  })

  it.each([null, {}, { events: {} }])('rejects a malformed list response', async (data) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }))
    await expect(listEvents('token')).rejects.toThrow('Invalid events response')
  })

  it('does not report creation success for a missing record', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
    await expect(createEvent('token', {})).rejects.toThrow('Invalid event response')
  })

  it('preserves the HTTP error when the server returns HTML', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502,
      json: async () => { throw new SyntaxError('not JSON') } }))
    await expect(listEvents('token')).rejects.toMatchObject({ name: 'ApiError', status: 502 })
    await expect(createEvent('token', {})).rejects.toBeInstanceOf(ApiError)
  })
})
