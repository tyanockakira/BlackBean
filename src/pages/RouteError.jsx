import { useEffect, useRef } from 'react'

export function RouteError() {
  const heading = useRef(null)

  useEffect(() => {
    document.title = 'Не вдалося відкрити сторінку — BLACK BEAN'
    heading.current.focus()
  }, [])

  return (
    <main className="container placeholder-page">
      <h1 ref={heading} tabIndex={-1}>Не вдалося відкрити сторінку</h1>
      <p>Спробуйте завантажити її ще раз.</p>
      <button className="button button-primary" type="button" onClick={() => window.location.reload()}>
        Спробувати ще раз
      </button>
    </main>
  )
}
