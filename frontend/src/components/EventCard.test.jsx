import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import EventCard from './EventCard'

const base = { title: 'Danube After Dark', category: 'Physical', venue: 'A38 Ship', price: '3 tickets left', date: 'Wed 13 Nov · 12:00' }
const renderCard = (props) => render(<MemoryRouter><EventCard {...base} {...props} /></MemoryRouter>)

describe('EventCard visual', () => {
  it('shows the cover photo when the organizer added one', () => {
    renderCard({ imageUrl: '/api/events/e1/cover/?v=1', startAt: '2030-11-13T12:00:00Z', eventKey: 'e1' })
    expect(screen.getByRole('img', { name: 'Danube After Dark' })).toHaveAttribute('src', '/api/events/e1/cover/?v=1')
  })

  it('falls back to a poster tile with the big date and no broken image', () => {
    renderCard({ startAt: '2030-11-13T12:00:00Z', eventKey: 'e1' })
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('13')).toBeInTheDocument()
    expect(screen.getByText('Nov')).toBeInTheDocument()
  })

  it('still renders a tile for an event without a date', () => {
    renderCard({ eventKey: 'e1', startAt: undefined })
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Danube After Dark' })).toBeInTheDocument()
  })
})
