export const categories = [
  { id: 'all', name: 'Усе меню' },
  { id: 'coffee', name: 'Кава' },
  { id: 'cold', name: 'Холодні напої' },
  { id: 'desserts', name: 'Десерти' },
]

export const modifierGroups = {
  milk: {
    name: 'Молоко',
    defaultLabel: 'Коров’яче',
    options: [
      { id: 'oat-milk', name: 'Вівсяне', price: 2000 },
      { id: 'almond-milk', name: 'Мигдальне', price: 2000 },
      { id: 'lactose-free-milk', name: 'Безлактозне', price: 2000 },
    ],
  },
  syrup: {
    name: 'Сироп',
    defaultLabel: 'Без сиропу',
    options: [
      { id: 'vanilla-syrup', name: 'Ванільний', price: 1500 },
      { id: 'caramel-syrup', name: 'Карамельний', price: 1500 },
    ],
  },
  espresso: {
    name: 'Додатковий еспресо',
    defaultLabel: 'Без додаткової порції',
    options: [{ id: 'extra-shot', name: 'Додаткова порція', price: 2500 }],
  },
}

function volumes(standard, large) {
  return [
    { id: `ml-${standard}`, name: `${standard} мл`, price: 0 },
    { id: `ml-${large}`, name: `${large} мл`, price: 2000 },
  ]
}

const serving = [{ id: 'standard', name: '', price: 0 }]
const milkCoffee = ['milk', 'syrup', 'espresso']

export const products = [
  { id: 'espresso', category: 'coffee', name: 'Еспресо', description: 'Міцна кава з насиченим смаком і коротким післясмаком.', price: 7000, variants: volumes(30, 60), groups: [] },
  { id: 'americano', category: 'coffee', name: 'Американо', description: 'Еспресо з гарячою водою та м’якшим смаком.', price: 8000, variants: volumes(180, 250), groups: ['syrup', 'espresso'] },
  { id: 'cappuccino', category: 'coffee', name: 'Капучино', description: 'Еспресо з молоком і густою мікропіною.', price: 10000, variants: volumes(180, 250), groups: milkCoffee },
  { id: 'latte', category: 'coffee', name: 'Лате', description: 'Еспресо з великою порцією теплого молока.', price: 10500, variants: volumes(250, 350), groups: milkCoffee },
  { id: 'flat-white', category: 'coffee', name: 'Флет вайт', description: 'Подвійний еспресо й оксамитове молоко.', price: 11000, variants: volumes(180, 250), groups: milkCoffee },
  { id: 'iced-latte', category: 'cold', name: 'Айс-лате', description: 'Еспресо, холодне молоко та лід.', price: 12000, variants: volumes(300, 400), groups: milkCoffee },
  { id: 'matcha-latte', category: 'cold', name: 'Матча-лате', description: 'Японська матча з молоком і льодом.', price: 14500, variants: volumes(300, 400), groups: ['milk', 'syrup'] },
  { id: 'berry-lemonade', category: 'cold', name: 'Ягідний лимонад', description: 'Ягоди, лимонний сік, газована вода та лід.', price: 10500, variants: volumes(300, 400), groups: [] },
  { id: 'croissant', category: 'desserts', name: 'Класичний круасан', description: 'Хрустка скоринка, ніжне вершкове тісто.', price: 9500, variants: serving, groups: [] },
  { id: 'almond-croissant', category: 'desserts', name: 'Мигдальний круасан', description: 'Листкове тісто з мигдальним кремом і пелюстками.', price: 13500, variants: serving, groups: [] },
  { id: 'basque-cheesecake', category: 'desserts', name: 'Баскський чизкейк', description: 'Ніжна сирна середина та карамелізована скоринка.', price: 16000, variants: serving, groups: [] },
  { id: 'brownie', category: 'desserts', name: 'Шоколадний брауні', description: 'Щільний десерт із темним шоколадом.', price: 11500, variants: serving, groups: [] },
]

const byId = new Map(products.map((product) => [product.id, product]))

export function getProduct(id) {
  return byId.get(id)
}
