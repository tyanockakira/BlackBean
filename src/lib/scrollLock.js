let lockCount = 0

export function lockPageScroll() {
  const root = document.documentElement
  lockCount += 1
  root.classList.add('scroll-locked')
  let released = false

  return () => {
    if (released) return
    released = true
    lockCount -= 1
    if (lockCount === 0) root.classList.remove('scroll-locked')
  }
}
