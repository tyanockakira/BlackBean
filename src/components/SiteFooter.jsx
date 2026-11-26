import { Link } from 'react-router-dom'
import { navigation } from '../lib/navigation'
import { Brand } from './Brand'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-main">
          <Brand className="footer-brand" />
          <nav aria-label="Навігація в підвалі сайту">
            {navigation.map(({ label, to }) => <Link key={to} to={to}>{label}</Link>)}
          </nav>
        </div>
        <p className="footer-note">BLACK BEAN — демонстраційний проєкт. Кав’ярні вигадані.</p>
      </div>
    </footer>
  )
}
