import { lazy, Suspense, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Brand } from '../components/Brand.jsx'
import { AccountProvider } from '../features/account/AccountProvider.jsx'
import { AuthForm } from '../features/account/AuthForm.jsx'
import { useAccount } from '../features/account/accountContext.js'
import { useAdminQuery } from '../features/admin/adminQueries.js'
import { supabase } from '../lib/supabase.js'
import './account.css'

const AdminWorkspace = lazy(() => import('./AdminWorkspace.jsx'))

async function loadAdminAccess(_args, signal) {
  const { data, error } = await supabase.rpc('admin_access').abortSignal(signal)
  if (error) throw error
  return data
}

function AdminPage() {
  const { user, authLoading } = useAccount()
  const access = useAdminQuery(loadAdminAccess, [user?.id], Boolean(user))
  useEffect(() => {
    document.title = 'Керування — BLACK BEAN'
  }, [])

  if (user && access.data === true) return (
    <Suspense fallback={<p className="container account-page" role="status">Завантажуємо панель…</p>}>
      <AdminWorkspace key={user.id} user={user} />
    </Suspense>
  )

  return <main className="container account-page admin-entry">
    <div className="admin-entry-brand"><Brand /><Link to="/" className="text-link">На сайт</Link></div>
    {authLoading || access.loading ? <p role="status">Перевіряємо доступ до панелі…</p>
      : !user ? <AuthForm />
        : access.error ? <div className="account-actions" role="alert">
          <p className="account-error">Не вдалося перевірити доступ.</p>
          <button type="button" onClick={access.reload}>Повторити</button>
        </div>
          : <section><h1>Доступ обмежено<span>.</span></h1>
            <p>Цей розділ доступний адміністраторам BLACK BEAN.</p>
            <Link to="/account" className="text-link">До особистого кабінету</Link>
          </section>}
  </main>
}

export function Component() {
  return <AccountProvider withProfile={false}><AdminPage /></AccountProvider>
}
