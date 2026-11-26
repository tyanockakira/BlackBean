import assert from 'node:assert/strict'
import test from 'node:test'
import { getProduct } from '../features/catalog/catalog.js'
import { getShop } from '../features/catalog/shops.js'
import { defaultLine } from '../features/cart/cart.js'
import { normalizePhone, orderLimits, prepareOrder } from '../features/checkout/order.js'
import { pickupOptions } from '../features/checkout/pickup.js'

const now = new Date('2026-11-26T12:00:00Z')
const podil = getShop('podil')
const configured = {
  ...defaultLine(getProduct('flat-white')),
  variantId: 'ml-250',
  modifierIds: ['vanilla-syrup', 'oat-milk'],
  quantity: 2,
}
const draft = { shopId: podil.id, lines: [configured], name: '  Лук’ян  Дорош-Вишня  ', phone: '050 000 00 00', comment: '  Тест  ', timing: 'asap' }

test('calculates today’s Kyiv slots and at least 15 minutes of preparation', () => {
  const morning = pickupOptions(podil, new Date('2026-11-26T06:01:15Z'))
  assert.equal(morning.asap.label, '08:17')
  assert.deepEqual(morning.slots[0], { label: '08:30', at: '2026-11-26T06:30:00.000Z' })
  assert.equal(morning.slots.at(-1).label, '19:45')
  assert.equal(morning.slots.length, (19 * 60 + 45 - 8 * 60 - 30) / 15 + 1)
})

test('applies Kyiv daylight saving time even before opening on the transition day', () => {
  const morning = pickupOptions(podil, new Date('2026-03-29T00:30:00Z'))
  assert.equal(morning.status, 'before-opening')
  assert.equal(morning.asap, null)
  assert.deepEqual(morning.slots[0], { label: '08:15', at: '2026-03-29T05:15:00.000Z' })
})

test('handles closing and checks each shop’s own hours', () => {
  const nearClosing = new Date('2026-11-26T17:44:00Z')
  const soon = pickupOptions(podil, nearClosing)
  assert.equal(soon.asap.label, '19:59')
  assert.deepEqual(soon.slots, [])
  assert.equal(pickupOptions(podil, new Date('2026-11-26T17:45:00Z')).status, 'no-time')
  assert.equal(pickupOptions(podil, new Date('2026-11-26T18:00:00Z')).status, 'closed')
  assert.equal(pickupOptions(getShop('center'), new Date('2026-11-26T18:00:00Z')).status, 'open')
})

test('normalizes Ukrainian phone formats and rejects foreign or malformed numbers', () => {
  for (const phone of ['0500000000', '+38 (050) 000-00-00', '380500000000']) assert.equal(normalizePhone(phone), '+380500000000')
  for (const phone of ['+12025550199', '05000000', '050000000x', null]) assert.equal(normalizePhone(phone), null)
})

test('creates an API payload from valid configuration identifiers and normalized contacts', () => {
  const { payload, errors } = prepareOrder({ ...draft, price: 1, lines: [{ ...configured, price: 1 }] }, now)
  assert.deepEqual(errors, {})
  assert.deepEqual(payload, {
    shopId: 'podil',
    items: [{ ...configured, modifierIds: ['oat-milk', 'vanilla-syrup'] }],
    pickup: { method: 'pickup', timing: 'asap', at: '2026-11-26T12:15:00.000Z' },
    contact: { name: 'Лук’ян Дорош-Вишня', phone: '+380500000000' },
    comment: 'Тест',
  })
  assert.equal('comment' in prepareOrder({ ...draft, comment: '' }, now).payload, false)
})

test('rejects incomplete fields, invalid configurations and unavailable products', () => {
  const incomplete = prepareOrder({ shopId: 'unknown', name: ' ', phone: '123', comment: 'а'.repeat(orderLimits.comment + 1) }, now)
  assert.deepEqual(Object.keys(incomplete.errors), ['shop', 'cart', 'name', 'phone', 'comment'])
  assert.equal(incomplete.payload, null)
  assert.ok(prepareOrder({ ...draft, shopId: 'center' }, now).errors.cart)
  assert.ok(prepareOrder({ ...draft, lines: [{ ...configured, variantId: 'unknown' }] }, now).errors.cart)
})

test('accepts a listed slot and rejects passed, non-grid and other-day selections', () => {
  const selected = pickupOptions(podil, now).slots[0]
  const timedDraft = { ...draft, timing: 'scheduled', pickupAt: selected.at }
  assert.equal(prepareOrder(timedDraft, now).payload.pickup.at, selected.at)
  assert.ok(prepareOrder(timedDraft, new Date('2026-11-26T12:01:00Z')).errors.pickup)
  assert.ok(prepareOrder({ ...timedDraft, pickupAt: '2026-11-26T12:19:00Z' }, now).errors.pickup)
  assert.ok(prepareOrder({ ...timedDraft, pickupAt: '2026-11-27T12:15:00Z' }, now).errors.pickup)
})
