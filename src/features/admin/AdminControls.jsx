import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useId } from 'react'
import { pageSize } from './adminApi.js'

export function Action({ children, primary, type = 'button', ...props }) {
  return <button type={type} className={`admin-button${primary ? ' admin-button-primary' : ''}`} {...props}>{children}</button>
}

export function DataState({ query, empty, children }) {
  if (query.loading) return <p className="admin-state" role="status">Завантажуємо дані…</p>
  if (query.error) return <div className="admin-state admin-error" role="alert">
    <p>Не вдалося завантажити дані.</p><Action onClick={query.reload}>Повторити</Action>
  </div>
  if (empty && !query.data?.length) return <p className="admin-state">{empty}</p>
  return children
}

export function Pager({ offset, rows, setOffset }) {
  if (offset === 0 && rows.length <= pageSize) return null
  return <nav className="admin-pagination" aria-label="Сторінки результатів">
    <Action disabled={offset === 0} onClick={() => setOffset(offset - pageSize)} aria-label="Попередня сторінка"><ArrowLeft size={17} aria-hidden="true" /></Action>
    <span>Сторінка {1 + offset / pageSize}</span>
    <Action disabled={rows.length <= pageSize} onClick={() => setOffset(offset + pageSize)} aria-label="Наступна сторінка"><ArrowRight size={17} aria-hidden="true" /></Action>
  </nav>
}

export function ShopSelect({ shops, value, onChange, all = true }) {
  const labelId = useId()
  return <label><span id={labelId}>Кав’ярня</span>
    <select aria-labelledby={labelId} value={value} onChange={(event) => onChange(event.target.value)}>
      {all && <option value="">Усі кав’ярні</option>}
      {shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
    </select>
  </label>
}
