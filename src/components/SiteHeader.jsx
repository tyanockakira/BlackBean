import { MapPin, Menu, ShoppingBag, UserRound, X } from 'lucide-react'
import { useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { getShop } from '../features/catalog/shops.js'
import { useCart } from '../features/cart/cartState.js'
import { navigation } from '../lib/navigation'
import { lockPageScroll } from '../lib/scrollLock.js'
import { Brand } from './Brand'

const desktopQuery = '(min-width: 960px)'

function subscribeToDesktop(callback) {
  const media = window.matchMedia(desktopQuery)
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}

function Navigation({ onNavigate }) {
  return (
    <nav className="header-nav" aria-label="Основна навігація">
      {navigation.map(({ label, to }) => (
        <NavLink key={to} to={to} end onClick={onNavigate}>{label}</NavLink>
      ))}
    </nav>
  )
}

function cycleMenuFocus(event) {
  if (event.key !== 'Tab') return

  const controls = event.currentTarget.querySelectorAll('button, a[href]')
  const first = controls[0]
  const last = controls[controls.length - 1]
  const edge = event.shiftKey ? first : last

  if (document.activeElement === edge) {
    event.preventDefault()
    const target = event.shiftKey ? last : first
    target.focus()
  }
}

function MobileNavigation() {
  const { pathname } = useLocation()
  const panel = useRef(null)
  const trigger = useRef(null)
  const unlockScroll = useRef(null)

  function closeMenu() {
    panel.current.close()
    trigger.current.setAttribute('aria-expanded', 'false')
    unlockScroll.current?.()
    trigger.current.focus({ preventScroll: true })
  }

  function openMenu() {
    panel.current.showModal()
    trigger.current.setAttribute('aria-expanded', 'true')
    unlockScroll.current = lockPageScroll()
  }

  useLayoutEffect(() => () => unlockScroll.current?.(), [])
  useLayoutEffect(() => {
    if (panel.current.open) closeMenu()
  }, [pathname])

  return (
    <>
      <button
        ref={trigger}
        className="icon-control menu-trigger"
        type="button"
        aria-label="Відкрити меню навігації"
        aria-controls="mobile-navigation"
        aria-expanded="false"
        aria-haspopup="dialog"
        onClick={openMenu}
      >
        <Menu size={23} aria-hidden="true" />
      </button>
      <dialog
        ref={panel}
        id="mobile-navigation"
        className="mobile-menu"
        aria-label="Меню навігації"
        onKeyDown={cycleMenuFocus}
        onCancel={(event) => {
          event.preventDefault()
          closeMenu()
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeMenu()
        }}
      >
        <div className="mobile-menu-content">
          <div className="mobile-menu-top">
            <span className="eyebrow">Навігація</span>
            <button className="icon-control" type="button" aria-label="Закрити меню навігації" onClick={closeMenu}>
              <X size={24} aria-hidden="true" />
            </button>
          </div>
          <Navigation onNavigate={closeMenu} />
        </div>
      </dialog>
    </>
  )
}

export function SiteHeader() {
  const isDesktop = useSyncExternalStore(subscribeToDesktop, () => window.matchMedia(desktopQuery).matches)
  const { count, shopId, showPanel } = useCart()
  const shop = getShop(shopId)

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Brand />
        {isDesktop && <Navigation />}
        <div className="header-tools">
          <button className="location-link" type="button" onClick={() => showPanel('shops')} aria-haspopup="dialog"
            aria-label={`Обрати кав’ярню. Поточна кав’ярня: ${shop.name}`}>
            <MapPin size={21} aria-hidden="true" />
            <span>{shop.name}</span>
          </button>
          <button className="icon-control" type="button" disabled aria-label="Особистий кабінет — у розробці" title="Особистий кабінет — у розробці">
            <UserRound size={21} aria-hidden="true" />
          </button>
          <button className="icon-control header-cart" type="button" onClick={() => showPanel('cart')} aria-haspopup="dialog"
            aria-label={count ? `Кошик, товарів: ${count}` : 'Кошик, порожній'}>
            <ShoppingBag size={21} aria-hidden="true" />
            {count > 0 && <span className="cart-count" aria-hidden="true">{count}</span>}
          </button>
          {!isDesktop && <MobileNavigation />}
        </div>
      </div>
    </header>
  )
}
