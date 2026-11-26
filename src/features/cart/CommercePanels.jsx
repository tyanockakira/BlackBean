import { ArrowRight, Check, MapPin, ShoppingBag, Trash2 } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Modal } from '../../components/Modal'
import { QuantityControl } from '../../components/QuantityControl'
import { ResponsiveImage } from '../../components/ResponsiveImage'
import { getProduct } from '../catalog/catalog.js'
import { productImages } from '../catalog/productImages'
import { getShop, shops } from '../catalog/shops.js'
import { formatPrice, lineDetails, lineKey, unavailableLines } from './cart.js'
import { useCart } from './cartState.js'
import './commerce.css'

function ShopChoices({ finish, back, initialShopId }) {
  const { shopId, lines, changeShop } = useCart()
  const [destination, setDestination] = useState(initialShopId ?? null)
  const confirmation = useRef(null)
  const choices = useRef(null)
  const chosen = getShop(destination)
  const unavailable = chosen ? unavailableLines(lines, chosen.id) : []
  const names = [...new Set(unavailable.map((line) => getProduct(line.productId).name))]

  useLayoutEffect(() => {
    if (chosen) confirmation.current.focus({ preventScroll: true })
  }, [chosen])

  function select(shop, event) {
    if (shop.id === shopId) return finish(event)
    if (lines.length) return setDestination(shop.id)
    changeShop(shop.id)
    finish(event)
  }

  function cancelChange(event) {
    if (initialShopId) return finish(event)
    setDestination(null)
    requestAnimationFrame(() => choices.current?.querySelector('[data-current]')?.focus())
  }

  if (chosen) {
    return (
      <div className="dialog-scroll shop-confirmation">
        <h3 ref={confirmation} tabIndex={-1}>Змінити кав’ярню на «{chosen.name}»?</h3>
        {names.length ? (
          <>
            <p>У цій кав’ярні немає таких позицій з вашого кошика:</p>
            <ul className="unavailable-list">{names.map((name) => <li key={name}>{name}</li>)}</ul>
            <p>Щоб змінити кав’ярню, підтвердьте видалення цих позицій.</p>
          </>
        ) : <p>Усі позиції з кошика доступні в цій кав’ярні.</p>}
        <div className="confirmation-actions">
          <button className="button button-primary" type="button" onClick={(event) => { changeShop(chosen.id, names.length > 0); finish(event) }}>
            {names.length ? 'Видалити позиції та змінити' : 'Підтвердити зміну'}
          </button>
          <button className="button button-secondary" type="button" onClick={cancelChange}>Скасувати зміну</button>
        </div>
      </div>
    )
  }

  return (
    <div className="dialog-scroll">
      <p className="dialog-help">Від кав’ярні залежить наявність позицій у меню.</p>
      <ul className="shop-choices" ref={choices}>
        {shops.map((shop) => (
          <li key={shop.id}>
            <button type="button" onClick={(event) => select(shop, event)} data-current={shop.id === shopId || undefined}
              aria-current={shop.id === shopId ? 'true' : undefined}>
              <MapPin size={20} aria-hidden="true" />
              <span>BLACK BEAN — {shop.name}</span>
              {shop.id === shopId ? <Check size={20} aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}
            </button>
          </li>
        ))}
      </ul>
      {back && <button type="button" className="button button-secondary shop-back" onClick={back}>До кошика</button>}
    </div>
  )
}

function CartItems({ editShop, leave, dismiss }) {
  const { pathname, search } = useLocation()
  const { shopId, lines, setQuantity, remove, clear } = useCart()
  const [confirmClear, setConfirmClear] = useState(false)
  const removeButtons = useRef(null)
  const menuLink = useRef(null)
  const total = lines.reduce((subtotal, line) => subtotal + lineDetails(line).total, 0)

  function focusAfterRemoval(index) {
    requestAnimationFrame(() => {
      const buttons = removeButtons.current?.querySelectorAll('.cart-remove')
      const target = buttons?.[Math.min(index, buttons.length - 1)] ?? menuLink.current
      target?.focus()
    })
  }

  function followCartLink(event) {
    if (event.currentTarget.pathname === pathname && !search) {
      event.preventDefault()
      dismiss(event)
    } else {
      leave()
    }
  }

  return (
    <>
      <div className="dialog-scroll cart-content">
        <button className="cart-shop" type="button" onClick={editShop}>
          <MapPin size={20} aria-hidden="true" />
          <span><small>Кав’ярня</small><strong>BLACK BEAN — {getShop(shopId).name}</strong></span>
          <span className="cart-shop-edit">Змінити</span>
        </button>
        {lines.length ? (
          <ul className="cart-lines" ref={removeButtons}>
            {lines.map((line, index) => {
              const key = lineKey(line)
              const { product, variant, modifiers, total: lineTotal } = lineDetails(line)
              const options = [variant.name, ...modifiers.map((option) => option.name)].filter(Boolean)
              return (
                <li className="cart-line" key={key}>
                  <ResponsiveImage className="cart-image" sources={productImages(product)} sizes="76px" alt="" />
                  <div className="cart-line-copy">
                    <h3>{product.name}</h3>
                    {options.length > 0 && <p>{options.join(' · ')}</p>}
                  </div>
                  <button className="icon-control cart-remove" type="button" aria-label={`Видалити: ${product.name}`}
                    onClick={() => { remove(key); focusAfterRemoval(index) }}>
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                  <div className="cart-line-actions">
                    <QuantityControl value={line.quantity} label={`Кількість: ${product.name}`} onChange={(value) => setQuantity(key, value)} />
                    <strong>{formatPrice(lineTotal)}</strong>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="cart-empty">
            <ShoppingBag size={36} strokeWidth={1.5} aria-hidden="true" />
            <h3>Кошик порожній</h3>
            <p>Оберіть напій або десерт у меню.</p>
          </div>
        )}
      </div>
      <div className="dialog-footer cart-footer">
        {lines.length > 0 && (
          <>
            <p className="cart-total"><span>Разом</span><strong aria-live="polite">{formatPrice(total)}</strong></p>
            {confirmClear ? (
              <div className="clear-confirmation">
                <p>Видалити всі позиції з кошика?</p>
                <div className="confirmation-actions">
                  <button className="button button-primary" type="button" onClick={() => { clear(); setConfirmClear(false); focusAfterRemoval(0) }}>Так, очистити</button>
                  <button className="button button-secondary" type="button" onClick={() => { setConfirmClear(false); requestAnimationFrame(() => document.getElementById('cart-clear')?.focus()) }}>Скасувати</button>
                </div>
              </div>
            ) : <button id="cart-clear" className="cart-clear" type="button" onClick={() => { setConfirmClear(true); requestAnimationFrame(() => document.querySelector('.clear-confirmation button')?.focus()) }}>Очистити кошик</button>}
          </>
        )}
        {lines.length > 0 && pathname !== '/checkout' && (
          <Link className="button button-primary cart-checkout" to="/checkout" onClick={followCartLink}>
            До оформлення <ArrowRight size={20} aria-hidden="true" />
          </Link>
        )}
        <Link ref={menuLink} className={`button ${lines.length ? 'button-secondary' : 'button-primary'}`}
          to={lines.length && pathname === '/checkout' ? '/checkout' : '/menu'} onClick={followCartLink}>
          {lines.length && pathname === '/checkout' ? 'До оформлення' : 'До меню'} <ArrowRight size={20} aria-hidden="true" />
        </Link>
      </div>
    </>
  )
}

function CommercePanel() {
  const { panel, panelShopId, panelReturnFocusId, hidePanel } = useCart()
  const [editingShop, setEditingShop] = useState(false)
  const showShops = panel === 'shops' || editingShop

  return (
    <Modal title={showShops ? 'Оберіть кав’ярню' : 'Кошик'} variant={panel} onClose={hidePanel} returnFocusId={panelReturnFocusId}>
      {(dismiss) => showShops
        ? <ShopChoices initialShopId={panelShopId} finish={editingShop ? () => setEditingShop(false) : dismiss}
            back={editingShop ? () => setEditingShop(false) : undefined} />
        : <CartItems editShop={() => setEditingShop(true)} dismiss={dismiss} leave={hidePanel} />}
    </Modal>
  )
}

export function CommercePanels() {
  const { panel, notice } = useCart()
  return (
    <>
      {panel && <CommercePanel key={panel} />}
      <div className="cart-notice" role="status">
        {notice && <span>{notice.text}</span>}
      </div>
    </>
  )
}
