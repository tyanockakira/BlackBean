import { motion } from 'motion/react'
import { ArrowUpRight, Coffee } from 'lucide-react'
import { Link, Route, Routes } from 'react-router-dom'

const navigation = [
  { label: 'Меню', to: '/menu' },
  { label: 'Кав’ярні', to: '/coffee-shops' },
  { label: 'Про бренд', to: '/about' },
]

function HomePage() {
  return (
    <main>
      <section className="hero-section" aria-labelledby="hero-title">
        <p className="eyebrow">КИЇВ · SPECIALTY COFFEE · 03</p>
        <motion.div className="hero-copy" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }}>
          <h1 id="hero-title">Кава, що тримає місто в русі.</h1>
          <p className="hero-lede">BLACK BEAN — три київські кав’ярні для чесного зерна, уважного сервісу та міських ритуалів.</p>
          <Link className="button button-primary" to="/menu">Переглянути меню <ArrowUpRight size={18} aria-hidden="true" /></Link>
        </motion.div>
        <div className="hero-note" aria-label="Статус закладів"><Coffee size={18} aria-hidden="true" /><span>Зараз відкриті 3 з 3 кав’ярень</span></div>
      </section>
      <section className="intro-grid" aria-labelledby="intro-title">
        <p className="eyebrow">01 / НАШ ПІДХІД</p>
        <div><h2 id="intro-title">Зерно з характером. Місто без пауз.</h2><p>Це стартова оболонка продукту. Тут з’являться меню з наявністю по локаціях, конструктор напоїв та передзамовлення з оплатою при отриманні.</p></div>
      </section>
    </main>
  )
}

function PlaceholderPage({ title }) {
  return <main className="placeholder-page"><p className="eyebrow">BLACK BEAN / У РОЗРОБЦІ</p><h1>{title}</h1><p>Сторінка стане доступною на наступному етапі MVP.</p><Link className="text-link" to="/">Повернутися на головну <ArrowUpRight size={16} aria-hidden="true" /></Link></main>
}

function App() {
  return <div className="app-shell">
    <header className="site-header">
      <Link className="brand" to="/" aria-label="BLACK BEAN — на головну">BLACK<span>BEAN</span></Link>
      <nav aria-label="Основна навігація">{navigation.map((item) => <Link key={item.to} to={item.to}>{item.label}</Link>)}</nav>
      <Link className="header-action" to="/menu">Замовити <ArrowUpRight size={16} aria-hidden="true" /></Link>
    </header>
    <Routes><Route path="/" element={<HomePage />} /><Route path="/menu" element={<PlaceholderPage title="Меню" />} /><Route path="/coffee-shops" element={<PlaceholderPage title="Кав’ярні" />} /><Route path="/about" element={<PlaceholderPage title="Про бренд" />} /><Route path="*" element={<PlaceholderPage title="Сторінку не знайдено" />} /></Routes>
    <footer className="site-footer"><span>BLACK BEAN / КИЇВ</span><span>Демонстраційний MVP · 2026</span></footer>
  </div>
}

export default App
