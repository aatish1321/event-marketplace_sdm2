import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import usePageTitle, { SITE_TITLE } from './usePageTitle'

function Page({ title }) {
  usePageTitle(title)
  return null
}

describe('usePageTitle', () => {
  it('names the screen in the browser tab', () => {
    render(<Page title="Discover events" />)
    expect(document.title).toBe('Discover events · Eventify')
  })

  it('falls back to the site title', () => {
    render(<Page title={null} />)
    expect(document.title).toBe(SITE_TITLE)
  })
})
