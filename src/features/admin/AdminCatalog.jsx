import { useState } from 'react'
import { parseBonusAmount } from '../checkout/bonuses.js'
import { formatClock } from '../checkout/pickup.js'
import { Action, DataState, ShopSelect } from './AdminControls.jsx'
import {
  loadAvailability, loadModifiers, loadProducts, loadVariants, saveAvailability, saveHours, savePrice,
} from './adminApi.js'
import { useAdminQuery } from './adminQueries.js'

function useSave() {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  async function run(action) {
    if (busy) return
    setBusy(true)
    setResult(null)
    try {
      await action()
      setResult({ saved: true })
    } catch {
      setResult({ error: 'Не вдалося зберегти зміни.' })
    } finally {
      setBusy(false)
    }
  }
  return { busy, result, run, setResult }
}

function SaveResult({ result }) {
  if (!result) return null
  return result.error ? <span className="admin-error" role="alert">{result.error}</span>
    : <span className="admin-success" role="status">Збережено</span>
}

function PriceRow({ row, table, productId }) {
  const basePrice = table === 'products'
  const [price, setPrice] = useState(String((row.price_kopecks ?? row.extra_kopecks) / 100).replace('.', ','))
  const { busy, result, run, setResult } = useSave()
  function submit(event) {
    event.preventDefault()
    const amount = parseBonusAmount(price)
    if (amount === null || amount < (basePrice ? 1 : 0) || amount > 1_000_000) {
      setResult({ error: 'Вкажіть коректну суму до 10 000 грн.' })
      return
    }
    run(() => savePrice(table, row.id, amount, productId))
  }

  return <tr>
    <th scope="row">{row.name}{row.modifier_groups && <small>{row.modifier_groups.name}</small>}</th>
    <td><form className="admin-inline-form" onSubmit={submit}>
      <input aria-label={`${basePrice ? 'Ціна' : 'Доплата'}: ${row.name}, грн`}
        inputMode="decimal" maxLength={10} required value={price} disabled={busy}
        onChange={(event) => { setPrice(event.target.value); setResult(null) }} />
      <Action type="submit" disabled={busy}>{busy ? 'Зберігаємо…' : 'Зберегти'}</Action>
      <SaveResult result={result} />
    </form></td>
  </tr>
}

function Prices({ query, table, productId }) {
  return <DataState query={query} empty="У цьому розділі поки немає позицій.">
    <div className="admin-table-wrap" tabIndex={0} role="region" aria-label="Редагування цін">
      <table className="admin-table admin-edit-table">
        <thead><tr><th scope="col">Назва</th><th scope="col">{table === 'products' ? 'Ціна, грн' : 'Доплата, грн'}</th></tr></thead>
        <tbody>{query.data?.map((row) => <PriceRow key={`${row.id}:${row.price_kopecks ?? row.extra_kopecks}`}
          row={row} table={table} productId={productId} />)}</tbody>
      </table>
    </div>
  </DataState>
}

function Variants({ products }) {
  const [selected, setSelected] = useState('')
  const productId = selected || products[0]?.id
  const query = useAdminQuery(loadVariants, [productId], Boolean(productId))
  if (!productId) return <p className="admin-state">У меню поки немає товарів.</p>
  return <>
    <div className="admin-filter"><label>Товар<select value={productId} onChange={(event) => setSelected(event.target.value)}>
      {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
    </select></label></div>
    <Prices query={query} table="product_variants" productId={productId} key={productId} />
  </>
}

function AvailabilityRow({ shopId, product, initial }) {
  const [available, setAvailable] = useState(initial)
  const { busy, result, run, setResult } = useSave()
  return <tr><th scope="row">{product.name}</th><td><form className="admin-inline-form" onSubmit={(event) => {
    event.preventDefault()
    run(() => saveAvailability(shopId, product.id, available))
  }}>
    <label className="admin-check"><input type="checkbox" checked={available} disabled={busy}
      aria-label={`У наявності: ${product.name}`}
      onChange={(event) => { setAvailable(event.target.checked); setResult(null) }} /> У наявності</label>
    <Action type="submit" disabled={busy}>{busy ? 'Зберігаємо…' : 'Зберегти'}</Action>
    <SaveResult result={result} />
  </form></td></tr>
}

function Availability({ shopId, products }) {
  const query = useAdminQuery(loadAvailability, [shopId])
  const availability = new Map(query.data?.map((row) => [row.product_id, row.available]))
  return <DataState query={query}>
    <div className="admin-table-wrap" tabIndex={0} role="region" aria-label="Наявність товарів">
      <table className="admin-table admin-edit-table">
        <thead><tr><th scope="col">Товар</th><th scope="col">Наявність</th></tr></thead>
        <tbody>{products.map((product) => <AvailabilityRow key={product.id}
          shopId={shopId} product={product} initial={availability.get(product.id) ?? false} />)}</tbody>
      </table>
    </div>
    {!products.length && <p className="admin-state">У меню поки немає товарів.</p>}
  </DataState>
}

const menuTabs = {
  products: 'Товари', variants: 'Варіанти', modifiers: 'Модифікатори', availability: 'Наявність',
}

export function AdminMenu({ shops }) {
  const [tab, setTab] = useState('products')
  const [selected, setSelected] = useState('')
  const shopId = selected || shops[0]?.id
  const products = useAdminQuery(loadProducts, [tab], tab !== 'modifiers')
  const modifiers = useAdminQuery(loadModifiers, [], tab === 'modifiers')
  return <>
    <nav className="admin-local-nav" aria-label="Керування меню">
      {Object.entries(menuTabs).map(([key, label]) => (
        <Action key={key} aria-pressed={key === tab} onClick={() => setTab(key)}>{label}</Action>
      ))}
    </nav>
    {tab === 'products' && <Prices query={products} table="products" />}
    {tab === 'variants' && <DataState query={products}>
      {products.data && <Variants products={products.data} />}
    </DataState>}
    {tab === 'modifiers' && <Prices query={modifiers} table="modifiers" />}
    {tab === 'availability' && <DataState query={products}>
      {shopId && products.data && <>
        <div className="admin-filter"><ShopSelect shops={shops} value={shopId} onChange={setSelected} all={false} /></div>
        <Availability key={shopId} shopId={shopId} products={products.data} />
      </>}
    </DataState>}
  </>
}

const minutes = (time) => {
  const [hours, mins] = time.split(':').map(Number)
  return hours * 60 + mins
}

function Hours({ shop, onSaved }) {
  const [opens, setOpens] = useState(formatClock(shop.opens_at_minute))
  const [closes, setCloses] = useState(formatClock(shop.closes_at_minute))
  const { busy, result, run, setResult } = useSave()
  function submit(event) {
    event.preventDefault()
    const opening = minutes(opens)
    const closing = minutes(closes)
    const duration = closing > opening ? closing - opening : closing + 1440 - opening
    if (duration <= 15) {
      setResult({ error: 'Кав’ярня має працювати довше ніж 15 хвилин.' })
      return
    }
    run(async () => {
      const closingMinute = closing === 0 ? 1440 : closing
      await saveHours(shop.id, opening, closingMinute)
      onSaved({ ...shop, opens_at_minute: opening, closes_at_minute: closingMinute })
    })
  }
  return <section className="admin-panel" aria-labelledby="shop-hours">
    <h2 id="shop-hours">Графік роботи</h2>
    <p className="admin-muted">Щоденний графік за київським часом. Якщо час закриття не пізніший за час відкриття, кав’ярня працює до наступного дня.</p>
    <form className="admin-filter" onSubmit={submit}>
      <label>Відкриття<input type="time" value={opens} required disabled={busy}
        onChange={(event) => { setOpens(event.target.value); setResult(null) }} /></label>
      <label>Закриття<input type="time" value={closes} required disabled={busy}
        onChange={(event) => { setCloses(event.target.value); setResult(null) }} /></label>
      <Action type="submit" primary disabled={busy}>{busy ? 'Зберігаємо…' : 'Зберегти графік'}</Action>
    </form>
    <SaveResult result={result} />
  </section>
}

export function AdminShops({ shops, onShopSaved }) {
  const [selected, setSelected] = useState('')
  const shop = shops.find((item) => item.id === selected) ?? shops[0]
  const products = useAdminQuery(loadProducts)
  if (!shop) return <p className="admin-state">Кав’ярень поки немає.</p>
  return <>
    <div className="admin-filter"><ShopSelect shops={shops} value={shop.id} onChange={setSelected} all={false} /></div>
    <Hours key={shop.id} shop={shop} onSaved={onShopSaved} />
    <h2 className="admin-subheading">Асортимент кав’ярні</h2>
    <DataState query={products}>
      {products.data && <Availability key={shop.id} shopId={shop.id} products={products.data} />}
    </DataState>
  </>
}
