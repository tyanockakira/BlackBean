import { ArrowRight, Check, Clock3, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ResponsiveImage } from '../components/ResponsiveImage'
import { shops } from '../features/catalog/shops.js'
import { shopImages } from '../features/catalog/shopImages'
import { useCart } from '../features/cart/cartState.js'
import { formatShopHours } from '../features/checkout/pickup.js'
import './editorial.css'

export function Component() {
  const { shopId, lines, changeShop, showPanel } = useCart()

  function select(shop) {
    const returnFocusId = `location-action-${shop.id}`
    if (lines.length) {
      showPanel('shops', { shopId: shop.id, returnFocusId })
    } else {
      changeShop(shop.id)
      requestAnimationFrame(() => document.getElementById(returnFocusId)?.focus({ preventScroll: true }))
    }
  }

  return (
    <div className="container locations-page">
      <div className="editorial-heading locations-intro">
        <h1>Три кав’ярні.<br /> <span>Одне місто.</span></h1>
        <div>
          <p>Знайдіть своє місце для кави на Подолі, у Центрі чи на Печерську.</p>
          <p className="locations-demo">Локації та графіки роботи демонстраційні.</p>
        </div>
      </div>
      {shops.map((shop, index) => {
        const selected = shop.id === shopId
        const actionId = `location-action-${shop.id}`
        return (
          <section className="location-story" key={shop.id} aria-labelledby={`location-title-${shop.id}`}>
            <div className="location-story-image">
              <ResponsiveImage sources={shopImages(shop)} alt={shop.imageAlt}
                sizes="(min-width: 1792px) 1080px, (min-width: 780px) 60vw, 92vw" landscape eager={index === 0} />
            </div>
            <div className="location-story-copy">
              <p className="eyebrow location-district"><MapPin size={17} aria-hidden="true" />{shop.district}</p>
              <h2 id={`location-title-${shop.id}`}>BLACK BEAN <span>{shop.name}</span></h2>
              <p className="location-story-description">{shop.description}</p>
              <p className="location-hours"><Clock3 size={18} aria-hidden="true" />Щодня, {formatShopHours(shop)}</p>
              {selected ? (
                <div className="location-selected">
                  <p><Check size={17} aria-hidden="true" />Обрана кав’ярня</p>
                  <Link id={actionId} className="button button-primary" to="/menu">Перейти до меню <ArrowRight size={19} aria-hidden="true" /></Link>
                </div>
              ) : (
                <button id={actionId} type="button" className="button button-secondary" onClick={() => select(shop)}>
                  Обрати кав’ярню <ArrowRight size={19} aria-hidden="true" />
                </button>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
