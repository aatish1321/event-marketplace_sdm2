import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { AuthProvider } from '../context/AuthContext'

describe('unknown routes', () => {
  it('shows a 404 page with a way back instead of silently redirecting', () => {
    window.history.replaceState({}, '', '/definitely-not-a-page')
    render(<AuthProvider><App /></AuthProvider>)
    expect(screen.getByRole('heading', { name: 'We couldn’t find that page' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to the homepage' })).toHaveAttribute('href', '/')
    expect(window.location.pathname).toBe('/definitely-not-a-page')
    expect(document.title).toBe('Page not found · Eventify')
  })
})
