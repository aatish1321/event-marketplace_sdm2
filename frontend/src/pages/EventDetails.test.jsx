import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../context/AuthContext'
import { makeToken } from '../test/authFixtures'
import EventDetails from './EventDetails'

const EVENT = {
  id: 'e1', event_type: 'physical', title: 'Danube After Dark', status: 'published',
  continent: 'Europe', country: 'Hungary', available_tickets: 3, description: 'A night on the river.',
  venue_name: 'A38 Ship', address: 'Budapest', start_at: '2026-12-04T18:00:00Z', end_at: '2026-12-04T22:00:00Z',
}

const json = (status, body) => ({ ok: status < 400, status, json: async () => body })

// Serves GET /api/events/e1/ from a list of successive event states, and
// answers POST /api/checkout/ with the given response.
function mockApi({ events = [EVENT], checkoutResponse = json(201, {}) } = {}) {
  let reads = 0
  const fetch = vi.fn(async (url) => {
    if (url === '/api/checkout/') return checkoutResponse
    if (url === '/api/events/e1/') return json(200, events[Math.min(reads++, events.length - 1)])
    return json(404, { error: 'Event not found.' })
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

function renderDetails(path = '/events/e1') {
  localStorage.setItem('access_token', makeToken({ role: 'attendee' }))
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path="/events/:eventId" element={<EventDetails />} /></Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

const checkoutCalls = (fetch) => fetch.mock.calls.filter(([url]) => url === '/api/checkout/')

describe('EventDetails', () => {
  it('shows the event with its live ticket count and buys the chosen quantity', async () => {
    const purchase = { id: 'p1', quantity: 2, event_snapshot: { title: 'Danube After Dark' } }
    const fetch = mockApi({ events: [EVENT, { ...EVENT, available_tickets: 1 }], checkoutResponse: json(201, purchase) })
    renderDetails()

    expect(await screen.findByRole('heading', { name: 'Danube After Dark' })).toBeInTheDocument()
    expect(screen.getByText('A night on the river.')).toBeInTheDocument()
    expect(screen.getByText(/A38 Ship · Budapest · Hungary/)).toBeInTheDocument()
    expect(screen.getByText('3 tickets left')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'More tickets' }))
    await user.click(screen.getByRole('button', { name: 'Buy 2 tickets' }))

    expect(await screen.findByRole('status')).toHaveTextContent('You bought 2 tickets for Danube After Dark')
    const [[, request]] = checkoutCalls(fetch)
    expect(JSON.parse(request.body)).toEqual({ event_id: 'e1', quantity: 2 })
    expect(request.headers.Authorization).toMatch(/^Bearer /)
    // The count is re-read after buying.
    expect(await screen.findByText('1 ticket left')).toBeInTheDocument()
  })

  it('never lets the quantity exceed the tickets left', async () => {
    mockApi({ events: [{ ...EVENT, available_tickets: 2 }] })
    renderDetails()
    const user = userEvent.setup()
    const more = await screen.findByRole('button', { name: 'More tickets' })
    await user.click(more)
    expect(more).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Buy 2 tickets' })).toBeInTheDocument()
  })

  it('shows a sold-out state that cannot be bought', async () => {
    const fetch = mockApi({ events: [{ ...EVENT, available_tickets: 0 }] })
    renderDetails()
    const button = await screen.findByRole('button', { name: 'Sold out' })
    expect(button).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'More tickets' })).not.toBeInTheDocument()
    expect(checkoutCalls(fetch)).toHaveLength(0)
  })

  it('explains a lost race (409) and refreshes the count', async () => {
    mockApi({
      events: [EVENT, { ...EVENT, available_tickets: 0 }],
      checkoutResponse: json(409, { error: 'Not enough tickets available.' }),
    })
    renderDetails()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Buy 1 ticket' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Not enough tickets left')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sold out' })).toBeDisabled())
  })

  it('tells non-attendees why checkout was refused', async () => {
    mockApi({ checkoutResponse: json(403, { error: 'Forbidden.' }) })
    renderDetails()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Buy 1 ticket' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Only attendee accounts can buy tickets')
  })

  it('shows not found for an unknown event', async () => {
    mockApi()
    renderDetails('/events/missing')
    expect(await screen.findByRole('heading', { name: 'Event not found' })).toBeInTheDocument()
  })
})
