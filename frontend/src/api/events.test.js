import { describe, expect, it, vi } from 'vitest'
import { ApiError } from './auth'
import { createEvent, listEvents, uploadCover } from './events'

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

  describe('uploadCover', () => {
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'cover.png', { type: 'image/png' })

    it('PUTs the raw file with the bearer token and its own content type', async () => {
      const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'e1', cover_url: '/api/events/e1/cover/?v=1' }) })
      vi.stubGlobal('fetch', fetch)
      const updated = await uploadCover('token', 'e1', file)
      expect(updated.cover_url).toBe('/api/events/e1/cover/?v=1')
      const [url, options] = fetch.mock.calls[0]
      expect(url).toBe('/api/events/e1/cover/')
      expect(options.method).toBe('PUT')
      expect(options.body).toBe(file)
      expect(options.headers).toEqual({ Authorization: 'Bearer token', 'Content-Type': 'image/png' })
    })

    it('encodes the event id in the path', async () => {
      const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
      vi.stubGlobal('fetch', fetch)
      await uploadCover('token', 'a/b', file)
      expect(fetch.mock.calls[0][0]).toBe('/api/events/a%2Fb/cover/')
    })

    it.each([400, 403, 413])('rejects with an ApiError carrying the status (%s)', async (status) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status, json: async () => ({ error: 'no' }) }))
      await expect(uploadCover('token', 'e1', file)).rejects.toMatchObject({ name: 'ApiError', status })
    })
  })
})
