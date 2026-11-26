import { ArrowRight, Check, Clock3, MapPin, ShoppingBag, Wallet } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ResponsiveImage } from '../components/ResponsiveImage'
import { useAccount } from '../features/account/accountContext.js'
import { AccountProvider } from '../features/account/AccountProvider.jsx'
import { productImages } from '../features/catalog/productImages'
import { getShop } from '../features/catalog/shops.js'
import { formatPrice, lineDetails, lineKey } from '../features/cart/cart.js'
import { useCart } from '../features/cart/cartState.js'
import { orderLimits, prepareOrder } from '../features/checkout/order.js'
import { bonusLimit, expectedBonus, parseBonusAmount } from '../features/checkout/bonuses.js'
import { formatPickupDate, formatShopHours, pickupDateKeys, pickupOptions } from '../features/checkout/pickup.js'
import { placeOrder } from '../lib/supabase.js'
import { TurnstileWidget } from '../features/checkout/TurnstileWidget.jsx'
import { formatBonus, formatOrderTime } from '../lib/orderPresentation.js'
import './checkout.css'

const emptyDraft = { comment: '', date: 'today', timing: 'asap', pickupAt: '', bonus: '' }
const errorTargets = { shop: 'checkout-shop', cart: 'checkout-cart-edit', pickup: 'checkout-pickup', name: 'checkout-name', phone: 'checkout-phone', comment: 'checkout-comment', bonus: 'checkout-bonus' }
const unavailablePickupCopy = {
  'before-opening': 'Кав’ярня ще зачинена. Можна обрати час після відкриття.',
  closed: 'Кав’ярня вже зачинена. Оберіть іншу кав’ярню, щоб переглянути доступний час.',
  'no-time': 'До закриття залишилося замало часу на приготування. Оберіть іншу кав’ярню.',
}

function FieldError({ field, message }) {
  return message ? <p id={`checkout-error-${field}`} className="checkout-error">{message}</p> : null
}

function PickupFields({ pickup, timing, pickupAt, date, dateKeys, update, error }) {
  const staleSlot = pickupAt && !pickup.slots.some((slot) => slot.at === pickupAt)
  const selectedTiming = timing === 'scheduled' && pickup.slots.length > 0

  return (
    <fieldset id="checkout-pickup" tabIndex={-1} className="checkout-block checkout-pickup" aria-describedby={error ? 'checkout-error-pickup' : undefined}>
      <legend><Clock3 size={21} aria-hidden="true" /> Час отримання</legend>
      <p className="checkout-help">Самовивіз за київським часом. Готовність має підтвердити кав’ярня.</p>
      <div className="checkout-days" role="radiogroup" aria-label="Дата отримання">
        {['today', 'tomorrow'].map((key) => (
          <label key={key}>
            <input type="radio" name="pickup-date" checked={date === key} onChange={() => update('date', key)} />
            <span>{key === 'today' ? 'Сьогодні' : 'Завтра'}<small>{formatPickupDate(dateKeys[key])}</small></span>
          </label>
        ))}
      </div>
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

function OrderSummary({ lines, total, bonuses, error, reviewed, openCart, onConfirm, submitting, submitError, challenge }) {
  const details = lines.map((line) => ({ line, ...lineDetails(line) }))

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
      {bonuses && <div className="checkout-bonuses">
        <h3>Бонуси BLACK BEAN</h3>
        {bonuses.unavailable ? <div className="checkout-bonus-tools">
          <p className="checkout-help" role="status">Баланс недоступний.</p>
          <button className="checkout-text-button" type="button" onClick={bonuses.refresh}>Оновити</button>
        </div> : bonuses.balance === null ? <p className="checkout-help" role="status">Завантажуємо баланс…</p>
          : <p className="checkout-help">Доступно <strong>{formatBonus(bonuses.balance)}</strong>. До 30% вартості замовлення.</p>}
        {(bonuses.limit > 0 || bonuses.value) && <>
          <label className="checkout-field" htmlFor="checkout-bonus">
            <span>Списати бонусами, грн</span>
            <input id="checkout-bonus" form="checkout-form" inputMode="decimal" maxLength={12}
              value={bonuses.value} disabled={submitting}
              aria-invalid={Boolean(bonuses.error)} aria-describedby={bonuses.error ? 'checkout-bonus-limit checkout-error-bonus' : 'checkout-bonus-limit'}
              onChange={(event) => bonuses.setValue(event.target.value)} />
          </label>
          <div className="checkout-bonus-tools">
            <small id="checkout-bonus-limit">До {formatBonus(bonuses.limit)}</small>
            <button className="checkout-text-button" type="button" disabled={submitting || !bonuses.limit}
              onClick={() => bonuses.setValue(String(bonuses.limit / 100).replace('.', ','))}>Використати максимум</button>
          </div>
          <FieldError field="bonus" message={bonuses.error} />
        </>}
        <dl className="checkout-bonus-breakdown">
          <div><dt>Вартість замовлення</dt><dd>{formatPrice(total)}</dd></div>
          <div><dt>Знижка бонусами</dt><dd>{formatBonus(bonuses.applied)}</dd></div>
        </dl>
      </div>}
      <p className="checkout-total"><span>До сплати</span><strong>{formatPrice(total - (bonuses?.applied ?? 0))}</strong></p>
      {bonuses && <p className="checkout-help">Після виконання: +{formatBonus(expectedBonus(total))} бонусами (5%).</p>}
      <p className="checkout-payment"><Wallet size={19} aria-hidden="true" /> Оплата при отриманні</p>
      <FieldError field="cart" message={error} />
      <button form="checkout-form" type="submit" className="button button-primary" disabled={submitting}>Перевірити замовлення <ArrowRight size={19} aria-hidden="true" /></button>
      <p className="checkout-reviewed" role="status">
        {reviewed && <><Check size={18} aria-hidden="true" /> Дані перевірено.</>}
      </p>
      {reviewed && <TurnstileWidget key={challenge.round} onToken={challenge.onToken} />}
      <button type="button" className="button button-secondary checkout-confirm"
        disabled={!reviewed || submitting || !challenge.token} onClick={onConfirm}>
        {submitting ? 'Надсилаємо замовлення…' : 'Підтвердити замовлення'}
      </button>
      {submitError && <p className="checkout-error" role="alert">{submitError}</p>}
    </aside>
  )
}

function Confirmation({ receipt, lines, shop, signedIn }) {
  const details = lines.map((line) => ({ line, ...lineDetails(line) }))
  return (
    <div className="container checkout-success">
      <section className="checkout-confirmation" aria-labelledby="checkout-confirmation-title">
        <div className="checkout-success-intro">
          <p className="eyebrow"><Check size={19} aria-hidden="true" /> Замовлення прийнято</p>
          <h1 id="checkout-confirmation-title">Дякуємо<span>.</span></h1>
          <dl>
            <div><dt>Номер замовлення</dt><dd className="checkout-order-number">{receipt.orderNumber}</dd></div>
            <div><dt>Самовивіз</dt><dd>BLACK BEAN — {shop.name}<br />
              <time dateTime={receipt.pickupAt}>{formatOrderTime(receipt.pickupAt)}</time></dd></div>
          </dl>
        </div>
        <div className="checkout-success-summary">
          <h2>Ваше замовлення</h2>
        <ul className="checkout-items">
          {details.map(({ line, product, variant, modifiers }) => (
            <li key={lineKey(line)} className="checkout-item">
              <div><h3>{product.name} <span>× {line.quantity}</span></h3>
                <p>{[variant.name, ...modifiers.map((option) => option.name)].filter(Boolean).join(' · ')}</p>
              </div>
            </li>
          ))}
        </ul>
        {receipt.bonusUsedKopecks > 0 && <p>Списано бонусами: {formatBonus(receipt.bonusUsedKopecks)}.</p>}
        <p className="checkout-total"><span>До сплати</span><strong>{formatPrice(receipt.totalDueKopecks)}</strong></p>
        {signedIn && <p>Після виконання: +{formatBonus(expectedBonus(receipt.subtotalKopecks))} бонусами (5%).</p>}
        <Link className="button button-primary" to="/menu">Повернутися до меню <ArrowRight size={19} aria-hidden="true" /></Link>
        </div>
      </section>
    </div>
  )
}

function Checkout({ user }) {
  const { profile, profileError, refreshProfile } = useAccount()
  const { shopId, lines, showPanel, clear } = useCart()
  const [draft, setDraft] = useState(emptyDraft)
  const [now, setNow] = useState(() => new Date())
  const [review, setReview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [confirmation, setConfirmation] = useState(null)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [challengeRound, setChallengeRound] = useState(0)
  const submittingRef = useRef(false)
  const shop = getShop(shopId)
  const name = draft.name ?? profile?.display_name ?? ''
  const phone = draft.phone ?? profile?.contact_phone ?? ''
  const total = lines.reduce((amount, line) => amount + lineDetails(line).total, 0)
  const balance = profile && !profileError ? profile.bonus_balance_kopecks : null
  const limit = bonusLimit(total, balance ?? 0)
  const bonus = user ? parseBonusAmount(draft.bonus) : 0
  const validBonus = bonus !== null && bonus <= limit
  const dateKeys = pickupDateKeys(now)
  const todayPickup = pickupOptions(shop, now, dateKeys.today)
  const effectiveDate = draft.date === 'today' && !todayPickup.asap && !todayPickup.slots.length ? 'tomorrow' : draft.date
  const pickup = pickupOptions(shop, now, dateKeys[effectiveDate])
  const timing = effectiveDate === 'tomorrow' ? 'scheduled' : draft.timing === 'asap' && !pickup.asap && pickup.slots.length ? 'scheduled' : draft.timing
  const sameOrder = review?.lines === lines && review.shopId === shopId
  const errors = sameOrder ? review.errors : {}
  const selectedTimeAvailable = timing === 'asap' ? Boolean(pickup.asap) : pickup.slots.some((item) => item.at === draft.pickupAt)
  const reviewed = sameOrder && review.passed && selectedTimeAvailable && validBonus && review.bonus === bonus

  useEffect(() => {
    const refreshClock = () => setNow(new Date())
    const timer = window.setInterval(refreshClock, 30_000)
    window.addEventListener('focus', refreshClock)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshClock)
    }
  }, [])

  if (confirmation) return <Confirmation {...confirmation} />

  function update(field, value) {
    setDraft((previous) => ({
      ...previous,
      [field]: value,
      ...(field === 'pickupAt' && { timing: 'scheduled' }),
      ...(field === 'date' && { timing: value === 'tomorrow' ? 'scheduled' : 'asap', pickupAt: '' }),
    }))
    if (review) {
      const remainingErrors = { ...review.errors }
      delete remainingErrors[['date', 'timing', 'pickupAt'].includes(field) ? 'pickup' : field]
      setReview({ ...review, errors: remainingErrors, passed: false })
    }
    setSubmitError('')
  }

  function checkOrder(event) {
    event.preventDefault()
    setTurnstileToken('')
    setChallengeRound((value) => value + 1)
    const checkedAt = new Date()
    const result = prepareOrder({ ...draft, name, phone, date: effectiveDate, timing, shopId, lines }, checkedAt)
    if (!validBonus) result.errors.bonus = bonus === null
      ? 'Введіть суму з точністю до двох знаків після коми.'
      : `Можна списати до ${formatBonus(limit)}.`
    const payload = result.payload
    if (payload?.pickup.timing === 'asap') delete payload.pickup.at
    const signature = payload && JSON.stringify([payload, bonus])
    setNow(checkedAt)
    setReview({
      lines, shopId, errors: result.errors, passed: Boolean(payload && validBonus), payload, bonus, signature,
      idempotencyKey: signature && review?.signature === signature ? review.idempotencyKey : crypto.randomUUID(),
    })

    const firstError = ['shop', 'pickup', 'name', 'phone', 'comment', 'cart', 'bonus'].find((field) => result.errors[field])
    if (firstError) requestAnimationFrame(() => document.getElementById(errorTargets[firstError])?.focus())
  }

  async function confirmOrder() {
    if (!reviewed || submittingRef.current || !review.payload || !turnstileToken) return
    submittingRef.current = true
    setSubmitting(true)
    setSubmitError('')
    try {
      const receipt = await placeOrder({
        order: review.payload, idempotencyKey: review.idempotencyKey,
        bonusKopecks: review.bonus, token: turnstileToken, userId: user?.id ?? null,
      })
      setConfirmation({ receipt, lines, shop, signedIn: Boolean(user) })
      clear()
    } catch (error) {
      const message = error?.message ?? ''
      const bonusChanged = message.includes('INSUFFICIENT_BONUSES') || message.includes('INVALID_BONUS_AMOUNT')
      const networkError = message === 'ORDER_SERVICE_UNAVAILABLE' || message.includes('Failed to fetch') || message.includes('NetworkError')
      const turnstileError = message.startsWith('TURNSTILE_')
      if (bonusChanged) refreshProfile()
      const copy = turnstileError
        ? message === 'TURNSTILE_UNAVAILABLE' ? 'Сервіс перевірки тимчасово недоступний. Спробуйте ще раз.'
          : 'Перевірку захисту не пройдено. Дочекайтеся нової перевірки й повторіть спробу.'
        : message === 'AUTH_REQUIRED' ? 'Сесію завершено. Оновіть сторінку та увійдіть знову.'
        : bonusChanged
        ? 'Доступна сума бонусів змінилася. Перевірте баланс і вкажіть суму ще раз.'
        : message.includes('PRODUCT_UNAVAILABLE') || message.includes('INVALID_VARIANT') || message.includes('INVALID_MODIFIERS')
        ? 'Меню змінилося. Перевірте позиції та спробуйте ще раз.'
        : message.includes('PICKUP_') || message.includes('INVALID_PICKUP')
          ? 'Обраний час самовивозу вже недоступний. Оберіть новий час.'
          : networkError
            ? 'Не вдалося зв’язатися із сервером. Перевірте підключення та повторіть спробу.'
            : 'Не вдалося оформити замовлення. Перевірте дані та повторіть спробу.'
      if (!networkError && !turnstileError) setReview((previous) => ({ ...previous, passed: false }))
      setSubmitError(copy)
    } finally {
      setTurnstileToken('')
      setChallengeRound((value) => value + 1)
      submittingRef.current = false
      setSubmitting(false)
    }
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
            <PickupFields pickup={pickup} timing={timing} pickupAt={draft.pickupAt} date={effectiveDate} dateKeys={dateKeys} update={update} error={errors.pickup} />
            <fieldset className="checkout-block checkout-contact">
              <legend>Контактні дані</legend>
              <div className="checkout-contact-grid">
                <div className="checkout-field">
                  <label htmlFor="checkout-name">Ім’я</label>
                  <input id="checkout-name" autoComplete="given-name" value={name} maxLength={orderLimits.name} required
                    aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'checkout-error-name' : undefined}
                    onChange={(event) => update('name', event.target.value)} />
                  <FieldError field="name" message={errors.name} />
                </div>
                <div className="checkout-field">
                  <label htmlFor="checkout-phone">Номер телефону</label>
                  <input id="checkout-phone" type="tel" autoComplete="tel" value={phone} maxLength={orderLimits.phone} required
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
          <OrderSummary lines={lines} total={total} error={errors.cart} reviewed={reviewed} openCart={() => showPanel('cart')}
            bonuses={user ? {
              balance, limit, value: draft.bonus, error: errors.bonus, applied: validBonus ? bonus : 0,
              unavailable: profileError, refresh: refreshProfile, setValue: (value) => update('bonus', value),
            } : null}
            onConfirm={confirmOrder} submitting={submitting} submitError={submitError}
            challenge={{ token: turnstileToken, round: challengeRound, onToken: setTurnstileToken }} />
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

function CheckoutPage() {
  const { user, authLoading } = useAccount()
  return authLoading
    ? <div className="container checkout-page"><p role="status">Перевіряємо сесію…</p></div>
    : <Checkout key={user?.id ?? 'guest'} user={user} />
}

export function Component() {
  return <AccountProvider><CheckoutPage /></AccountProvider>
}
