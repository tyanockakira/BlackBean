import { LazyMotion, domAnimation, useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import { useLayoutEffect, useRef } from 'react'
import { Outlet, ScrollRestoration, useLoaderData, useLocation, useMatches, useNavigationType } from 'react-router-dom'
import { SiteHeader } from './components/SiteHeader'
import { SiteFooter } from './components/SiteFooter'
import { CommercePanels } from './features/cart/CommercePanels'
import { CartProvider } from './features/cart/CartContext.jsx'

function App() {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()
  const { catalogUnavailable } = useLoaderData()
  const metadata = useMatches().at(-1).handle
  const main = useRef(null)
  const previousPath = useRef(pathname)
  const reduceMotion = useReducedMotion()

  useLayoutEffect(() => {
    document.title = metadata.title
    document.querySelector('meta[name="description"]').content = metadata.description

    if (previousPath.current !== pathname) {
      previousPath.current = pathname
      main.current.focus({ preventScroll: true })
    }
  }, [metadata, pathname])

  return (
    <LazyMotion features={domAnimation} strict>
      <a className="skip-link" href="#main-content">До основного вмісту</a>
      <SiteHeader />
      {catalogUnavailable && <div className="catalog-connection-error" role="alert">Не вдалося завантажити актуальне меню. Оновіть сторінку, щоб повторити спробу.</div>}
      <main id="main-content" ref={main} tabIndex={-1}>
        <m.div
          key={pathname}
          initial={reduceMotion || navigationType === 'POP' ? false : { opacity: 0.94, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
        >
          <Outlet />
        </m.div>
      </main>
      <SiteFooter />
      <CommercePanels />
      <ScrollRestoration />
    </LazyMotion>
  )
}

export function Component() {
  return <CartProvider><App /></CartProvider>
}
