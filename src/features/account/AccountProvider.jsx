import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { AccountContext } from './accountContext.js'
import { loadProfile } from './accountApi.js'

export function AccountProvider({ children, withProfile = true }) {
  const [session, setSession] = useState(undefined)
  const [profileQuery, setProfileQuery] = useState(null)
  const [revision, setRevision] = useState(0)
  const refreshProfile = useCallback(() => setRevision((current) => current + 1), [])
  const user = session?.user ?? null
  const userId = user?.id

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!nextSession) setProfileQuery(null)
      setSession(nextSession)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!withProfile || !userId) return
    const controller = new AbortController()
    loadProfile(userId, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setProfileQuery({ userId, data })
      },
      () => {
        if (!controller.signal.aborted) setProfileQuery((current) => ({
          userId, data: current?.userId === userId ? current.data : undefined, error: true,
        }))
      },
    )
    return () => controller.abort()
  }, [userId, revision, withProfile])

  const ownQuery = profileQuery?.userId === userId ? profileQuery : null

  return (
    <AccountContext.Provider value={{
      user, authLoading: session === undefined,
      profile: ownQuery?.data, profileError: ownQuery?.error, refreshProfile,
    }}>
      {children}
    </AccountContext.Provider>
  )
}
