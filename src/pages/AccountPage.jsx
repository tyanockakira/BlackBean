import { ArrowRight, Coffee, LogOut, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from '../features/account/accountContext.js'
import { AccountProvider } from '../features/account/AccountProvider.jsx'
import { historyPageSize, loadHistory, saveProfile } from '../features/account/accountApi.js'
import { AuthForm } from '../features/account/AuthForm.jsx'
import { formatPrice } from '../features/cart/cart.js'
import { getShop } from '../features/catalog/shops.js'
import { normalizePhone, orderLimits } from '../features/checkout/order.js'
import { supabase } from '../lib/supabase.js'
import { bonusKinds, formatBonus, formatOrderTime, orderStatuses } from '../lib/orderPresentation.js'
import './account.css'

function DateTime({ value }) {
  return <time dateTime={value}>{formatOrderTime(value)}</time>
}

function ProfileForm({ user, profile }) {
  const { refreshProfile } = useAccount()
  const [name, setName] = useState(profile.display_name ?? '')
  const [phone, setPhone] = useState(profile.contact_phone ?? '')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    const displayName = name.trim().replace(/\s+/g, ' ')
    const normalizedPhone = normalizePhone(phone)
    if (displayName && !/\p{L}/u.test(displayName)) {
      setResult({ error: 'Вкажіть ім’я літерами.' })
      return
    }
    if (phone.trim() && !normalizedPhone) {
      setResult({ error: 'Вкажіть український номер телефону у форматі +380XXXXXXXXX.' })
      return
    }
    setBusy(true)
    setResult(null)
    try {
      await saveProfile(user.id, displayName || null, normalizedPhone)
      setName(displayName)
      setPhone(normalizedPhone ?? '')
      setResult({ saved: true })
      refreshProfile()
    } catch {
      setResult({ error: 'Не вдалося зберегти профіль. Спробуйте ще раз.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="account-form" onSubmit={submit} aria-busy={busy}>
      <label>Ім’я
        <input autoComplete="given-name" maxLength={orderLimits.name} value={name}
          onChange={(event) => { setName(event.target.value); setResult(null) }} disabled={busy} />
      </label>
      <label>Номер телефону
        <input type="tel" autoComplete="tel" maxLength={orderLimits.phone} value={phone}
          onChange={(event) => { setPhone(event.target.value); setResult(null) }} disabled={busy} />
      </label>
      {result?.error && <p className="account-error" role="alert">{result.error}</p>}
      {result?.saved && <p className="account-notice" role="status">Профіль оновлено.</p>}
      <button className="button button-primary" type="submit" disabled={busy}>
        {busy ? 'Зберігаємо…' : 'Зберегти дані'} <ArrowRight size={19} aria-hidden="true" />
      </button>
    </form>
  )
}

function History({ table, userId, children, empty }) {
  const [offset, setOffset] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState({ rows: [], loaded: -1, more: false })
  const [failed, setFailed] = useState(null)
  const error = failed?.offset === offset && failed?.attempt === attempt
  const loading = !error && result.loaded !== offset

  useEffect(() => {
    const controller = new AbortController()
    loadHistory(table, userId, offset, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) {
          setResult((current) => ({
            rows: [...current.rows, ...data.slice(0, historyPageSize)],
            loaded: offset,
            more: data.length > historyPageSize,
          }))
        }
      },
      () => {
        if (!controller.signal.aborted) setFailed({ offset, attempt })
      },
    )
    return () => controller.abort()
  }, [table, userId, offset, attempt])

  return (
    <div aria-busy={loading}>
      {result.rows.length ? children(result.rows) : !loading && !error && empty}
      {loading && <p className="account-muted" role="status">Завантажуємо історію…</p>}
      {error && <div className="account-actions">
        <p className="account-error" role="alert">Не вдалося завантажити історію.</p>
        <button type="button" onClick={() => setAttempt((current) => current + 1)}>Повторити</button>
      </div>}
      {result.more && !loading && !error && <button className="button button-secondary account-more" type="button"
        onClick={() => setOffset((current) => current + historyPageSize)}>Показати ще</button>}
    </div>
  )
}

function OrderHistory({ orders }) {
  return (
    <ul className="account-history">
      {orders.map((order) => (
        <li key={order.id}>
          <details className="account-order">
            <summary>
              <span><strong className="account-money">{order.order_number}</strong>
                <small>{getShop(order.shop_id)?.name ?? 'BLACK BEAN'}</small><DateTime value={order.pickup_at} /></span>
              <span className="account-order-status">{orderStatuses[order.status]}</span>
              <strong className="account-money">{formatPrice(order.total_due_kopecks)}</strong>
            </summary>
            <div className="account-order-body">
              <p>Самовивіз: <DateTime value={order.pickup_at} /></p>
              <ul>
                {[...order.order_items].sort((a, b) => a.line_number - b.line_number).map((item) => (
                  <li key={item.line_number}>
                    <span><strong>{item.product_name} × {item.quantity}</strong>
                      <small>{[item.variant_name, ...item.modifiers.map((modifier) => modifier.name)].filter(Boolean).join(' · ')}</small>
                    </span>
                    <span className="account-money">{formatPrice(item.line_total_kopecks)}</span>
                  </li>
                ))}
              </ul>
              <p>Вартість: {formatPrice(order.subtotal_kopecks)}
                {order.bonus_used_kopecks > 0 && <> · Списано бонусами: {formatBonus(order.bonus_used_kopecks)}</>}
              </p>
            </div>
          </details>
        </li>
      ))}
    </ul>
  )
}

function BonusHistory({ transactions }) {
  return <ul className="account-history account-ledger">
    {transactions.map((item) => (
      <li key={`${item.order_id}-${item.kind}`}>
        <span><strong>{bonusKinds[item.kind]}</strong><DateTime value={item.created_at} /></span>
        <strong className="account-money">{item.amount_kopecks > 0 ? '+' : '−'}{formatBonus(Math.abs(item.amount_kopecks))}</strong>
      </li>
    ))}
  </ul>
}

function Dashboard({ user }) {
  const { profile, profileError, refreshProfile } = useAccount()
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState(false)

  async function signOut() {
    setSigningOut(true)
    setSignOutError(false)
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) throw error
    } catch {
      setSignOutError(true)
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <>
      <header className="account-heading">
        <h1>Особистий кабінет<span>.</span></h1>
        <button className="button button-secondary" type="button" disabled={signingOut} onClick={signOut}>
          {signingOut ? 'Виходимо…' : 'Вийти'} <LogOut size={19} aria-hidden="true" />
        </button>
      </header>
      {signOutError && <p className="account-error" role="alert">Не вдалося вийти. Спробуйте ще раз.</p>}
      <div className="account-grid">
        <section className="account-profile" aria-labelledby="account-profile-heading">
          <h2 id="account-profile-heading">Контактні дані</h2>
          <dl className="account-email"><dt>Електронна пошта</dt><dd>{user.email}</dd></dl>
          {profile && <ProfileForm user={user} profile={profile} />}
          {profileError && <div className="account-actions">
            <p className="account-error" role="alert">Не вдалося завантажити дані профілю.</p>
            <button type="button" onClick={refreshProfile}>Повторити</button>
          </div>}
          {!profile && !profileError && <p role="status">Завантажуємо профіль…</p>}
        </section>

        <section className="account-rewards" aria-labelledby="account-rewards-heading">
          <div className="account-balance">
            <h2 id="account-rewards-heading"><Wallet size={22} aria-hidden="true" /> Бонусний баланс</h2>
            {profile && !profileError ? <p className="account-money">{formatBonus(profile.bonus_balance_kopecks)}</p>
              : <p className="account-balance-wait" role="status">{profileError ? 'Баланс недоступний' : 'Оновлюємо баланс…'}</p>}
            <small>1 бонус = 1 грн · До 30% вартості замовлення</small>
          </div>
          <h3 className="account-ledger-title">Історія бонусів</h3>
          <History table="bonus_transactions" userId={user.id}
            empty={<p className="account-muted">Після першого виконаного замовлення тут з’явиться нарахування бонусів.</p>}>
            {(rows) => <BonusHistory transactions={rows} />}
          </History>
        </section>

        <section className="account-orders" aria-labelledby="account-orders-heading">
          <h2 id="account-orders-heading">Мої замовлення</h2>
          <History table="orders" userId={user.id} empty={
            <div className="account-empty">
              <Coffee size={26} aria-hidden="true" />
              <p>Тут з’являться замовлення, оформлені з цього акаунта.</p>
              <Link className="text-link" to="/menu">Перейти до меню <ArrowRight size={18} aria-hidden="true" /></Link>
            </div>
          }>
            {(rows) => <OrderHistory orders={rows} />}
          </History>
        </section>
      </div>
    </>
  )
}

function AccountPage() {
  const { user, authLoading } = useAccount()
  return (
    <div className="container account-page">
      {authLoading ? <div className="account-heading">
        <h1>Особистий кабінет<span>.</span></h1><p role="status">Перевіряємо сесію…</p>
      </div> : user ? <Dashboard key={user.id} user={user} /> : <AuthForm />}
    </div>
  )
}

export function Component() {
  return <AccountProvider><AccountPage /></AccountProvider>
}
