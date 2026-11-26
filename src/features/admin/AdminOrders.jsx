import { ArrowLeft, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { Modal } from '../../components/Modal.jsx'
import { formatBonus, formatOrderTime, orderStatuses } from '../../lib/orderPresentation.js'
import { formatPrice } from '../cart/cart.js'
import { Action, DataState, Pager, ShopSelect } from './AdminControls.jsx'
import { loadOrder, loadOrders, pageSize, transitionOrder } from './adminApi.js'
import { useAdminQuery } from './adminQueries.js'

const nextActions = {
  new: ['accepted', 'Прийняти замовлення'],
  accepted: ['preparing', 'Почати приготування'],
  preparing: ['ready', 'Позначити готовим'],
  ready: ['completed', 'Підтвердити оплату'],
}
const shopName = (shops, id) => shops.find((shop) => shop.id === id)?.name ?? id

export function OrdersTable({ filters, shops, openOrder }) {
  const [offset, setOffset] = useState(0)
  const query = useAdminQuery(loadOrders, [filters, offset])
  const rows = query.data ?? []
  return <DataState query={query} empty={offset === 0 ? 'За цими умовами замовлень немає.' : undefined}>
    <div className="admin-table-wrap" tabIndex={0} role="region" aria-label="Таблиця замовлень">
      <table className="admin-table">
        <thead><tr><th scope="col">Номер</th><th scope="col">Кав’ярня</th><th scope="col">Самовивіз</th>
          <th scope="col">Статус</th><th scope="col" className="admin-align-right">До сплати</th></tr></thead>
        <tbody>{rows.slice(0, pageSize).map((order) => <tr key={order.id}>
          <td><button type="button" className="admin-table-link admin-amount" onClick={() => openOrder(order.id)}>
            {order.order_number}<ExternalLink size={14} aria-hidden="true" /></button></td>
          <td>{shopName(shops, order.shop_id)}</td>
          <td><time dateTime={order.pickup_at}>{formatOrderTime(order.pickup_at)}</time></td>
          <td><span className={`admin-status admin-status-${order.status}`}>{orderStatuses[order.status]}</span></td>
          <td className="admin-align-right admin-amount">{formatPrice(order.total_due_kopecks)}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <Pager offset={offset} setOffset={setOffset} rows={rows} />
  </DataState>
}

export function OrderDetail({ id, shops, back, editable = true }) {
  const query = useAdminQuery(loadOrder, [id])
  const [requested, setRequested] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const order = query.data
  const next = nextActions[order?.status]
  const confirm = requested === 'completed' || requested === 'cancelled'

  async function change(status) {
    setBusy(true)
    setResult(null)
    try {
      await transitionOrder(order, status)
      setResult({ message: status === 'completed' ? 'Оплату підтверджено. Замовлення виконано.' : 'Статус оновлено.' })
      query.reload()
    } catch (error) {
      const conflict = error.message === 'ORDER_STATUS_CONFLICT'
      setResult({ error: conflict ? 'Статус уже змінився. Дані оновлено.' : 'Не вдалося змінити статус. Повторіть спробу.' })
      if (conflict) query.reload()
    } finally {
      setBusy(false)
      setRequested(null)
    }
  }

  return <>
    <div className="admin-detail-top">
      <Action onClick={back}><ArrowLeft size={17} aria-hidden="true" /> Назад до списку</Action>
      {result && <p className={result.error ? 'admin-error' : 'admin-success'} role={result.error ? 'alert' : 'status'}>{result.error ?? result.message}</p>}
    </div>
    <DataState query={query}>
      {order && <article className="admin-panel">
        <div className="admin-section-heading"><h2 className="admin-amount">{order.order_number}</h2>
          <span className={`admin-status admin-status-${order.status}`}>{orderStatuses[order.status]}</span></div>
        <dl className="admin-details">
          <div><dt>Кав’ярня</dt><dd>{shopName(shops, order.shop_id)}</dd></div>
          <div><dt>Самовивіз</dt><dd>{formatOrderTime(order.pickup_at)}</dd></div>
          <div><dt>Створено</dt><dd>{formatOrderTime(order.created_at)}</dd></div>
          <div><dt>Оплата</dt><dd>{order.paid_at ? formatOrderTime(order.paid_at) : 'Не підтверджено'}</dd></div>
          <div><dt>Ім’я</dt><dd>{order.contact_name}</dd></div>
          <div><dt>Телефон</dt><dd>{order.contact_phone}</dd></div>
          <div><dt>Тип клієнта</dt><dd>{order.user_id ? 'Зареєстрований' : 'Гість'}</dd></div>
          {order.comment && <div><dt>Коментар</dt><dd>{order.comment}</dd></div>}
        </dl>
        <h3 className="admin-subheading">Позиції замовлення</h3>
        <div className="admin-table-wrap" tabIndex={0} role="region" aria-label="Склад замовлення">
          <table className="admin-table">
            <thead><tr><th scope="col">Позиція</th><th scope="col">Кількість</th><th scope="col">Ціна</th><th scope="col">Сума</th></tr></thead>
            <tbody>{[...order.order_items].sort((a, b) => a.line_number - b.line_number).map((item) => (
              <tr key={item.line_number}><td><strong>{item.product_name}</strong>
                <small>{[item.variant_name, ...item.modifiers.map((modifier) => modifier.name)].filter(Boolean).join(' · ')}</small>
              </td><td>{item.quantity}</td><td>{formatPrice(item.unit_price_kopecks)}</td><td>{formatPrice(item.line_total_kopecks)}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <dl className="admin-totals">
          <div><dt>Вартість</dt><dd>{formatPrice(order.subtotal_kopecks)}</dd></div>
          <div><dt>Списано бонусами</dt><dd>{formatBonus(order.bonus_used_kopecks)}</dd></div>
          <div><dt>До сплати</dt><dd>{formatPrice(order.total_due_kopecks)}</dd></div>
        </dl>
        {editable && next && <div className="admin-detail-actions">
          <Action primary disabled={busy} onClick={() => next[0] === 'completed' ? setRequested(next[0]) : change(next[0])}>{next[1]}</Action>
          <Action disabled={busy} onClick={() => setRequested('cancelled')}>Скасувати замовлення</Action>
        </div>}
      </article>}
    </DataState>
    {confirm && <Modal title={requested === 'completed' ? 'Підтвердити отримання оплати?' : 'Скасувати замовлення?'}
      variant="admin" onClose={() => setRequested(null)}>
      {() => <div className="admin-dialog-content">
        <p>{requested === 'completed'
          ? `Підтвердьте, що отримали ${formatPrice(order.total_due_kopecks)}. Замовлення буде виконано.`
          : 'Замовлення буде скасовано. Списані бонуси повернуться на баланс клієнта.'}</p>
        <div className="admin-detail-actions">
          <Action primary disabled={busy} onClick={() => change(requested)}>
            {busy ? 'Зберігаємо…' : requested === 'completed' ? 'Оплату отримано' : 'Так, скасувати'}
          </Action>
          <Action disabled={busy} onClick={() => setRequested(null)}>Повернутися</Action>
        </div>
      </div>}
    </Modal>}
  </>
}

const emptyFilters = { number: '', status: '', from: '', to: '', shopId: '' }

export function AdminOrders({ shops }) {
  const [draft, setDraft] = useState(emptyFilters)
  const [filters, setFilters] = useState(emptyFilters)
  const [orderId, setOrderId] = useState(null)
  const update = (name) => (event) => setDraft({ ...draft, [name]: event.target.value })
  if (orderId) return <OrderDetail key={orderId} id={orderId} shops={shops} back={() => setOrderId(null)} />
  return <>
    <form className="admin-filter" onSubmit={(event) => { event.preventDefault(); setFilters(draft) }}>
      <label>Номер замовлення<input type="search" value={draft.number} placeholder="BB-000128" maxLength={9} onChange={update('number')} /></label>
      <label>Статус<select value={draft.status} onChange={update('status')}>
        <option value="">Усі статуси</option>
        {Object.entries(orderStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>Створено з<input type="date" value={draft.from} max={draft.to || undefined} onChange={update('from')} /></label>
      <label>Створено до<input type="date" value={draft.to} min={draft.from || undefined} onChange={update('to')} /></label>
      <ShopSelect shops={shops} value={draft.shopId} onChange={(shopId) => setDraft({ ...draft, shopId })} />
      <Action primary type="submit">Знайти</Action>
    </form>
    <OrdersTable key={JSON.stringify(filters)} filters={filters} shops={shops} openOrder={setOrderId} />
  </>
}
