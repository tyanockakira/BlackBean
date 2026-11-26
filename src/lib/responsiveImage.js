const widths = [480, 768, 1200]

export function responsiveSrcSet(sources) {
  return sources.map((url, index) => `${url} ${widths[index]}w`).join(', ')
}
