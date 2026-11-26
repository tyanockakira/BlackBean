import { Minus, Plus } from 'lucide-react'
import { MAX_QUANTITY } from '../features/cart/cart.js'

export function QuantityControl({ value, onChange, max = MAX_QUANTITY, label = 'Кількість' }) {
  return (
    <div className="quantity-control" role="group" aria-label={label}>
      <button type="button" disabled={value <= 1} onClick={() => onChange(value - 1)} aria-label="Зменшити кількість">
        <Minus size={17} aria-hidden="true" />
      </button>
      <span aria-live="polite" aria-atomic="true">{value}</span>
      <button type="button" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="Збільшити кількість">
        <Plus size={17} aria-hidden="true" />
      </button>
    </div>
  )
}
