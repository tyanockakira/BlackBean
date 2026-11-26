import { X } from 'lucide-react'
import { useId, useLayoutEffect, useRef } from 'react'
import { lockPageScroll } from '../lib/scrollLock.js'
import './modal.css'

function trapFocus(event) {
  if (event.key !== 'Tab') return
  const controls = [...event.currentTarget.querySelectorAll('button:enabled, a[href], input:enabled, select:enabled, [tabindex="0"]')]
    .filter((control) => control.getClientRects().length && (control.type !== 'radio' || control.checked))
  const first = controls[0]
  const last = controls.at(-1)
  if (document.activeElement === (event.shiftKey ? first : last)) {
    event.preventDefault()
    const target = event.shiftKey ? last : first
    target?.focus()
  }
}

export function Modal({ title, variant, onClose, returnFocusId, children }) {
  const heading = useId()
  const panel = useRef(null)
  const closeButton = useRef(null)

  useLayoutEffect(() => {
    const dialog = panel.current
    const trigger = document.activeElement
    dialog.showModal()
    const unlockScroll = lockPageScroll()

    return () => {
      dialog.close()
      unlockScroll()
      const target = (returnFocusId && document.getElementById(returnFocusId)) || trigger
      if (target?.isConnected) target.focus({ preventScroll: true })
    }
  }, [returnFocusId])

  useLayoutEffect(() => {
    closeButton.current.focus({ preventScroll: true })
  }, [title])

  function dismiss(event) {
    const dialog = event.currentTarget.closest('dialog')
    if (!dialog?.open || dialog.dataset.closing) return false
    dialog.dataset.closing = 'true'
    const animations = dialog.getAnimations().map((animation) => animation.finished)
    Promise.allSettled(animations).then(() => {
      if (dialog.isConnected && dialog.open) onClose()
    })
    return true
  }

  return (
    <dialog
      ref={panel}
      className={`commerce-modal commerce-modal--${variant}`}
      aria-labelledby={heading}
      onKeyDown={trapFocus}
      onCancel={(event) => {
        event.preventDefault()
        dismiss(event)
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss(event)
      }}
    >
      <div className="dialog-frame">
        <header className="dialog-header">
          <h2 id={heading}>{title}</h2>
          <button ref={closeButton} type="button" className="icon-control dialog-close" onClick={dismiss} aria-label="Закрити вікно">
            <X size={24} aria-hidden="true" />
          </button>
        </header>
        {children(dismiss)}
      </div>
    </dialog>
  )
}
