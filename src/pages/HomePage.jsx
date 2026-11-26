import { ArrowUpRight, Clock3, MapPin, SlidersHorizontal } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import { Link } from 'react-router-dom'
import { BeanMark } from '../components/Brand'
import { ResponsiveImage } from '../components/ResponsiveImage'
import { Reveal } from '../components/Reveal'
import { getProduct } from '../features/catalog/catalog.js'
import { productImages } from '../features/catalog/productImages'
import { shopImages } from '../features/catalog/shopImages'
import { shops } from '../features/catalog/shops.js'
import { formatPrice } from '../features/cart/cart.js'
import { rewards } from '../lib/rewards.js'
import { baristaImages, heroImages } from './homeMedia'
import './home.css'

const preorderSteps = [
  { Icon: MapPin, title: 'Обери кав’ярню', description: 'Вибери зручну локацію для отримання.' },
  { Icon: SlidersHorizontal, title: 'Налаштуй своє замовлення', description: 'Додай улюблені напої й випічку.' },
  { Icon: Clock3, title: 'Забери у зручний час', description: 'Оплати замовлення під час отримання.' },
]

const featuredProducts = ['flat-white', 'iced-latte', 'matcha-latte', 'croissant'].map(getProduct)

function Hero() {
  const reduceMotion = useReducedMotion()

  return (
    <section className="hero container" aria-labelledby="hero-heading">
      <m.div
        className="hero-copy"
        initial={reduceMotion ? false : { y: 10 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.36, ease: 'easeOut' }}
      >
        <p className="eyebrow hero-kicker">Спешелті-кава · Київ</p>
        <h1 id="hero-heading">Кава<br className="hero-desktop-break" /> у ритмі<br /> <span>міста.</span></h1>
        <p className="hero-description">Три кав’ярні BLACK BEAN у Києві. Еспресо, флет вайт і свіжа випічка.</p>
        <Link className="button button-primary" to="/menu">
          Переглянути меню <ArrowUpRight size={20} aria-hidden="true" />
        </Link>
      </m.div>
      <div className="hero-media">
        <ResponsiveImage
          sources={heroImages}
          sizes="(min-width: 1792px) 960px, (min-width: 760px) 53.25vw, 100vw"
          alt="Синій стакан BLACK BEAN і круасан на столі у сонячній кав’ярні"
          landscape
          priority
        />
      </div>
    </section>
  )
}

function FeaturedMenu() {
  return (
    <Reveal className="container section-space featured-menu" aria-labelledby="featured-heading">
      <div className="section-heading">
        <h2 id="featured-heading">Популярні пропозиції</h2>
      </div>
      <ul className="product-list">
        {featuredProducts.map((product) => (
          <li key={product.id} className="product">
            <Link className="featured-link" to={`/menu?product=${product.id}`} aria-labelledby={`featured-${product.id}`}>
              <div className="image-frame product-image">
                <ResponsiveImage
                  sources={productImages(product)}
                  sizes="(min-width: 1792px) 402px, (min-width: 960px) 23vw, 46vw"
                  alt=""
                />
                <span className="featured-arrow"><ArrowUpRight size={19} aria-hidden="true" /></span>
              </div>
              <div className="product-heading">
                <h3 id={`featured-${product.id}`}>{product.name}</h3>
                <span className="product-price">{formatPrice(product.price)}</span>
              </div>
              <p>{product.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </Reveal>
  )
}

function Story() {
  return (
    <div className="story-band">
      <Reveal className="container story" aria-labelledby="story-heading">
        <div className="image-frame story-image">
          <ResponsiveImage
            sources={baristaImages}
            sizes="(min-width: 1792px) 758px, (min-width: 760px) 45vw, 92vw"
            alt="Бариста готує каву за стійкою біля вікна"
          />
        </div>
        <div className="story-copy">
          <p className="eyebrow">Підхід BLACK BEAN</p>
          <h2 id="story-heading">Починаємо із зерна.</h2>
          <p>Підбираємо зерно за смаком і налаштовуємо помел під кожну партію. Якщо не знаєте, що обрати, бариста підкаже, де більше фруктової кислинки, а де — шоколадних нот.</p>
          <Link className="text-link" to="/about">Більше про нас <ArrowUpRight size={19} aria-hidden="true" /></Link>
        </div>
      </Reveal>
    </div>
  )
}

function Preorder() {
  return (
    <Reveal className="container section-space preorder" aria-labelledby="preorder-heading">
      <div className="preorder-copy">
        <p className="eyebrow">Передзамовлення</p>
        <h2 id="preorder-heading">Кава на ваш час.</h2>
        <p>Замовляйте заздалегідь, щоб забрати каву дорогою на роботу чи прогулянку.</p>
        <p className="preorder-note">Можна підготувати замовлення. Надсилання стане доступним після підключення сервісу.</p>
      </div>
      <ol className="preorder-steps">
        {preorderSteps.map(({ Icon, title, description }, index) => (
          <li key={title}>
            <span className="step-number" aria-hidden="true">0{index + 1}</span>
            <span className="step-icon"><Icon size={23} strokeWidth={1.7} aria-hidden="true" /></span>
            <div><h3>{title}</h3><p>{description}</p></div>
          </li>
        ))}
      </ol>
    </Reveal>
  )
}

function Locations() {
  return (
    <Reveal className="container section-space locations" aria-labelledby="locations-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Кав’ярні</p>
          <h2 id="locations-heading">Три місця в Києві.</h2>
        </div>
        <Link className="text-link" to="/coffee-shops">
          Сторінка кав’ярень <ArrowUpRight size={19} aria-hidden="true" />
        </Link>
      </div>
      <ul className="locations-list">
        {shops.map((shop) => (
          <li key={shop.id}>
            <div className="image-frame location-image">
              <ResponsiveImage
                sources={shopImages(shop)}
                sizes="(min-width: 1792px) 544px, (min-width: 760px) 31vw, 92vw"
                alt={shop.imageAlt}
                landscape
              />
            </div>
            <div className="location-caption">
              <MapPin size={21} strokeWidth={1.7} aria-hidden="true" />
              <div><h3>{shop.name}</h3><p>{shop.caption}</p></div>
            </div>
          </li>
        ))}
      </ul>
    </Reveal>
  )
}

function Loyalty() {
  return (
    <div className="container loyalty-wrap">
      <Reveal className="loyalty" aria-labelledby="loyalty-heading">
        <div className="loyalty-copy">
          <p className="eyebrow">Бонусна програма</p>
          <h2 id="loyalty-heading">Бонуси за каву.</h2>
          <p>Цифрова картка з’явиться в особистому кабінеті.</p>
        </div>
        <div className="loyalty-card" aria-hidden="true">
          <span className="loyalty-card-brand">BLACK<br />BEAN</span>
          <BeanMark className="loyalty-bean" />
          <span className="eyebrow">Бонусна картка</span>
        </div>
        <dl className="loyalty-rules">
          {rewards.map(({ value, detail }) => (
            <div key={value}><dt>{value}</dt><dd>{detail}</dd></div>
          ))}
        </dl>
      </Reveal>
    </div>
  )
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <section className="statement" aria-labelledby="statement-heading">
        <div className="container statement-inner">
          <BeanMark className="statement-mark" />
          <h2 id="statement-heading">Зерно з характером.</h2>
          <p>Від ранкового еспресо до довгої розмови за флет вайтом.</p>
        </div>
      </section>
      <FeaturedMenu />
      <Story />
      <Preorder />
      <Locations />
      <Loyalty />
    </>
  )
}
