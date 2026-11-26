const images = import.meta.glob('../../assets/images/{drinks,desserts}/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
})

export function productImages(product) {
  const directory = product.category === 'desserts' ? 'desserts' : 'drinks'
  return [480, 768].map((width) => images[`../../assets/images/${directory}/${product.id}-${width}.webp`])
}
