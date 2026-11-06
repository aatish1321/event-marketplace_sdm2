import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'
import { makeToken } from '../test/authFixtures'

function Session({ token }) {
  const { userRole, isAuthenticated, login, logout } = useAuth()
  return <>
    <output>{isAuthenticated ? userRole : 'signed out'}</output>
    <button onClick={() => login(token)}>Log in</button>
    <button onClick={logout}>Log out</button>
  </>
}

describe('AuthProvider', () => {
  it('keeps login and logout working when browser storage is blocked', () => {
    const blocked = () => { throw new Error('Storage blocked') }
    const spies = ['getItem', 'setItem', 'removeItem'].map((method) =>
      vi.spyOn(Storage.prototype, method).mockImplementation(blocked))
    try {
      render(<AuthProvider><Session token={makeToken()} /></AuthProvider>)
      expect(screen.getByRole('status')).toHaveTextContent('signed out')
      fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
      expect(screen.getByRole('status')).toHaveTextContent('attendee')
      fireEvent.click(screen.getByRole('button', { name: 'Log out' }))
      expect(screen.getByRole('status')).toHaveTextContent('signed out')
    } finally {
      spies.forEach((spy) => spy.mockRestore())
    }
  })

  it('syncs a login from another tab and ignores unrelated storage changes', () => {
    render(<AuthProvider><Session /></AuthProvider>)
    act(() => {
      localStorage.setItem('access_token', makeToken({ role: 'organizer' }))
      window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated' }))
    })
    expect(screen.getByRole('status')).toHaveTextContent('signed out')
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'access_token' })))
    expect(screen.getByRole('status')).toHaveTextContent('organizer')
    act(() => {
      localStorage.setItem('access_token', 'corrupt-token')
      window.dispatchEvent(new StorageEvent('storage', { key: 'access_token' }))
    })
    expect(screen.getByRole('status')).toHaveTextContent('signed out')
    expect(localStorage.getItem('access_token')).toBeNull()
  })

  it('cancels the old expiry timer when a new login replaces the session', () => {
    vi.useFakeTimers()
    const now = Math.floor(Date.now() / 1000)
    localStorage.setItem('access_token', makeToken({ exp: now + 2 }))
    render(<AuthProvider><Session token={makeToken({ role: 'organizer', exp: now + 10 })} /></AuthProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    act(() => vi.advanceTimersByTime(3000))
    expect(screen.getByRole('status')).toHaveTextContent('organizer')
    act(() => vi.advanceTimersByTime(8000))
    expect(screen.getByRole('status')).toHaveTextContent('signed out')
    expect(localStorage.getItem('access_token')).toBeNull()
  })

  it('signs out when another tab clears browser storage', () => {
    localStorage.setItem('access_token', makeToken())
    render(<AuthProvider><Session /></AuthProvider>)
    expect(screen.getByRole('status')).toHaveTextContent('attendee')
    act(() => {
      localStorage.clear()
      window.dispatchEvent(new StorageEvent('storage', { key: null }))
    })
    expect(screen.getByRole('status')).toHaveTextContent('signed out')
  })
})
