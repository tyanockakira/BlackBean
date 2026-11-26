import { useState } from 'react'
import { addDays, pickupDateKeys } from '../checkout/pickup.js'
import { formatPrice } from '../cart/cart.js'
import { Action, DataState, ShopSelect } from './AdminControls.jsx'
import { loadDashboard } from './adminApi.js'
import { useAdminQuery } from './adminQueries.js'

const shortDate = new Intl.DateTimeFormat('uk-UA', { timeZone: 'UTC', day: 'numeric', month: 'short' })
const labelDate = (day) => shortDate.format(new Date(day + 'T00:00:00Z'))

function Activity({ days }) {
  const largest = Math.max(1, ...days.map((day) => day.count))
  const marks = new Set([0, Math.floor((days.length - 1) / 2), days.length - 1])
  return (
    <section className="admin-panel admin-chart-panel" aria-labelledby="activity-heading">
      <h2 id="activity-heading">Динаміка замовлень</h2>
      <p className="admin-muted">Кількість створених замовлень за днями</p>
      {days.some((day) => day.count > 0) ? <>
        <div className="admin-chart" aria-hidden="true">
          <span className="admin-chart-axis">{largest}<br /><span>0</span></span>
          <div className="admin-chart-track">
            <div className="admin-chart-bars" data-dense={days.length > 45 || undefined}>
              {days.map((day) => <div key={day.date} title={`${labelDate(day.date)}: ${day.count}`}>
                <span style={{ height: `${day.count / largest * 100}%` }} />
              </div>)}
            </div>
            <div className="admin-chart-dates">{[...marks].map((index) => <span key={index}>{labelDate(days[index].date)}</span>)}</div>
          </div>
        </div>
        <details className="admin-chart-data">
          <summary>Дані за днями</summary>
          <ul>{days.map((day) => <li key={day.date}><time dateTime={day.date}>{labelDate(day.date)}</time> <strong>{day.count}</strong></li>)}</ul>
        </details>
      </> : <p className="admin-state">За цей період замовлень немає.</p>}
    </section>
  )
}

export function AdminDashboard({ shops }) {
  const [filters, setFilters] = useState(() => {
    const { today } = pickupDateKeys(new Date())
    return { from: addDays(today, -6), to: today, shopId: '' }
  })
  const [selected, setSelected] = useState(filters)
  const [periodError, setPeriodError] = useState('')
  const query = useAdminQuery(loadDashboard, [selected.from, selected.to, selected.shopId])

  function apply(event) {
    event.preventDefault()
    if (filters.from > filters.to || filters.to > addDays(filters.from, 365)) {
      setPeriodError('Виберіть період до 366 днів із коректними датами.')
      return
    }
    setPeriodError('')
    setSelected(filters)
  }

  return <>
    <form className="admin-filter" onSubmit={apply}>
      <label>Початок періоду<input type="date" required value={filters.from}
        onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
      <label>Кінець періоду<input type="date" required value={filters.to}
        onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
      <ShopSelect shops={shops} value={filters.shopId} onChange={(shopId) => setFilters({ ...filters, shopId })} />
      <Action type="submit" primary>Застосувати</Action>
    </form>
    {periodError && <p className="admin-error" role="alert">{periodError}</p>}
    <DataState query={query}>
      {query.data && <>
        <dl className="admin-metrics">
          <div><dt>Виручка</dt><dd>{formatPrice(query.data.revenue)}</dd><small>За датою оплати</small></div>
          <div><dt>Замовлення</dt><dd>{query.data.orders}</dd><small>За датою створення</small></div>
          <div><dt>Середній чек</dt><dd>{formatPrice(query.data.average)}</dd><small>Виконані й оплачені</small></div>
          <div><dt>Активні</dt><dd>{query.data.active}</dd><small>У вибраному періоді</small></div>
        </dl>
        <Activity days={query.data.days} />
      </>}
    </DataState>
  </>
}
