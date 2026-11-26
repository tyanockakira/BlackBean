import { applyCatalog } from './catalog.js'
import { applyShops } from './shops.js'

async function readCatalogRows(table, params, signal) {
  // Catalog data is public under RLS and does not need an Auth session.
  const url = new URL('/rest/v1/' + table, import.meta.env.VITE_SUPABASE_URL)
  url.search = new URLSearchParams({ order: 'id.asc', ...params })
  const response = await fetch(url, {
    headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
    signal,
  })
  if (!response.ok) throw new Error('Catalog request failed: ' + table)
  return response.json()
}

export async function loadCatalog(signal) {
  const [shopRows, productRows, groupRows] = await Promise.all([
    readCatalogRows('shops', {
      select: 'id,name,district,opens_at_minute,closes_at_minute,shop_products(product_id,available)',
    }, signal),
    readCatalogRows('products', {
      select: 'id,category,name,description,price_kopecks,product_variants(id,name,extra_kopecks),product_modifier_groups(group_id)',
      'product_variants.order': 'id.asc',
      'product_modifier_groups.order': 'group_id.asc',
    }, signal),
    readCatalogRows('modifier_groups', {
      select: 'id,name,default_label,modifiers(id,name,extra_kopecks)',
      'modifiers.order': 'id.asc',
    }, signal),
  ])
  signal?.throwIfAborted()
  const nextShops = shopRows.map((shop) => ({
    id: shop.id,
    name: shop.name,
    district: shop.district,
    hours: { opens: shop.opens_at_minute, closes: shop.closes_at_minute },
    photo: { podil: 'location-01', center: 'location-03', pechersk: 'location-02' }[shop.id],
    imageAlt: { podil: 'Світла зала на Подолі з панорамними вікнами й синіми кріслами', center: 'Кав’ярня в Центрі з довгою металевою стійкою і вітриною', pechersk: 'Зала кав’ярні на Печерську із синіми стільцями та підсвіченою стійкою' }[shop.id],
    caption: { podil: 'Світла зала з панорамними вікнами та синіми кріслами.', center: 'Місця біля довгої стійки й вітрина зі свіжою випічкою.', pechersk: 'Столики біля вікна й м’яке світло вздовж бару.' }[shop.id],
    description: { podil: 'Панорамні вікна ловлять ранкове світло. Біля них є місце для неспішної першої кави й розмови перед прогулянкою Подолом.', center: 'Відкрита стійка й вітрина з випічкою. Зручно зайти по еспресо між справами або сісти біля бару на довшу перерву.', pechersk: 'М’яке світло вздовж бару й невеликі столики біля вікон. Місце для тихої паузи, коли хочеться відкласти телефон і допити каву.' }[shop.id],
  }))
  const nextGroups = Object.fromEntries(groupRows.map((group) => [group.id, {
    name: group.name,
    defaultLabel: group.default_label,
    options: group.modifiers.map((modifier) => ({
      id: modifier.id, name: modifier.name, price: modifier.extra_kopecks,
    })),
  }]))
  const nextProducts = productRows.map((product) => ({
    id: product.id,
    category: product.category,
    name: product.name,
    description: product.description,
    price: product.price_kopecks,
    variants: product.product_variants.map((variant) => ({
      id: variant.id, name: variant.name, price: variant.extra_kopecks,
    })),
    groups: product.product_modifier_groups.map((link) => link.group_id),
  }))
  applyCatalog(nextProducts, nextGroups)
  applyShops(nextShops, shopRows.flatMap((shop) =>
    shop.shop_products.map((row) => ({ ...row, shop_id: shop.id }))))
}
