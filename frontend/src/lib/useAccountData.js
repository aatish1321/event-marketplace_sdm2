import { useEffect, useState } from 'react'
import { ApiError } from '../api/auth'

// Call inside a component keyed by session token so old account data cannot flash.
export default function useAccountData(loader, token, logout) {
  const [request, setRequest] = useState({ offset: 0, revision: 0 })
  const [state, setState] = useState({ request: null, data: null, error: false })
  useEffect(() => {
    const controller = new AbortController()
    loader(token, { offset: request.offset, signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) setState({ request, data, error: false })
    }).catch((error) => {
      if (controller.signal.aborted) return
      if (error instanceof ApiError && [401, 403].includes(error.status)) logout()
      else setState({ request, data: null, error: true })
    })
    return () => controller.abort()
  }, [loader, token, logout, request])
  const loading = state.request !== request
  return {
    loading, data: loading ? null : state.data, error: !loading && state.error,
    refresh: () => setRequest((previous) => ({ ...previous, revision: previous.revision + 1 })),
    setOffset: (offset) => setRequest((previous) => ({ offset, revision: previous.revision + 1 })),
  }
}
