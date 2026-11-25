import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../context/AuthContext'
import { makeToken } from '../test/authFixtures'
import AccountSettings from './AccountSettings'
import AdminManagement from './AdminManagement'
import CheckIn from './CheckIn'

const json = (data, status = 200) => ({ ok: status < 400, status, json: async () => data })
const profile = { full_name: 'Original Person', email: 'person@example.com', role: 'attendee', organizer_profile: null }
const page = (results) => ({ results, count: results.length, limit: 20, offset: 0 })

function mount(Component, role, fetch) {
  localStorage.setItem('access_token', makeToken({ role }))
  vi.stubGlobal('fetch', fetch)
  render(<AuthProvider><MemoryRouter><Component /></MemoryRouter></AuthProvider>)
}

describe('Account settings', () => {
  it('loads and saves profile fields without allowing identity changes', async () => {
    const fetch = vi.fn().mockResolvedValue(json(profile))
    mount(AccountSettings, 'attendee', fetch)
    const name = await screen.findByLabelText('Full name')
    await userEvent.clear(name)
    await userEvent.type(name, 'Updated Person')
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }))
    await screen.findByText('Profile saved.')
    const [, options] = fetch.mock.calls.find(([, options]) => options.method === 'PUT')
    expect(JSON.parse(options.body)).toEqual({ full_name: 'Updated Person' })
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
  })

  it('changes the password and clears the session', async () => {
    const fetch = vi.fn().mockResolvedValue(json(profile))
    mount(AccountSettings, 'attendee', fetch)
    await screen.findByLabelText('Full name')
    await userEvent.type(screen.getByLabelText('Current password'), 'current password')
    await userEvent.type(screen.getByLabelText('New password'), 'replacement password')
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'replacement password')
    await userEvent.click(screen.getByRole('button', { name: 'Change password and sign out' }))
    await waitFor(() => expect(localStorage.getItem('access_token')).toBeNull())
    const [url, options] = fetch.mock.calls.find(([, options]) => options.method === 'POST')
    expect(url).toBe('/api/account/password/')
    expect(JSON.parse(options.body)).toEqual({ current_password: 'current password', new_password: 'replacement password' })
  })
})

describe('Guest admission', () => {
  it('submits an admission code and displays the recorded count', async () => {
    const fetch = vi.fn().mockResolvedValue(json({ event_title: 'Community event', checked_in: 1, quantity: 2 }))
    mount(CheckIn, 'organizer', fetch)
    await userEvent.type(screen.getByLabelText('Admission code'), 'signed-code')
    await userEvent.click(screen.getByRole('button', { name: 'Admit guests' }))
    expect(await screen.findByRole('status')).toHaveTextContent('1 of 2 guests checked in')
    expect(screen.getByRole('button', { name: 'Admit guests' })).toBeDisabled()
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ admission_code: 'signed-code', quantity: 1, request_id: expect.any(String) })
  })

  it('shows reused ticket errors without claiming admission succeeded', async () => {
    mount(CheckIn, 'organizer', vi.fn().mockResolvedValue(json({ error: 'Not enough unused admissions remain.' }, 409)))
    await userEvent.type(screen.getByLabelText('Admission code'), 'signed-code')
    await userEvent.click(screen.getByRole('button', { name: 'Admit guests' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Not enough unused admissions remain.')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('Administration', () => {
  it('suspends an account after confirmation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const fetch = vi.fn().mockResolvedValue(json(page([{ id: 'u1', full_name: 'Test Person', email: 'person@example.com', role: 'attendee', active: true }])))
    mount(AdminManagement, 'admin', fetch)
    await userEvent.click(await screen.findByRole('button', { name: 'Suspend account' }))
    await screen.findByText('Change saved.')
    const [url, options] = fetch.mock.calls.find(([, options]) => options.method === 'PUT')
    expect(url).toBe('/api/admin/users/u1/')
    expect(JSON.parse(options.body)).toEqual({ active: false })
    confirm.mockRestore()
  })

  it('loads the event moderation view separately', async () => {
    const fetch = vi.fn(async (url) => json(page(url.startsWith('/api/admin/events/')
      ? [{ id: 'e1', title: 'Community event', status: 'published', moderation_blocked: false }] : [])))
    mount(AdminManagement, 'admin', fetch)
    await userEvent.click(screen.getByRole('button', { name: 'Events', exact: true }))
    expect(await screen.findByRole('heading', { name: 'Community event' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hide event' })).toBeInTheDocument()
  })
})
