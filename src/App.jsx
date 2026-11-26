import { AnimatePresence, LazyMotion, domAnimation, useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import { useLayoutEffect, useRef } from 'react'
import { Outlet, ScrollRestoration, useLocation, useMatches } from 'react-router-dom'
import { SiteHeader } from './components/SiteHeader'
import { SiteFooter } from './components/SiteFooter'
import { CommercePanels } from './features/cart/CommercePanels'

export default function App() {
  const { pathname } = useLocation()
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
      <main id="main-content" ref={main} tabIndex={-1}>
        <AnimatePresence initial={false}>
          <m.div
            key={pathname}
            initial={reduceMotion ? false : { opacity: 0.94, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
          >
            <Outlet />
          </m.div>
        </AnimatePresence>
      </main>
      <SiteFooter />
      <CommercePanels />
      <ScrollRestoration />
    </LazyMotion>
  )
}
