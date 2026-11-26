import { useEffect, useState } from 'react'

export function useAdminQuery(load, args = [], enabled = true) {
  const [revision, setRevision] = useState(0)
  const [response, setResponse] = useState(null)
  const key = JSON.stringify(args)

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    load(JSON.parse(key), controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setResponse({ key, revision, data })
      },
      (error) => {
        if (!controller.signal.aborted) setResponse({ key, revision, error })
      },
    )
    return () => controller.abort()
  }, [load, key, revision, enabled])

  const current = enabled && response?.key === key && response?.revision === revision ? response : null
  return {
    data: current?.data, error: current?.error, loading: enabled && !current,
    reload: () => setRevision((value) => value + 1),
  }
}
