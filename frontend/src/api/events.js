// Public event discovery.
// Contract:
//   GET /api/events/?continent=&country=&type=physical|online
//     -> 200 [{ id, event_type, title, status, continent, country,
//               available_tickets, cover_url (null without a photo),
//               venue_name?, address?, stream_url? }]
// Empty filters are left out of the query string so the backend only
// applies the filters the user actually chose.
import { ApiError } from './auth'

export const FILTER_KEYS = ['continent', 'country', 'type']

export function buildEventsUrl(filters = {}) {
  const params = new URLSearchParams()
  for (const key of FILTER_KEYS) {
    const value = filters[key]?.trim()
    if (value) params.set(key, value)
  }
  const query = params.toString()
  return query ? `/api/events/?${query}` : '/api/events/'
}

export async function fetchEvents(filters, { signal } = {}) {
  const res = await fetch(buildEventsUrl(filters), { signal })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, data)
  return Array.isArray(data) ? data : []
}

// Organizer requests share the canonical event schema with discovery, but
// explicitly scope the list to the authenticated organizer on the server.
async function requestOrganizerEvents(url, token, options) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, data)
  return data
}

export async function listEvents(token, signal) {
  const data = await requestOrganizerEvents('/api/events/?mine=1', token, { method: 'GET', signal })
  if (!Array.isArray(data)) throw new Error('Invalid events response')
  return data
}

export async function createEvent(token, payload, signal) {
  const data = await requestOrganizerEvents('/api/events/', token, { method: 'POST', body: JSON.stringify(payload), signal })
  if (!data?.id || typeof data.title !== 'string') throw new Error('Invalid event response')
  return data
}

// PUT /api/events/:id/cover/ with the raw image bytes (JPEG, PNG or WebP, up to 2 MB)
// -> 200 the updated event, whose cover_url points at the stored photo.
// 400 not an accepted image · 403 not the owner · 404 unknown event · 413 too large
export async function uploadCover(token, eventId, file, signal) {
  const response = await fetch(`/api/events/${encodeURIComponent(eventId)}/cover/`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.type },
    body: file,
    signal,
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, data)
  return data
}

// Public single-event read, used for the live ticket count on the details page.
export async function fetchEvent(eventId, { signal } = {}) {
  const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/`, { signal })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, data)
  return data
}

// POST /api/checkout/ { event_id, quantity } -> 201 purchase
// 400 invalid · 403 not an attendee · 404 unknown event · 409 not enough tickets
export async function checkout(token, eventId, quantity, expectedPrice, { signal } = {}) {
  const res = await fetch('/api/checkout/', {
    signal,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ event_id: eventId, quantity, ...(expectedPrice ?? {}) }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, data)
  return data
}
