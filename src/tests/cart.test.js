import assert from 'node:assert/strict'
import test from 'node:test'
import { getProduct } from '../features/catalog/catalog.js'
import { addLine, defaultLine, lineDetails, lineKey, normalizeLine, restoreCart, serializeCart, unavailableLines } from '../features/cart/cart.js'

const flatWhite = defaultLine(getProduct('flat-white'))
const configured = { ...flatWhite, variantId: 'ml-250', modifierIds: ['oat-milk', 'vanilla-syrup', 'extra-shot'], quantity: 2 }

test('prices the selected volume, allowed modifiers and quantity in cents', () => {
  assert.equal(lineDetails(flatWhite).total, 11000)
  assert.equal(lineDetails(configured).unitPrice, 19000)
  assert.equal(lineDetails(configured).total, 38000)
})

test('merges the same configuration in any option order and keeps distinct configurations separate', () => {
  const reordered = { ...configured, modifierIds: [...configured.modifierIds].reverse() }
  assert.equal(lineKey(configured), lineKey(reordered))
  const first = addLine([], configured)
  const merged = addLine(first.lines, reordered)
  const { lines } = addLine(merged.lines, flatWhite)
  assert.deepEqual(lines.map(({ quantity }) => quantity), [4, 1])
})

test('merging caps each line at 20 and reports how many items fit', () => {
  const first = addLine([], { ...flatWhite, quantity: 19 })
  const partial = addLine(first.lines, { ...flatWhite, quantity: 4 })
  assert.equal(partial.added, 1)
  assert.equal(partial.lines[0].quantity, 20)
  assert.equal(addLine(partial.lines, flatWhite).added, 0)
  for (const quantity of [0, -1, 1.5, '3', 21]) assert.equal(normalizeLine({ ...flatWhite, quantity }), null)
})

test('rejects unknown, conflicting and recipe-incompatible options', () => {
  assert.equal(normalizeLine({ ...flatWhite, modifierIds: ['oat-milk', 'almond-milk'] }), null)
  assert.equal(normalizeLine({ ...flatWhite, variantId: 'ml-500' }), null)
  assert.equal(normalizeLine({ ...flatWhite, productId: 'unknown' }), null)
  assert.equal(normalizeLine({ ...flatWhite, modifierIds: ['unknown'] }), null)
  assert.equal(normalizeLine({ ...defaultLine(getProduct('matcha-latte')), modifierIds: ['extra-shot'] }), null)
  assert.equal(normalizeLine({ ...defaultLine(getProduct('brownie')), modifierIds: ['vanilla-syrup'] }), null)
})

test('restores a validated versioned cart and recalculates stored prices', () => {
  const cart = { shopId: 'podil', lines: [{ ...configured, price: 1, personal: 'discard' }, { ...flatWhite, quantity: 21 }] }
  const stored = serializeCart(cart)
  assert.equal(stored.includes('price') || stored.includes('personal'), false)
  const restored = restoreCart(JSON.stringify({ version: 1, ...cart }))
  assert.deepEqual(restored, { shopId: 'podil', lines: [normalizeLine(configured)] })
  assert.equal(lineDetails(restored.lines[0]).total, 38000)
  assert.deepEqual(restoreCart(serializeCart(restored)), restored)
})

test('recovers from corruption and rejects stale versions and invalid shop ids', () => {
  const empty = { shopId: 'podil', lines: [] }
  for (const data of [null, '{', 'null', '{"version":0}', '{"version":1,"shopId":"__proto__","lines":[]}']) {
    assert.deepEqual(restoreCart(data), empty)
  }
})

test('checks availability when changing shops and drops unavailable lines from restored data', () => {
  const brownie = defaultLine(getProduct('brownie'))
  assert.deepEqual(unavailableLines([flatWhite, brownie], 'center'), [flatWhite])
  assert.deepEqual(restoreCart(serializeCart({ shopId: 'center', lines: [flatWhite, brownie] })),
    { shopId: 'center', lines: [brownie] })
})
