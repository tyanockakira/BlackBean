import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { createOrderHandler } from '../../api/place-order.js'

const env = {
  VITE_SUPABASE_URL: 'https://blackbean.example',
  VITE_SUPABASE_ANON_KEY: 'sb_publishable_test_fixture',
  SUPABASE_SERVER_KEY: 'sb_secret_test_fixture',
  TURNSTILE_SECRET_KEY: 'production-like-test-fixture',
  TURNSTILE_HOSTNAMES: 'coffee.example',
}
const validVerification = { success: true, hostname: 'coffee.example', action: 'place_order' }
const validUser = randomUUID()
const order = { shopId: 'center' }

function request(values = {}, headers = {}) {
  return new Request('https://coffee.example/api/place-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ idempotencyKey: randomUUID(), order, bonusKopecks: 0, token: 'turnstile-response', ...values }),
  })
}

async function checkFailure(response, status, error) {
  assert.equal(response.status, status)
  assert.deepEqual(await response.json(), { error })
}

test('missing and oversized CAPTCHA values do not call either upstream service', async () => {
  const submit = createOrderHandler(env, () => assert.fail('Unexpected fetch'))
  await checkFailure(await submit(request({ token: undefined })), 403, 'TURNSTILE_REQUIRED')
  await checkFailure(await submit(request({ token: 'x'.repeat(2049) })), 403, 'TURNSTILE_INVALID')
})

test('Siteverify rejects invalid, expired or spent tokens and tokens for other actions or hosts', async () => {
  const cases = [
    [{ success: false, 'error-codes': ['invalid-input-response'] }, 'TURNSTILE_INVALID'],
    [{ success: false, 'error-codes': ['timeout-or-duplicate'] }, 'TURNSTILE_REUSED'],
    [{ ...validVerification, action: 'another_form' }, 'TURNSTILE_INVALID'],
    [{ ...validVerification, hostname: 'other.example' }, 'TURNSTILE_INVALID'],
  ]
  for (const [verification, code] of cases) {
    const submit = createOrderHandler(env, async (url) => {
      assert.equal(new URL(url).hostname, 'challenges.cloudflare.com')
      return Response.json(verification)
    })
    await checkFailure(await submit(request()), 403, code)
  }
})

test('Siteverify downtime and dummy server keys fail closed in the hosted handler', async () => {
  const unavailable = createOrderHandler(env, async () => { throw new Error('Network') })
  await checkFailure(await unavailable(request()), 503, 'TURNSTILE_UNAVAILABLE')
  const dummy = createOrderHandler({ ...env, TURNSTILE_SECRET_KEY: '1x' + '0'.repeat(31) + 'AA' },
    () => assert.fail('Hosted runtime must reject test keys'))
  await checkFailure(await dummy(request()), 503, 'ORDER_SERVICE_UNAVAILABLE')
})

test('the always-pass local test secret still requires the documented dummy token', async () => {
  const submit = createOrderHandler({
    ...env, VITE_SUPABASE_URL: 'http://127.0.0.1:56321',
    TURNSTILE_SECRET_KEY: '1x' + '0'.repeat(31) + 'AA',
  }, () => assert.fail('Malformed local tokens must not reach the always-pass verifier'), { local: true })
  await checkFailure(await submit(request({ token: 'invalid-test-token' })), 403, 'TURNSTILE_INVALID')
})

test('verified guests and authenticated users reach the same RPC with server-resolved identity', async () => {
  const submitted = []
  const submit = createOrderHandler(env, async (url, options) => {
    const { pathname } = new URL(url)
    if (pathname === '/auth/v1/user') {
      assert.equal(options.headers.Authorization, 'Bearer user-token')
      return Response.json({ id: validUser })
    }
    if (pathname.endsWith('/siteverify')) {
      assert.deepEqual(JSON.parse(options.body), { secret: env.TURNSTILE_SECRET_KEY, response: 'turnstile-response' })
      return Response.json(validVerification)
    }
    assert.equal(pathname, '/rest/v1/rpc/place_verified_order')
    assert.equal(options.headers.apikey, env.SUPABASE_SERVER_KEY)
    const rpc = JSON.parse(options.body)
    assert.match(rpc.p_token_hash, /^[a-f0-9]{64}$/)
    submitted.push(rpc)
    return Response.json({ receipt: { orderId: randomUUID(), orderNumber: 'BB-000001' } })
  })
  assert.equal((await submit(request({ actorId: randomUUID() }))).status, 200)
  assert.equal((await submit(request({ bonusKopecks: 25, actorId: randomUUID() },
    { Authorization: 'Bearer user-token' }))).status, 200)
  assert.equal(submitted[0].p_actor_id, null)
  assert.equal(submitted[1].p_actor_id, validUser)
  assert.equal(submitted[1].p_bonus_kopecks, 25)
  assert.deepEqual(submitted[1].p_order, order)
})

test('a rejected JWT cannot downgrade to a guest request', async () => {
  const submit = createOrderHandler(env, async (url) => {
    assert.equal(new URL(url).pathname, '/auth/v1/user')
    return Response.json({}, { status: 401 })
  })
  await checkFailure(await submit(request({}, { Authorization: 'Bearer invalid' })), 401, 'AUTH_REQUIRED')
})

test('production replay protection keeps the same fingerprint across different orders after successful Siteverify', async () => {
  const used = new Set()
  const submit = createOrderHandler(env, async (url, options) => {
    if (new URL(url).hostname === 'challenges.cloudflare.com') return Response.json(validVerification)
    const { p_token_hash: hash } = JSON.parse(options.body)
    if (used.has(hash)) return Response.json({ error: 'TURNSTILE_REUSED' })
    used.add(hash)
    return Response.json({ receipt: { orderId: randomUUID() } })
  })
  assert.equal((await submit(request())).status, 200)
  await checkFailure(await submit(request()), 403, 'TURNSTILE_REUSED')
})
