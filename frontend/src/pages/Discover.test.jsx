import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { buildEventsUrl } from '../api/events'
import { AuthProvider } from '../context/AuthContext'
import Discover from './Discover'

const EVENTS = [
  {
    id: 'e1', event_type: 'physical', title: 'Debrecen Jazz Night', status: 'published',
    continent: 'Europe', country: 'Hungary', available_tickets: 40, venue_name: 'Kölcsey Center', address: 'Hunyadi u. 1',
  },
  {
    id: 'e2', event_type: 'online', title: 'React Summit Live', status: 'published',
    continent: 'Europe', country: 'Netherlands', available_tickets: 1, stream_url: 'https://example.com/live',
  },
]

function mockFetch(response = { ok: true, json: async () => EVENTS }) {
  const fetch = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', fetch)
  return fetch
}

function renderDiscover() {
  return render(<AuthProvider><MemoryRouter><Discover /></MemoryRouter></AuthProvider>)
}

const requestedUrls = (fetch) => fetch.mock.calls.map(([url]) => url)

describe('buildEventsUrl', () => {
  it('omits blank filters and trims values', () => {
    expect(buildEventsUrl({ continent: '', country: '  ', type: '' })).toBe('/api/events/')
    expect(buildEventsUrl({ continent: 'North America', country: ' Canada ', type: 'online' }))
      .toBe('/api/events/?continent=North+America&country=Canada&type=online')
  })
})

describe('Discover', () => {
  it('loads all events into cards with a map pin for physical and a globe for online events', async () => {
    const fetch = mockFetch()
    renderDiscover()

    expect(await screen.findByRole('heading', { name: 'Debrecen Jazz Night' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'React Summit Live' })).toBeInTheDocument()
    expect(screen.getByText('Kölcsey Center · Hungary')).toBeInTheDocument()
    expect(screen.getByText('Online event')).toBeInTheDocument()
    expect(screen.getByText('1 ticket left')).toBeInTheDocument()
    expect(screen.getByText('2 events')).toBeInTheDocument()
    expect(screen.getAllByTestId('physical-icon')).toHaveLength(1)
    expect(screen.getAllByTestId('online-icon')).toHaveLength(1)
    expect(requestedUrls(fetch)).toEqual(['/api/events/'])
  })

  it('refetches with query parameters whenever filters change', async () => {
    const fetch = mockFetch()
    renderDiscover()
    await screen.findByRole('heading', { name: 'Debrecen Jazz Night' })
    const user = userEvent.setup()

    await user.selectOptions(screen.getByLabelText('Continent'), 'Europe')
    await waitFor(() => expect(requestedUrls(fetch).at(-1)).toBe('/api/events/?continent=Europe'))

    await user.click(screen.getByRole('button', { name: 'Physical' }))
    expect(screen.getByRole('button', { name: 'Physical' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(requestedUrls(fetch).at(-1)).toBe('/api/events/?continent=Europe&type=physical'))

    await user.type(screen.getByLabelText('Country'), 'Hungary')
    await waitFor(() => expect(requestedUrls(fetch).at(-1))
      .toBe('/api/events/?continent=Europe&country=Hungary&type=physical'))
    // Typing is debounced, so "Hungary" is not sent letter by letter.
    expect(requestedUrls(fetch).some((url) => /country=H(&|$)/.test(url))).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    await waitFor(() => expect(requestedUrls(fetch).at(-1)).toBe('/api/events/'))
  })

  it('applies the typed country immediately on Explore events', async () => {
    const fetch = mockFetch()
    renderDiscover()
    await screen.findByRole('heading', { name: 'Debrecen Jazz Night' })
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Country'), 'Japan')
    await user.click(screen.getByRole('button', { name: 'Explore events' }))
    await waitFor(() => expect(requestedUrls(fetch)).toContain('/api/events/?country=Japan'))
  })

  it('shows an empty state when nothing matches', async () => {
    mockFetch({ ok: true, json: async () => [] })
    renderDiscover()
    expect(await screen.findByText('No events match these filters.')).toBeInTheDocument()
  })

  it('shows an error when the request fails', async () => {
    mockFetch({ ok: false, status: 500, json: async () => ({ error: 'Server error' }) })
    renderDiscover()
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load events')
  })
})
