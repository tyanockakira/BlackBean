import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { bonusKinds, formatBonus, formatOrderTime } from '../../lib/orderPresentation.js'
import { Action, DataState, Pager } from './AdminControls.jsx'
import { OrderDetail, OrdersTable } from './AdminOrders.jsx'
import { loadCustomerBonuses, loadCustomers, pageSize } from './adminApi.js'
import { useAdminQuery } from './adminQueries.js'

function CustomerBonuses({ userId }) {
  const [offset, setOffset] = useState(0)
  const query = useAdminQuery(loadCustomerBonuses, [userId, offset])
  const rows = query.data ?? []
  return <DataState query={query} empty={offset === 0 ? 'Бонусних операцій ще немає.' : undefined}>
    <div className="admin-table-wrap" tabIndex={0} role="region" aria-label="Бонусні операції клієнта">
      <table className="admin-table">
        <thead><tr><th scope="col">Дата</th><th scope="col">Операція</th><th scope="col">Замовлення</th><th scope="col">Сума</th></tr></thead>
        <tbody>{rows.slice(0, pageSize).map((row) => <tr key={`${row.order_id}-${row.kind}`}>
          <td>{formatOrderTime(row.created_at)}</td><td>{bonusKinds[row.kind]}</td>
          <td className="admin-amount">{row.orders?.order_number}</td>
          <td className="admin-amount">{formatBonus(row.amount_kopecks)}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <Pager offset={offset} setOffset={setOffset} rows={rows} />
  </DataState>
}

function CustomerDetail({ customer, shops, back }) {
  const [orderId, setOrderId] = useState(null)
  if (orderId) return <OrderDetail id={orderId} shops={shops} back={() => setOrderId(null)} editable={false} />
  return <>
    <div className="admin-detail-top"><Action onClick={back}><ArrowLeft size={17} aria-hidden="true" /> До списку клієнтів</Action></div>
    <section className="admin-panel" aria-label="Профіль клієнта">
      <h2>{customer.display_name || 'Клієнт без імені'}</h2>
      <dl className="admin-details">
        <div><dt>Електронна пошта</dt><dd>{customer.email}</dd></div>
        <div><dt>Телефон</dt><dd>{customer.contact_phone || 'Не вказано'}</dd></div>
        <div><dt>Реєстрація</dt><dd>{formatOrderTime(customer.registered_at)}</dd></div>
        <div><dt>Бонусний баланс</dt><dd>{formatBonus(customer.bonus_balance_kopecks)}</dd></div>
      </dl>
    </section>
    <h2 className="admin-subheading">Замовлення клієнта</h2>
    <OrdersTable filters={{ userId: customer.user_id }} shops={shops} openOrder={setOrderId} />
    <h2 className="admin-subheading">Бонусні операції</h2>
    <CustomerBonuses userId={customer.user_id} />
  </>
}

export function AdminCustomers({ shops }) {
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [customer, setCustomer] = useState(null)
  const query = useAdminQuery(loadCustomers, [offset, filter], !customer)
  const rows = query.data ?? []

  if (customer) return <CustomerDetail key={customer.user_id} customer={customer} shops={shops} back={() => {
    setCustomer(null)
    query.reload()
  }} />
  return <>
    <form className="admin-filter" onSubmit={(event) => { event.preventDefault(); setOffset(0); setFilter(search.trim()) }}>
      <label>Ім’я або електронна пошта<input type="search" value={search} maxLength={254}
        onChange={(event) => setSearch(event.target.value)} /></label>
      <Action primary type="submit">Знайти</Action>
    </form>
    <DataState query={query} empty={offset === 0 ? 'Підтверджених акаунтів за цими умовами немає.' : undefined}>
      <div className="admin-table-wrap" tabIndex={0} role="region" aria-label="Таблиця клієнтів">
        <table className="admin-table">
          <thead><tr><th scope="col">Клієнт</th><th scope="col">Телефон</th><th scope="col">Реєстрація</th><th scope="col">Бонусний баланс</th></tr></thead>
          <tbody>{rows.slice(0, pageSize).map((row) => <tr key={row.user_id}>
            <td><button className="admin-table-link admin-customer-link" type="button" onClick={() => setCustomer(row)}>
              <span>{row.display_name || 'Без імені'}</span><small>{row.email}</small></button></td>
            <td>{row.contact_phone || '—'}</td><td>{formatOrderTime(row.registered_at)}</td>
            <td className="admin-amount">{formatBonus(row.bonus_balance_kopecks)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <Pager offset={offset} setOffset={setOffset} rows={rows} />
    </DataState>
  </>
}
