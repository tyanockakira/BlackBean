import { ArrowLeft, Coffee, LayoutDashboard, LogOut, ReceiptText, Store, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Brand } from '../components/Brand.jsx'
import { AdminMenu, AdminShops } from '../features/admin/AdminCatalog.jsx'
import { Action, DataState } from '../features/admin/AdminControls.jsx'
import { AdminCustomers } from '../features/admin/AdminCustomers.jsx'
import { AdminDashboard } from '../features/admin/AdminDashboard.jsx'
import { AdminOrders } from '../features/admin/AdminOrders.jsx'
import { loadShops } from '../features/admin/adminApi.js'
import { useAdminQuery } from '../features/admin/adminQueries.js'
import { supabase } from '../lib/supabase.js'
import './admin.css'

const sections = {
  dashboard: { label: 'Огляд', icon: LayoutDashboard, screen: AdminDashboard },
  orders: { label: 'Замовлення', icon: ReceiptText, screen: AdminOrders },
  menu: { label: 'Меню', icon: Coffee, screen: AdminMenu },
  shops: { label: 'Кав’ярні', icon: Store, screen: AdminShops },
  customers: { label: 'Клієнти', icon: UsersRound, screen: AdminCustomers },
}

export default function AdminWorkspace({ user }) {
  const [params] = useSearchParams()
  const requested = params.get('section')
  const section = Object.hasOwn(sections, requested) ? requested : 'dashboard'
  const { label, screen: Screen } = sections[section]
  const shops = useAdminQuery(loadShops)
  const [updatedShops, setUpdatedShops] = useState({})
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState(false)

  return <div className="admin-layout">
    <a className="skip-link" href="#admin-main">До розділу керування</a>
    <aside className="admin-sidebar">
      <div className="admin-brand"><Brand reloadDocument /><span className="eyebrow">Керування</span></div>
      <nav className="admin-nav" aria-label="Розділи керування">
        {Object.entries(sections).map(([key, { label: name, icon: Icon }]) => (
          <Link key={key} to={key === 'dashboard' ? '/admin' : `/admin?section=${key}`}
            aria-current={section === key ? 'page' : undefined}><Icon size={19} aria-hidden="true" /> {name}</Link>
        ))}
      </nav>
      <div className="admin-sidebar-footer">
        <a href="/"><ArrowLeft size={18} aria-hidden="true" /> На сайт</a>
      </div>
    </aside>
    <main id="admin-main" className="admin-main" tabIndex={-1}>
      <header className="admin-top">
        <div><p className="eyebrow">BLACK BEAN / Керування</p><h1>{label}<span>.</span></h1></div>
        <div className="admin-identity">
          <span>{user.email}</span>
          <Action disabled={signingOut} onClick={async () => {
            setSigningOut(true)
            setError(false)
            try {
              const { error: failure } = await supabase.auth.signOut({ scope: 'local' })
              if (failure) throw failure
            } catch {
              setError(true)
            } finally {
              setSigningOut(false)
            }
          }}><LogOut size={17} aria-hidden="true" /> {signingOut ? 'Виходимо…' : 'Вийти'}</Action>
        </div>
      </header>
      {error && <p role="alert" className="admin-error">Не вдалося вийти. Повторіть спробу.</p>}
      <DataState query={shops}>{shops.data && <Screen key={section} shops={shops.data.map((shop) => updatedShops[shop.id] ?? shop)}
        onShopSaved={(shop) => setUpdatedShops((current) => ({ ...current, [shop.id]: shop }))} />}</DataState>
    </main>
  </div>
}
