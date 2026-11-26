import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function PlaceholderPage({ title }) {
  return (
    <section className="container placeholder-page">
      <p className="eyebrow">BLACK BEAN / У РОЗРОБЦІ</p>
      <h1>{title}</h1>
      <p>Сторінка стане доступною на наступному етапі MVP.</p>
      <Link className="text-link" to="/">
        Повернутися на головну <ArrowUpRight size={19} aria-hidden="true" />
      </Link>
    </section>
  )
}
