import { createHash } from 'node:crypto'

const siteverifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const testSecretPattern = /^[123]x0{31}AA$/
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const checkoutErrors = new Set([
  'INVALID_ORDER', 'INVALID_CONTACT', 'INVALID_NAME', 'INVALID_PHONE', 'INVALID_COMMENT',
  'UNKNOWN_SHOP', 'INVALID_ITEMS', 'INVALID_ITEM', 'INVALID_QUANTITY', 'INVALID_VARIANT',
  'INVALID_MODIFIERS', 'INVALID_PRODUCT', 'PRODUCT_UNAVAILABLE', 'DUPLICATE_ITEM',
  'INVALID_BONUS_AMOUNT', 'INSUFFICIENT_BONUSES', 'INVALID_PICKUP', 'PICKUP_UNAVAILABLE',
  'IDEMPOTENCY_CONFLICT', 'TURNSTILE_REUSED',
])
const responseHeaders = { 'Cache-Control': 'no-store' }
const errorResponse = (error, status) => Response.json({ error }, { status, headers: responseHeaders })

async function readBody(request) {
  const maxBytes = 24 * 1024
  const reader = request.body?.getReader()
  if (!reader) throw new Error('INVALID_REQUEST')
  const chunks = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) throw new Error('INVALID_REQUEST')
      chunks.push(value)
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } finally {
    reader.releaseLock()
  }
}

export function createOrderHandler(env, fetcher = fetch, { local = false } = {}) {
  const api = env.VITE_SUPABASE_URL
  const publicKey = env.VITE_SUPABASE_ANON_KEY
  const serverKey = env.SUPABASE_SERVER_KEY
  const secret = env.TURNSTILE_SECRET_KEY
  const allowedHosts = new Set((env.TURNSTILE_HOSTNAMES ?? '').split(',').map((host) => host.trim().toLowerCase()).filter(Boolean))
  const localTest = local && /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/?$/.test(api) && testSecretPattern.test(secret)
  const configured = api && publicKey && serverKey && secret && (localTest || (
    api.startsWith('https://') && !testSecretPattern.test(secret) && allowedHosts.size > 0
  ))

  const fetchJson = (url, options) => fetcher(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(6500) })
  const postJson = (url, body, headers = {}) => fetchJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })

  return async function submitOrder(request) {
    if (request.method !== 'POST') {
      return Response.json({ error: 'METHOD_NOT_ALLOWED' }, {
        status: 405, headers: { ...responseHeaders, Allow: 'POST' },
      })
    }
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) {
      return errorResponse('INVALID_REQUEST', 415)
    }

    let body
    try {
      body = await readBody(request)
    } catch {
      return errorResponse('INVALID_REQUEST', 400)
    }
    const { token, idempotencyKey, order, bonusKopecks } = body ?? {}
    if (typeof token !== 'string' || !token.trim()) return errorResponse('TURNSTILE_REQUIRED', 403)
    if (token.length > 2048) return errorResponse('TURNSTILE_INVALID', 403)
    if (typeof idempotencyKey !== 'string' || !uuidV4.test(idempotencyKey) || !order
      || typeof order !== 'object' || Array.isArray(order)
      || !Number.isInteger(bonusKopecks) || bonusKopecks < 0 || bonusKopecks > 2147483647) {
      return errorResponse('INVALID_ORDER', 400)
    }
    if (!configured) return errorResponse('ORDER_SERVICE_UNAVAILABLE', 503)
    if (localTest && token !== 'XXXX.DUMMY.TOKEN.XXXX') return errorResponse('TURNSTILE_INVALID', 403)

    let actorId = null
    const auth = request.headers.get('authorization')
    if (auth !== null) {
      if (!/^Bearer [\w.-]+$/i.test(auth)) return errorResponse('AUTH_REQUIRED', 401)
      try {
        const response = await fetchJson(new URL('/auth/v1/user', api), {
          headers: { apikey: publicKey, Authorization: auth },
        })
        if (response.status === 401 || response.status === 403) return errorResponse('AUTH_REQUIRED', 401)
        if (!response.ok) return errorResponse('ORDER_SERVICE_UNAVAILABLE', 503)
        const user = await response.json()
        if (!user?.id) return errorResponse('AUTH_REQUIRED', 401)
        actorId = user.id
      } catch {
        return errorResponse('ORDER_SERVICE_UNAVAILABLE', 503)
      }
    }

    let verification
    try {
      const response = await postJson(siteverifyUrl, { secret, response: token })
      if (!response.ok) return errorResponse('TURNSTILE_UNAVAILABLE', 503)
      verification = await response.json()
    } catch {
      return errorResponse('TURNSTILE_UNAVAILABLE', 503)
    }
    if (verification?.success !== true) {
      const codes = Array.isArray(verification?.['error-codes']) ? verification['error-codes'] : []
      if (codes.includes('timeout-or-duplicate')) return errorResponse('TURNSTILE_REUSED', 403)
      if (codes.some((code) => ['internal-error', 'invalid-input-secret', 'missing-input-secret'].includes(code))) {
        return errorResponse('TURNSTILE_UNAVAILABLE', 503)
      }
      return errorResponse('TURNSTILE_INVALID', 403)
    }
    if (!localTest && (verification.action !== 'place_order'
      || typeof verification.hostname !== 'string' || !allowedHosts.has(verification.hostname.toLowerCase()))) {
      return errorResponse('TURNSTILE_INVALID', 403)
    }

    // Cloudflare uses the same dummy response for every local test challenge.
    const hashInput = localTest ? `${token}:${idempotencyKey.toLowerCase()}` : token
    const tokenHash = createHash('sha256').update(hashInput).digest('hex')
    try {
      const headers = { apikey: serverKey }
      if (!serverKey.startsWith('sb_secret_')) headers.Authorization = 'Bearer ' + serverKey
      const response = await postJson(new URL('/rest/v1/rpc/place_verified_order', api), {
        p_actor_id: actorId,
        p_idempotency_key: idempotencyKey,
        p_order: order,
        p_bonus_kopecks: bonusKopecks,
        p_token_hash: tokenHash,
      }, headers)
      if (!response.ok) return errorResponse('ORDER_SERVICE_UNAVAILABLE', 503)
      const result = await response.json()
      if (checkoutErrors.has(result?.error)) {
        return errorResponse(result.error, result.error === 'TURNSTILE_REUSED' ? 403 : 409)
      }
      if (result?.receipt?.orderId) return Response.json(result.receipt, { headers: responseHeaders })
      return errorResponse('ORDER_SERVICE_UNAVAILABLE', 503)
    } catch {
      return errorResponse('ORDER_SERVICE_UNAVAILABLE', 503)
    }
  }
}

export default { fetch: createOrderHandler(process.env) }
