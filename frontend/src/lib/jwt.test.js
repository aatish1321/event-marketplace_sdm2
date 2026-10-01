import { describe, expect, it } from 'vitest'
import { makeToken } from '../test/authFixtures'
import { decodeToken } from './jwt'

describe('decodeToken', () => {
  it.each(['attendee', 'organizer', 'admin'])('accepts a current %s token', (role) => {
    expect(decodeToken(makeToken({ role }))).toMatchObject({ user_id: 'user-123', role })
  })

  it.each([
    null, '', 'junk', 'header.payload', 'header.###.signature',
    `header.${btoa('null')}.signature`, `header.${btoa('[]')}.signature`,
    makeToken({ exp: 0 }), makeToken({ exp: '9999999999' }),
    makeToken({ exp: null }), makeToken({ user_id: '' }),
    makeToken({ role: 'root' }), makeToken({ role: null }),
  ])('rejects invalid token %s', (token) => {
    expect(decodeToken(token)).toBeNull()
  })
})
