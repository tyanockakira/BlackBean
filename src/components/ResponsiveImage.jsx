const widths = [480, 768, 1200]

export function ResponsiveImage({ sources, sizes, alt, landscape = false, priority = false, eager = false, className }) {
  return (
    <img
      className={className}
      src={sources[0]}
      srcSet={sources.map((url, index) => `${url} ${widths[index]}w`).join(', ')}
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
