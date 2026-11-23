import { useEffect } from 'react'

export const SITE_TITLE = "Eventify · Tickets for what's on"

// Sets the browser tab title for a screen; no title means the site default.
export default function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Eventify` : SITE_TITLE
  }, [title])
}
