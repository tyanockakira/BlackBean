import { ArrowRight } from 'lucide-react'
import { useRef, useState } from 'react'
import { recoverPassword, supabase } from '../../lib/supabase.js'

const headings = {
  signIn: 'Вхід до кабінету',
  signUp: 'Створити акаунт',
  confirm: 'Підтвердити пошту',
  forgot: 'Відновлення пароля',
  reset: 'Новий пароль',
}

const actions = {
  signIn: 'Увійти',
  signUp: 'Зареєструватися',
  confirm: 'Підтвердити пошту',
  forgot: 'Надіслати код',
  reset: 'Зберегти новий пароль',
}

const descriptions = {
  signIn: 'Переглядайте замовлення та користуйтеся бонусами BLACK BEAN.',
  signUp: 'Підтвердьте свою пошту, щоб отримати доступ до кабінету.',
  confirm: 'Введіть шестизначний код із листа.',
  forgot: 'Вкажіть електронну пошту, яку використовували для реєстрації.',
  reset: 'Введіть код із листа та новий пароль.',
}

function authError(error) {
  switch (error?.code) {
    case 'invalid_credentials': return 'Перевірте електронну пошту та пароль.'
    case 'email_not_confirmed': return 'Спочатку підтвердьте електронну пошту.'
    case 'otp_expired': return 'Код недійсний або строк його дії минув. Запросіть новий код.'
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit': return 'Забагато спроб. Зачекайте й повторіть пізніше.'
    case 'weak_password': return 'Пароль не відповідає вимогам. Виберіть інший пароль.'
    case 'same_password': return 'Виберіть пароль, відмінний від попереднього, і запросіть новий код.'
    default: return 'Не вдалося виконати дію. Перевірте підключення та повторіть спробу.'
  }
}

export function AuthForm() {
  const [mode, setMode] = useState('signIn')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const heading = useRef(null)

  const hasCode = mode === 'confirm' || mode === 'reset'
  const hasPassword = mode === 'signIn' || mode === 'signUp' || mode === 'reset'

  function go(next, message = '') {
    setNotice(message)
    setError('')
    setMode(next)
    requestAnimationFrame(() => heading.current?.focus())
  }

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    const address = email.trim()
    const fields = new FormData(event.currentTarget)
    const password = fields.get('password')
    const token = fields.get('code')

    setBusy(true)
    setError('')
    setNotice('')
    const { auth } = supabase
    try {
      if (mode === 'reset') {
        if (password !== fields.get('repeatPassword')) {
          setError('Паролі не збігаються.')
          return
        }
        await recoverPassword(address, token, password)
        go('signIn', 'Пароль оновлено. Увійдіть із новим паролем.')
        return
      }
      if (mode === 'forgot') {
        const { error: failure } = await auth.resetPasswordForEmail(address)
        if (failure) throw failure
        go('reset', 'Якщо для цієї пошти є акаунт, ми надішлемо код.')
        return
      }
      if (mode === 'confirm') {
        const { error: failure } = await auth.verifyOtp({ email: address, token, type: 'email' })
        if (failure) throw failure
        return
      }
      if (mode === 'signUp') {
        const { error: failure } = await auth.signUp({ email: address, password })
        if (failure) throw failure
        go('confirm')
        return
      }
      const { error: failure } = await auth.signInWithPassword({ email: address, password })
      if (failure) throw failure
    } catch (failure) {
      if (failure.code === 'email_not_confirmed') go('confirm')
      setError(authError(failure))
    } finally {
      setBusy(false)
    }
  }

  async function resend(event) {
    const form = event.currentTarget.form
    if (busy || !form.elements.email.reportValidity()) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const { error: failure } = await supabase.auth.resend({ email: email.trim(), type: 'signup' })
      if (failure) throw failure
      setNotice('Якщо пошта очікує підтвердження, ми надішлемо новий код.')
    } catch (failure) {
      setError(authError(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="account-auth">
      <div>
        <p className="eyebrow">Особистий кабінет</p>
        <h1 ref={heading} tabIndex={-1}>{headings[mode]}<span>.</span></h1>
        <p className="account-muted">{descriptions[mode]}</p>
      </div>
      <form key={mode} className="account-form account-auth-form" onSubmit={submit} aria-busy={busy}>
        <label>Електронна пошта
          <input name="email" type="email" autoComplete="email" required value={email} readOnly={busy}
            onChange={(event) => setEmail(event.target.value)} />
        </label>
        {hasCode && <label>Код із листа
          <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required />
        </label>}
        {hasPassword && <label>{mode === 'reset' ? 'Новий пароль' : 'Пароль'}
          <input name="password" type="password" autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
            minLength={mode === 'signIn' ? undefined : 6} required />
          {mode !== 'signIn' && <small>Щонайменше 6 символів.</small>}
        </label>}
        {mode === 'reset' && <label>Повторіть новий пароль
          <input name="repeatPassword" type="password" autoComplete="new-password" minLength={6} required />
        </label>}
        {error && <p className="account-error" role="alert">{error}</p>}
        {notice && <p className="account-notice" role="status">{notice}</p>}
        <button className="button button-primary" type="submit" disabled={busy}>
          {busy ? 'Зачекайте…' : actions[mode]} <ArrowRight size={19} aria-hidden="true" />
        </button>
        <div className="account-actions">
          {mode === 'signIn' ? <>
            <button type="button" disabled={busy} onClick={() => go('signUp')}>Створити акаунт</button>
            <button type="button" disabled={busy} onClick={() => go('forgot')}>Забули пароль?</button>
          </> : <button type="button" disabled={busy} onClick={() => go('signIn')}>До входу</button>}
          {mode === 'confirm' && <button type="button" disabled={busy} onClick={resend}>Надіслати код ще раз</button>}
          {mode === 'reset' && <button type="button" disabled={busy} onClick={() => go('forgot')}>Запросити новий код</button>}
        </div>
      </form>
    </div>
  )
}
