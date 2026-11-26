import { ArrowRight, Check, Clock3, MapPin, ShoppingBag, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ResponsiveImage } from '../components/ResponsiveImage'
import { productImages } from '../features/catalog/productImages'
import { getShop } from '../features/catalog/shops.js'
import { formatPrice, lineDetails, lineKey } from '../features/cart/cart.js'
import { useCart } from '../features/cart/cartState.js'
import { orderLimits, prepareOrder } from '../features/checkout/order.js'
import { formatShopHours, pickupOptions } from '../features/checkout/pickup.js'
import './checkout.css'

const emptyDraft = { name: '', phone: '', comment: '', timing: 'asap', pickupAt: '' }
const errorTargets = { shop: 'checkout-shop', cart: 'checkout-cart-edit', pickup: 'checkout-pickup', name: 'checkout-name', phone: 'checkout-phone', comment: 'checkout-comment' }
const unavailablePickupCopy = {
  'before-opening': 'Кав’ярня ще зачинена. Можна обрати час після відкриття.',
  closed: 'Кав’ярня вже зачинена. Оберіть іншу кав’ярню, щоб переглянути доступний час.',
  'no-time': 'До закриття залишилося замало часу на приготування. Оберіть іншу кав’ярню.',
}

function FieldError({ field, message }) {
  return message ? <p id={`checkout-error-${field}`} className="checkout-error">{message}</p> : null
}

function PickupFields({ pickup, timing, pickupAt, update, error }) {
  const staleSlot = pickupAt && !pickup.slots.some((slot) => slot.at === pickupAt)
  const selectedTiming = timing === 'scheduled' && pickup.slots.length > 0

  return (
    <fieldset id="checkout-pickup" tabIndex={-1} className="checkout-block checkout-pickup" aria-describedby={error ? 'checkout-error-pickup' : undefined}>
      <legend><Clock3 size={21} aria-hidden="true" /> Час отримання</legend>
      <p className="checkout-help">Самовивіз сьогодні за київським часом. Готовність має підтвердити кав’ярня.</p>
      {unavailablePickupCopy[pickup.status] && <p className="pickup-state">{unavailablePickupCopy[pickup.status]}</p>}
      {Boolean(pickup.asap || pickup.slots.length) && (
        <div className="checkout-timing">
          <label>
            <input type="radio" name="timing" checked={timing === 'asap'} disabled={!pickup.asap} onChange={() => update('timing', 'asap')} />
            <span>Якнайшвидше{pickup.asap && <small>Орієнтовно з {pickup.asap.label}</small>}</span>
          </label>
          <label>
            <input type="radio" name="timing" checked={timing === 'scheduled'} disabled={!pickup.slots.length} onChange={() => update('timing', 'scheduled')} />
            <span>Обрати час{!pickup.slots.length && <small>Інтервалів більше немає</small>}</span>
          </label>
        </div>
      )}
      {selectedTiming && (
        <label className="checkout-field">
          <span>Час самовивозу</span>
          <select value={pickupAt} onChange={(event) => update('pickupAt', event.target.value)}
            aria-invalid={Boolean(error)} aria-describedby={error ? 'checkout-error-pickup' : undefined} required>
            <option value="">Оберіть доступний час</option>
            {staleSlot && <option value={pickupAt} disabled>Обраний час уже недоступний</option>}
            {pickup.slots.map(({ at, label }) => <option key={at} value={at}>{label}</option>)}
          </select>
        </label>
      )}
      <FieldError field="pickup" message={error} />
    </fieldset>
  )
}

function OrderSummary({ lines, error, reviewed, openCart }) {
  const details = lines.map((line) => ({ line, ...lineDetails(line) }))
  const total = details.reduce((amount, item) => amount + item.total, 0)

  return (
    <aside className="checkout-summary" aria-labelledby="checkout-summary-title">
      <div className="checkout-summary-heading">
        <h2 id="checkout-summary-title">Ваше замовлення</h2>
        <button id="checkout-cart-edit" type="button" className="checkout-text-button" onClick={openCart} aria-haspopup="dialog">
          Редагувати кошик
        </button>
      </div>
      <ul className="checkout-items">
        {details.map(({ line, product, variant, modifiers, total: lineTotal }) => {
          const options = [variant.name, ...modifiers.map((option) => option.name)].filter(Boolean)
          return (
            <li key={lineKey(line)} className="checkout-item">
              <ResponsiveImage sources={productImages(product)} sizes="54px" alt="" />
              <div><h3>{product.name} <span>× {line.quantity}</span></h3>{options.length > 0 && <p>{options.join(' · ')}</p>}</div>
              <strong>{formatPrice(lineTotal)}</strong>
            </li>
          )
        })}
      </ul>
      <p className="checkout-total"><span>Разом</span><strong>{formatPrice(total)}</strong></p>
      <p className="checkout-payment"><Wallet size={19} aria-hidden="true" /> Оплата при отриманні</p>
      <FieldError field="cart" message={error} />
      <button form="checkout-form" type="submit" className="button button-primary">Перевірити замовлення <ArrowRight size={19} aria-hidden="true" /></button>
      <p className="checkout-reviewed" role="status">
        {reviewed && <><Check size={18} aria-hidden="true" /> Дані перевірено.</>}
      </p>
      <button type="button" className="button button-secondary checkout-confirm" disabled aria-describedby="checkout-unavailable">
        Підтвердити замовлення
      </button>
      <p className="checkout-help" id="checkout-unavailable">Підтвердження стане доступним після підключення системи замовлень.</p>
    </aside>
  )
}

export function Component() {
  const { shopId, lines, showPanel } = useCart()
  const [draft, setDraft] = useState(emptyDraft)
  const [now, setNow] = useState(() => new Date())
  const [review, setReview] = useState(null)
  const shop = getShop(shopId)
  const pickup = pickupOptions(shop, now)
  const timing = draft.timing === 'asap' && !pickup.asap && pickup.slots.length ? 'scheduled' : draft.timing
  const sameOrder = review?.lines === lines && review.shopId === shopId
  const errors = sameOrder ? review.errors : {}
  const selectedTimeAvailable = timing === 'asap' ? Boolean(pickup.asap) : pickup.slots.some((item) => item.at === draft.pickupAt)
  const reviewed = sameOrder && review.passed && selectedTimeAvailable

  useEffect(() => {
    const refreshClock = () => setNow(new Date())
    const timer = window.setInterval(refreshClock, 30_000)
    window.addEventListener('focus', refreshClock)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshClock)
    }
  }, [])

  function update(field, value) {
    setDraft((previous) => ({
      ...previous,
      [field]: value,
      ...(field === 'pickupAt' && { timing: 'scheduled' }),
    }))
    if (review) {
      const remainingErrors = { ...review.errors }
      delete remainingErrors[field === 'timing' || field === 'pickupAt' ? 'pickup' : field]
      setReview({ ...review, errors: remainingErrors, passed: false })
    }
  }

  function checkOrder(event) {
    event.preventDefault()
    const checkedAt = new Date()
    const result = prepareOrder({ ...draft, timing, shopId, lines }, checkedAt)
    setNow(checkedAt)
    setReview({ lines, shopId, errors: result.errors, passed: Boolean(result.payload) })

    const firstError = ['shop', 'pickup', 'name', 'phone', 'comment', 'cart'].find((field) => result.errors[field])
    if (firstError) requestAnimationFrame(() => document.getElementById(errorTargets[firstError])?.focus())
  }

  return (
    <div className="container checkout-page">
      <div className="checkout-heading">
        <h1>Оформлення<span>.</span></h1>
        <p>Самовивіз із кав’ярні BLACK BEAN.</p>
      </div>
      {lines.length ? (
        <div className="checkout-grid">
          <form id="checkout-form" className="checkout-form" noValidate onSubmit={checkOrder}>
            <section className="checkout-block" aria-labelledby="checkout-location-title">
              <h2 id="checkout-location-title"><MapPin size={21} aria-hidden="true" /> Кав’ярня</h2>
              <div className="checkout-location">
                {shop && <p><strong>BLACK BEAN — {shop.name}</strong><small>Щодня, {formatShopHours(shop)}</small></p>}
                <button id="checkout-shop" className="checkout-text-button" type="button" aria-haspopup="dialog" onClick={() => showPanel('shops')}>
                  {shop ? 'Змінити' : 'Обрати кав’ярню'}
                </button>
              </div>
              <FieldError field="shop" message={errors.shop} />
            </section>
            <PickupFields pickup={pickup} timing={timing} pickupAt={draft.pickupAt} update={update} error={errors.pickup} />
            <fieldset className="checkout-block checkout-contact">
              <legend>Контактні дані</legend>
              <div className="checkout-contact-grid">
                <div className="checkout-field">
                  <label htmlFor="checkout-name">Ім’я</label>
                  <input id="checkout-name" autoComplete="given-name" value={draft.name} maxLength={orderLimits.name} required
                    aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'checkout-error-name' : undefined}
                    onChange={(event) => update('name', event.target.value)} />
                  <FieldError field="name" message={errors.name} />
                </div>
                <div className="checkout-field">
                  <label htmlFor="checkout-phone">Номер телефону</label>
                  <input id="checkout-phone" type="tel" autoComplete="tel" value={draft.phone} maxLength={orderLimits.phone} required
                    placeholder="+380" aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? 'checkout-error-phone' : undefined}
                    onChange={(event) => update('phone', event.target.value)} />
                  <FieldError field="phone" message={errors.phone} />
                </div>
              </div>
              <div className="checkout-field checkout-comment">
                <label htmlFor="checkout-comment">Коментар <span>необов’язково</span></label>
                <textarea id="checkout-comment" value={draft.comment} maxLength={orderLimits.comment} rows={3}
                  aria-invalid={Boolean(errors.comment)} aria-describedby={errors.comment ? 'checkout-error-comment' : undefined}
                  onChange={(event) => update('comment', event.target.value)} />
                <FieldError field="comment" message={errors.comment} />
              </div>
            </fieldset>
          </form>
          <OrderSummary lines={lines} error={errors.cart} reviewed={reviewed} openCart={() => showPanel('cart')} />
        </div>
      ) : (
        <section className="checkout-empty" aria-labelledby="checkout-empty-heading">
          <ShoppingBag size={36} strokeWidth={1.55} aria-hidden="true" />
          <h2 id="checkout-empty-heading">Кошик порожній</h2>
          <p>Оберіть напій або десерт у меню, щоб підготувати замовлення.</p>
          <Link className="button button-primary" to="/menu">Перейти до меню <ArrowRight size={19} aria-hidden="true" /></Link>
        </section>
      )}
    </div>
  )
}
