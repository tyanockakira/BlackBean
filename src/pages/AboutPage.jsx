import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BeanMark } from '../components/Brand'
import { ResponsiveImage } from '../components/ResponsiveImage'
import { Reveal } from '../components/Reveal'
import { rewards } from '../lib/rewards.js'
import urban480 from '../assets/images/about/about-urban-480.webp'
import urban768 from '../assets/images/about/about-urban-768.webp'
import urban1200 from '../assets/images/about/about-urban-1200.webp'
import barista480 from '../assets/images/about/about-barista-480.webp'
import barista768 from '../assets/images/about/about-barista-768.webp'
import barista1200 from '../assets/images/about/about-barista-1200.webp'
import './editorial.css'

const urbanImages = [urban480, urban768, urban1200]
const baristaImages = [barista480, barista768, barista1200]
const imageSizes = '(min-width: 1792px) 792px, (min-width: 780px) 44vw, 92vw'

export function Component() {
  return (
    <div className="about-page">
      <section className="container about-intro" aria-labelledby="about-heading">
        <div className="editorial-heading">
          <p className="eyebrow">Про BLACK BEAN</p>
          <h1 id="about-heading">Кава як частина <span>міста.</span></h1>
          <p>У Києві є кава дорогою на роботу, кава після прогулянки й кава, за якою розмова триває довше. Для цих моментів і є BLACK BEAN.</p>
        </div>
        <div className="about-atmosphere">
          <ResponsiveImage sources={urbanImages} sizes={imageSizes}
            alt="Жінка із синім стаканом кави на сонячній вулиці" landscape eager />
        </div>
      </section>
      <Reveal className="container about-philosophy" aria-labelledby="philosophy-heading">
        <p className="eyebrow">Спешелті-кава</p>
        <div>
          <h2 id="philosophy-heading">Починаємо зі смаку.</h2>
          <p>У зерна є свій характер. В одній чашці шукаємо ягідну кислинку, в іншій — горіхові й шоколадні ноти. Налаштовуємо рецепт так, щоб ці відмінності можна було відчути.</p>
        </div>
      </Reveal>
      <div className="about-barista-band">
        <Reveal className="container about-barista" aria-labelledby="barista-heading">
          <div>
            <p className="eyebrow">За стійкою</p>
            <h2 id="barista-heading">Робота бариста.</h2>
            <p>Перш ніж подати еспресо, бариста перевіряє помел, дозу й час екстракції. А біля стійки можна запитати, чим флет вайт відрізняється від капучино, і знайти своє.</p>
          </div>
          <ResponsiveImage sources={baristaImages} sizes={imageSizes}
            alt="Бариста наливає молоко в чашку кави, утворюючи візерунок на пінці" landscape />
        </Reveal>
      </div>
      <Reveal className="container about-preorder" aria-labelledby="about-preorder-heading">
        <div>
          <p className="eyebrow">Передзамовлення</p>
          <h2 id="about-preorder-heading">По каву дорогою.</h2>
        </div>
        <div>
          <p>Оберіть кав’ярню, зберіть замовлення й перегляньте доступний час самовивозу. Оплата передбачена під час отримання.</p>
          <p className="about-preorder-note">Наразі можна підготувати замовлення й перевірити дані.</p>
          <Link className="text-link" to="/menu">Переглянути меню <ArrowUpRight size={19} aria-hidden="true" /></Link>
        </div>
      </Reveal>
      <div className="about-rewards">
        <Reveal className="container about-rewards-inner" aria-labelledby="about-rewards-heading">
          <div className="about-rewards-heading">
            <div>
              <p className="eyebrow">Бонусна програма</p>
              <h2 id="about-rewards-heading">Бонуси за каву.</h2>
            </div>
            <BeanMark className="about-bean" />
          </div>
          <dl className="about-rewards-rules">
            {rewards.map(({ value, detail }) => <div key={value}><dt>{value}</dt><dd>{detail}</dd></div>)}
          </dl>
          <p>Цифрова картка з’явиться в особистому кабінеті.</p>
        </Reveal>
      </div>
      <div className="container about-end">
        <Link className="button button-primary" to="/coffee-shops">Знайти свою кав’ярню <ArrowRight size={19} aria-hidden="true" /></Link>
      </div>
    </div>
  )
}
