import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Не налаштовано підключення до Supabase.')
}

// The SDK uses its storage key for cross-tab events, while sessions belong to each tab.
const authChannel = `black-bean-auth-${crypto.randomUUID()}`
const sessionKey = (key) => `black-bean-auth${key.slice(authChannel.length)}`
const tabStorage = {
  getItem: (key) => window.sessionStorage.getItem(sessionKey(key)),
  setItem: (key, value) => window.sessionStorage.setItem(sessionKey(key), value),
  removeItem: (key) => window.sessionStorage.removeItem(sessionKey(key)),
}

export const supabase = createClient(url, anonKey, {
  auth: { storageKey: authChannel, storage: tabStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})

export async function recoverPassword(email, token, password) {
  const { auth } = createClient(url, anonKey, {
    auth: { storageKey: 'black-bean-recovery', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const verification = await auth.verifyOtp({ email, token, type: 'recovery' })
  if (verification.error) throw verification.error
  try {
    const { error } = await auth.updateUser({ password })
    if (error) throw error
  } finally {
    await auth.signOut({ scope: 'local' })
  }
}

export async function placeOrder({ order, idempotencyKey, bonusKopecks, token, userId }) {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || (session?.user.id ?? null) !== userId) throw new Error('AUTH_REQUIRED')
  const response = await fetch('/api/place-order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session && { Authorization: 'Bearer ' + session.access_token }),
    },
    body: JSON.stringify({ order, idempotencyKey, bonusKopecks, token }),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.orderId) throw new Error(result?.error ?? 'ORDER_SERVICE_UNAVAILABLE')
  return result
}
