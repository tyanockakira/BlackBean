import { ArrowUpRight, MapPin, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ResponsiveImage } from '../components/ResponsiveImage'
import { categories, getProduct, products } from '../features/catalog/catalog.js'
import { ProductDialog } from '../features/catalog/ProductDialog'
import { productImages } from '../features/catalog/productImages'
import { getShop, isAvailable } from '../features/catalog/shops.js'
import { defaultLine, formatPrice } from '../features/cart/cart.js'
import { useCart } from '../features/cart/cartState.js'
import './menu.css'

function CatalogueItem({ product, available, choose, add, eager }) {
  const dessert = product.category === 'desserts'

  return (
    <li className={`catalogue-item${available ? '' : ' catalogue-item--unavailable'}`} id={`menu-item-${product.id}`} tabIndex={-1}>
      <div className="catalogue-image">
        <ResponsiveImage sources={productImages(product)} sizes="(min-width: 1200px) 22vw, (min-width: 740px) 30vw, 45vw"
          alt={product.name} eager={eager} />
      </div>
      <div className="catalogue-item-copy">
        <div className="catalogue-item-title"><h2>{product.name}</h2><span>{formatPrice(product.price)}</span></div>
        <p>{product.description}</p>
      </div>
      {available ? (
        <button className="catalogue-action" type="button" id={`choose-${product.id}`} aria-haspopup={dessert ? undefined : 'dialog'}
          aria-label={`${dessert ? 'Додати' : 'Налаштувати'}: ${product.name}`}
          onClick={() => dessert ? add(defaultLine(product)) : choose(product.id)}>
          {dessert ? 'Додати' : 'Налаштувати'} {dessert ? <Plus size={18} aria-hidden="true" /> : <ArrowUpRight size={18} aria-hidden="true" />}
        </button>
      ) : <p className="catalogue-unavailable">Немає в цій кав’ярні</p>}
    </li>
  )
}

export function Component() {
  const [category, setCategory] = useState('all')
  const [availableOnly, setAvailableOnly] = useState(false)
  const [params, setParams] = useSearchParams()
  const { shopId, showPanel, add } = useCart()
  const linked = getProduct(params.get('product'))
  const linkedAvailable = linked && isAvailable(linked.id, shopId)
  const matching = products.filter((product) => category === 'all' || product.category === category)
  const availableCount = matching.filter((product) => isAvailable(product.id, shopId)).length
  const visible = availableOnly ? matching.filter((product) => isAvailable(product.id, shopId)) : matching

  useEffect(() => {
    if (linked && !linkedAvailable) document.getElementById(`menu-item-${linked.id}`)?.focus()
  }, [linked, linkedAvailable])

  function setProduct(id) {
    const next = new URLSearchParams(params)
    if (id) next.set('product', id)
    else next.delete('product')
    setParams(next, { replace: true, preventScrollReset: true })
  }

  return (
    <section className="container catalogue" aria-labelledby="catalogue-heading">
      <div className="catalogue-intro">
        <div>
          <h1 id="catalogue-heading">Меню<span>.</span></h1>
          <p>Спешелті-кава, холодні напої та випічка BLACK BEAN.</p>
        </div>
        <button type="button" className="catalogue-shop" onClick={() => showPanel('shops')} aria-haspopup="dialog">
          <MapPin size={22} aria-hidden="true" />
          <span><small>Кав’ярня</small><strong>BLACK BEAN — {getShop(shopId).name}</strong></span>
          <ArrowUpRight size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="catalogue-toolbar">
        <div className="catalogue-filters" role="group" aria-label="Категорії меню">
          {categories.map((item) => (
            <button type="button" key={item.id} aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{item.name}</button>
          ))}
        </div>
        <label className="stock-checkbox"><input type="checkbox" checked={availableOnly} onChange={(event) => setAvailableOnly(event.target.checked)} /> Лише в наявності</label>
      </div>
      <p className="catalogue-count" role="status">У наявності {availableCount} з {matching.length} позицій</p>
      {visible.length ? (
        <ul className="catalogue-grid">
          {visible.map((product, index) => <CatalogueItem key={product.id} product={product} available={isAvailable(product.id, shopId)}
            choose={setProduct} add={add} eager={index < 2} />)}
        </ul>
      ) : <p className="catalogue-empty">У цій категорії зараз немає доступних позицій. Спробуйте іншу категорію або кав’ярню.</p>}
      {linkedAvailable && <ProductDialog key={linked.id} product={linked} onClose={() => setProduct(null)} />}
    </section>
  )
}
