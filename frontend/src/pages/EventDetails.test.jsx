import { act, render, screen, waitFor } from '@testing-library/react'
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
  it.each([
    { ...EVENT, status: 'cancelled' },
    { ...EVENT, end_at: '2020-01-01T00:00:00Z' },
  ])('closes booking for unavailable events', async (event) => {
    const fetch = mockApi({ events: [event] })
    renderDetails()
    expect(await screen.findByRole('button', { name: 'Booking closed' })).toBeDisabled()
    expect(checkoutCalls(fetch)).toHaveLength(0)
  })

  it('clearly labels checkout as a simulation', async () => {
    mockApi()
    renderDetails()
    await screen.findByRole('button', { name: 'Book 1 ticket' })
    expect(screen.getByText('Simulated booking. No payment will be collected.')).toBeInTheDocument()
  })
  it('submits the displayed price and refreshes it after a price conflict', async () => {
    const fetch = mockApi({ events: [{ ...EVENT, ticket_price_minor: 1250, currency: 'EUR' },
      { ...EVENT, ticket_price_minor: 1300, currency: 'EUR' }],
      checkoutResponse: json(409, { code: 'price_changed' }) })
    renderDetails()
    await userEvent.click(await screen.findByRole('button', { name: 'Book 1 ticket' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('ticket price changed')
    expect(JSON.parse(checkoutCalls(fetch)[0][1].body)).toMatchObject({ expected_unit_price_minor: 1250, expected_currency: 'EUR' })
    expect(await screen.findByText(/Unit price:.*13\.00/)).toBeInTheDocument()
  })

  it('ignores a previous account purchase that completes after switching accounts', async () => {
    let resolvePurchase
    const pending = new Promise((resolve) => { resolvePurchase = resolve })
    const fetch = mockApi({ checkoutResponse: pending })
    renderDetails()
    await userEvent.click(await screen.findByRole('button', { name: 'Book 1 ticket' }))
    act(() => {
      const token = makeToken({ role: 'attendee', user_id: 'new-user' })
      localStorage.setItem('access_token', token)
      window.dispatchEvent(new StorageEvent('storage', { key: 'access_token', newValue: token }))
    })
    await screen.findByRole('button', { name: 'Book 1 ticket' })
    expect(checkoutCalls(fetch)[0][1].signal.aborted).toBe(true)
    await act(async () => resolvePurchase(json(201, { id: 'old-private-purchase', quantity: 1, event_snapshot: { title: 'Private old event' } })))
    expect(screen.queryByText(/Private old event/)).not.toBeInTheDocument()
  })

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
    await user.click(screen.getByRole('button', { name: 'Book 2 tickets' }))

    expect(await screen.findByRole('status')).toHaveTextContent('You booked 2 tickets for Danube After Dark')
    const [[, request]] = checkoutCalls(fetch)
    expect(JSON.parse(request.body)).toEqual({ event_id: 'e1', quantity: 2, expected_unit_price_minor: null, expected_currency: null })
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
    expect(screen.getByRole('button', { name: 'Book 2 tickets' })).toBeInTheDocument()
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
    await user.click(await screen.findByRole('button', { name: 'Book 1 ticket' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Not enough tickets left')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sold out' })).toBeDisabled())
  })

  it('tells non-attendees why checkout was refused', async () => {
    mockApi({ checkoutResponse: json(403, { error: 'Forbidden.' }) })
    renderDetails()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Book 1 ticket' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Only attendee accounts can buy tickets')
  })

  it('shows not found for an unknown event', async () => {
    mockApi()
    renderDetails('/events/missing')
    expect(await screen.findByRole('heading', { name: 'Event not found' })).toBeInTheDocument()
  })
})
