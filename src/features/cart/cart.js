import { getProduct, modifierGroups } from '../catalog/catalog.js'
import { getShop, isAvailable, shops } from '../catalog/shops.js'

export const MAX_QUANTITY = 20
export const STORAGE_KEY = 'black-bean-cart'
const storageVersion = 1
const currency = new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function formatPrice(amount) {
  return currency.format(amount / 100)
}

export function defaultLine(product) {
  return { productId: product.id, variantId: product.variants[0].id, modifierIds: [], quantity: 1 }
}

function resolveLine(line) {
  if (!line || !Array.isArray(line.modifierIds) ||
    !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_QUANTITY) return null

  const product = getProduct(line.productId)
  const variant = product?.variants.find((option) => option.id === line.variantId)
  if (!variant) return null

  const modifiers = []
  const usedGroups = new Set()
  for (const id of line.modifierIds) {
    const groupId = product.groups.find((group) => modifierGroups[group].options.some((option) => option.id === id))
    if (!groupId || usedGroups.has(groupId)) return null

    usedGroups.add(groupId)
    modifiers.push(modifierGroups[groupId].options.find((option) => option.id === id))
  }
  return { product, variant, modifiers }
}

export function normalizeLine(line) {
  if (!resolveLine(line)) return null
  const { productId, variantId, modifierIds, quantity } = line
  return { productId, variantId, modifierIds: [...modifierIds].sort(), quantity }
}

export function lineKey({ productId, variantId, modifierIds }) {
  return [productId, variantId, ...[...modifierIds].sort()].join(':')
}

export function lineDetails(line) {
  const details = resolveLine(line)
  if (!details) return null
  const { product, variant, modifiers } = details
  const unitPrice = product.price + variant.price + modifiers.reduce((total, option) => total + option.price, 0)
  return { ...details, unitPrice, total: unitPrice * line.quantity }
}

export function addLine(lines, candidate) {
  const line = normalizeLine(candidate)
  if (!line) return { lines, added: 0 }

  const key = lineKey(line)
  const existing = lines.find((item) => lineKey(item) === key)
  const added = Math.min(line.quantity, MAX_QUANTITY - (existing?.quantity ?? 0))
  if (!added) return { lines, added }
  if (!existing) return { lines: [...lines, line], added }

  return {
    lines: lines.map((item) => item === existing ? { ...item, quantity: item.quantity + added } : item),
    added,
  }
}

export function unavailableLines(lines, shopId) {
  return lines.filter((line) => !isAvailable(line.productId, shopId))
}

export function restoreCart(raw) {
  const empty = { shopId: shops[0].id, lines: [] }
  try {
    const saved = JSON.parse(raw)
    if (saved?.version !== storageVersion || !getShop(saved.shopId) || !Array.isArray(saved.lines)) return empty

    const lines = saved.lines.reduce((restored, line) => {
      if (!isAvailable(line?.productId, saved.shopId)) return restored
      return addLine(restored, line).lines
    }, [])
    return { shopId: saved.shopId, lines }
  } catch {
    return empty
  }
}

export function serializeCart({ shopId, lines }) {
  const savedLines = lines.map(({ productId, variantId, modifierIds, quantity }) => ({ productId, variantId, modifierIds, quantity }))
  return JSON.stringify({ version: storageVersion, shopId, lines: savedLines })
}
