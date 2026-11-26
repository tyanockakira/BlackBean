import { getProduct } from './catalog.js'

export let shops = [
  {
    id: 'podil',
    name: 'Поділ',
    district: 'Подільський район',
    hours: { opens: 480, closes: 1200 },
    photo: 'location-01',
    imageAlt: 'Світла зала на Подолі з панорамними вікнами й синіми кріслами',
    caption: 'Світла зала з панорамними вікнами та синіми кріслами.',
    description: 'Панорамні вікна ловлять ранкове світло. Біля них є місце для неспішної першої кави й розмови перед прогулянкою Подолом.',
  },
  {
    id: 'center',
    name: 'Центр',
    district: 'Шевченківський район',
    hours: { opens: 480, closes: 1260 },
    photo: 'location-03',
    imageAlt: 'Кав’ярня в Центрі з довгою металевою стійкою і вітриною',
    caption: 'Місця біля довгої стійки й вітрина зі свіжою випічкою.',
    description: 'Відкрита стійка й вітрина з випічкою. Зручно зайти по еспресо між справами або сісти біля бару на довшу перерву.',
  },
  {
    id: 'pechersk',
    name: 'Печерськ',
    district: 'Печерський район',
    hours: { opens: 540, closes: 1200 },
    photo: 'location-02',
    imageAlt: 'Зала кав’ярні на Печерську із синіми стільцями та підсвіченою стійкою',
    caption: 'Столики біля вікна й м’яке світло вздовж бару.',
    description: 'М’яке світло вздовж бару й невеликі столики біля вікон. Місце для тихої паузи, коли хочеться відкласти телефон і допити каву.',
  },
]

let unavailableByShop = {
  podil: [],
  center: ['flat-white', 'basque-cheesecake'],
  pechersk: ['iced-latte', 'matcha-latte', 'almond-croissant'],
}

export function getShop(id) {
  return shops.find((shop) => shop.id === id)
}

export function isAvailable(productId, shopId) {
  return Boolean(getProduct(productId) && getShop(shopId) && !unavailableByShop[shopId].includes(productId))
}

export function applyShops(nextShops, availability) {
  shops = nextShops
  unavailableByShop = Object.fromEntries(nextShops.map((shop) => [
    shop.id,
    availability.filter((item) => item.shop_id === shop.id && !item.available).map((item) => item.product_id),
  ]))
}
