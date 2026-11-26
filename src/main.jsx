import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import './styles/shell.css'
import App from './App.jsx'
import { CartProvider } from './features/cart/CartContext.jsx'
import HomePage from './pages/HomePage.jsx'
import { RouteError } from './pages/RouteError.jsx'
import { navigation } from './lib/navigation.js'

const [home, menu, locations, about] = navigation
const notFound = { label: 'Сторінку не знайдено', description: 'Цієї сторінки немає на сайті BLACK BEAN.' }
const checkout = { to: '/checkout', label: 'Оформлення', description: 'Підготуйте замовлення на самовивіз із кав’ярні BLACK BEAN.' }

function pageMetadata({ label, heading = label, description, title }) {
  return { title: title ?? `${heading} — BLACK BEAN`, description }
}

function lazyRoute(page, lazy) {
  return {
    path: page.to,
    handle: pageMetadata(page),
    lazy,
  }
}

const router = createBrowserRouter([
  {
    element: <CartProvider><App /></CartProvider>,
    errorElement: <RouteError />,
    hydrateFallbackElement: <></>,
    children: [
      { index: true, element: <HomePage />, handle: pageMetadata(home) },
      lazyRoute(menu, () => import('./pages/MenuPage.jsx')),
      lazyRoute(locations, () => import('./pages/LocationsPage.jsx')),
      lazyRoute(about, () => import('./pages/AboutPage.jsx')),
      lazyRoute(checkout, () => import('./pages/CheckoutPage.jsx')),
      lazyRoute({ ...notFound, to: '*' }, async () => {
        const { default: PlaceholderPage } = await import('./pages/PlaceholderPage.jsx')
        return { element: <PlaceholderPage title={notFound.label} /> }
      }),
    ],
  },
])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
