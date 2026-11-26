import { useEffect, useRef, useState } from 'react'

const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY
const scriptUrl = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let scriptPromise

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      const fail = () => {
        window.clearTimeout(timer)
        script.remove()
        scriptPromise = undefined
        reject(new Error('Turnstile failed to load'))
      }
      const timer = window.setTimeout(fail, 12_000)
      script.src = scriptUrl
      script.async = true
      script.onerror = fail
      script.onload = () => {
        if (!window.turnstile) return fail()
        window.clearTimeout(timer)
        resolve(window.turnstile)
      }
      document.head.append(script)
    })
  }
  return scriptPromise
}

export function TurnstileWidget({ onToken }) {
  const container = useRef(null)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState('pending')

  useEffect(() => {
    if (!siteKey) return
    let active = true
    let turnstile
    let widget
    const failed = () => {
      if (!active) return
      onToken('')
      setState('failed')
    }
    loadTurnstile().then((api) => {
      if (!active) return
      turnstile = api
      widget = api.render(container.current, {
        sitekey: siteKey,
        action: 'place_order',
        appearance: 'interaction-only',
        size: 'flexible',
        language: 'uk',
        'response-field': false,
        retry: 'never',
        callback: (token) => {
          if (!active) return
          onToken(token)
          setState('ready')
        },
        'expired-callback': () => {
          if (!active) return
          onToken('')
          setState('pending')
        },
        'error-callback': failed,
        'timeout-callback': failed,
        'unsupported-callback': failed,
      })
    }).catch(failed)
    return () => {
      active = false
      if (widget != null) turnstile.remove(widget)
    }
  }, [attempt, onToken])

  return <div className="checkout-protection">
    <div ref={container} />
    {!siteKey || state === 'failed' ? <>
      <p className="checkout-error" role="alert">Перевірка захисту недоступна.</p>
      {siteKey && <button type="button" className="checkout-text-button" onClick={() => {
        setState('pending')
        setAttempt((value) => value + 1)
      }}>Повторити перевірку захисту</button>}
    </> : state === 'pending' && <p className="checkout-help" role="status">Перевіряємо захист замовлення…</p>}
  </div>
}
