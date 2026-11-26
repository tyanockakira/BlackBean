import { responsiveSrcSet } from '../lib/responsiveImage.js'

export function ResponsiveImage({ sources, sizes, alt, landscape = false, priority = false, eager = false, className }) {
  return (
    <img
      className={className}
      src={sources[0]}
      srcSet={responsiveSrcSet(sources)}
      sizes={sizes}
      width={480}
      height={landscape ? 320 : 480}
      alt={alt}
      loading={priority || eager ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding={priority ? undefined : 'async'}
    />
  )
}
