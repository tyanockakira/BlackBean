const images = import.meta.glob('../../assets/images/locations/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
})

export function shopImages(shop) {
  return [480, 768, 1200].map((width) => images[`../../assets/images/locations/${shop.photo}-${width}.webp`])
}
