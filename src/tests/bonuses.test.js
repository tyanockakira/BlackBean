import assert from 'node:assert/strict'
import test from 'node:test'
import { bonusLimit, expectedBonus, parseBonusAmount } from '../features/checkout/bonuses.js'

test('estimates earned bonuses from the subtotal and caps spending at the balance or 30%', () => {
  assert.equal(expectedBonus(9501), 475)
  assert.equal(bonusLimit(9501, 12_000), 2850)
  assert.equal(bonusLimit(9501, 475), 475)
  assert.equal(bonusLimit(9501, 0), 0)
})

test('parses bonus amounts as integer kopecks with a decimal comma or point', () => {
  assert.equal(parseBonusAmount(''), 0)
  assert.equal(parseBonusAmount(' 4,75 '), 475)
  assert.equal(parseBonusAmount('0.1'), 10)
  assert.equal(parseBonusAmount('4'), 400)
  for (const input of ['-1', '1e2', '0,001', 'NaN', '100000000000000']) {
    assert.equal(parseBonusAmount(input), null)
  }
})
