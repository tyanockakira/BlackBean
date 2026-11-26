import { getShop } from '../catalog/shops.js'
import { normalizeLine, unavailableLines } from '../cart/cart.js'
import { pickupDateKeys, pickupOptions } from './pickup.js'

export const orderLimits = { name: 70, phone: 30, comment: 300 }

export function normalizePhone(value) {
  if (typeof value !== 'string') return null
  const compact = value.trim().replace(/[\s()\u2010\u2011-]/g, '')
  const match = /^(?:\+?38)?(0\d{9})$/.exec(compact)
  return match ? `+38${match[1]}` : null
}

export function prepareOrder({ shopId, lines = [], name = '', phone = '', comment = '', timing, pickupAt, date = 'today' }, now) {
  const errors = {}
  const shop = getShop(shopId)
  const cleanName = name.trim().replace(/\s+/g, ' ')
  const cleanPhone = normalizePhone(phone)
  const cleanComment = comment.trim()
  const cleanLines = lines.map(normalizeLine)

  if (!shop) errors.shop = 'Оберіть кав’ярню для самовивозу.'
  if (!lines.length) errors.cart = 'Додайте в кошик хоча б одну позицію.'
  else if (cleanLines.some((line) => !line)) errors.cart = 'Перевірте налаштування позицій у кошику.'
  else if (shop && unavailableLines(cleanLines, shop.id).length) errors.cart = 'Деяких позицій немає у вибраній кав’ярні. Перегляньте кошик.'

  if (!/\p{L}/u.test(cleanName)) errors.name = 'Вкажіть своє ім’я.'
  else if (cleanName.length > orderLimits.name) errors.name = `Ім’я має містити до ${orderLimits.name} символів.`
  if (!cleanPhone || phone.length > orderLimits.phone) errors.phone = 'Вкажіть український номер телефону, наприклад 0XX XXX XX XX.'
  if (cleanComment.length > orderLimits.comment) errors.comment = `Коментар має містити до ${orderLimits.comment} символів.`

  const dateKey = pickupDateKeys(now)[date]
  const pickup = pickupOptions(shop, now, dateKey)
  if (!dateKey) errors.pickup = 'Оберіть сьогодні або завтра.'
  if (date === 'tomorrow' && timing === 'asap') errors.pickup = 'На завтра доступний вибір конкретного часу.'
  const selected = timing === 'asap' ? pickup.asap
    : timing === 'scheduled' ? pickup.slots.find((slot) => slot.at === pickupAt) : null
  if (shop && !selected && !errors.pickup) {
    errors.pickup = !pickup.slots.length && !pickup.asap
      ? 'На обрану дату немає доступних інтервалів.'
      : 'Оберіть доступний час отримання.'
  }

  if (Object.keys(errors).length) return { errors, payload: null }

  return {
    errors,
    payload: {
      shopId,
      items: cleanLines,
      pickup: { method: 'pickup', timing, at: selected.at },
      contact: { name: cleanName, phone: cleanPhone },
      ...(cleanComment && { comment: cleanComment }),
    },
  }
}
