export function bonusLimit(subtotal, balance) {
  return Math.min(balance, Math.floor(subtotal * 30 / 100))
}

export function expectedBonus(subtotal) {
  return Math.floor(subtotal * 5 / 100)
}

export function parseBonusAmount(value) {
  const text = value.trim()
  if (!text) return 0
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(text)
  if (!match) return null
  const amount = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  return Number.isSafeInteger(amount) ? amount : null
}
