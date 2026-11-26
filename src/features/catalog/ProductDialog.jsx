import { ShoppingBag } from 'lucide-react'
import { useState } from 'react'
import { Modal } from '../../components/Modal'
import { QuantityControl } from '../../components/QuantityControl'
import { ResponsiveImage } from '../../components/ResponsiveImage'
import { defaultLine, formatPrice, lineDetails, lineKey, MAX_QUANTITY } from '../cart/cart.js'
import { useCart } from '../cart/cartState.js'
import { modifierGroups } from './catalog.js'
import { productImages } from './productImages'

function Options({ group, label, options, value, change }) {
  return (
    <fieldset className="product-options">
      <legend>{label}</legend>
      <div className="option-list">
        {options.map((option) => (
          <label className="product-option" key={option.id}>
            <input type="radio" name={group} checked={value === option.id} onChange={() => change(option.id)} />
            <span>{option.name}{option.price > 0 && <small>+{formatPrice(option.price)}</small>}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function ProductDialog({ product, onClose }) {
  const { add, lines } = useCart()
  const [variantId, setVariantId] = useState(product.variants[0].id)
  const [selected, setSelected] = useState({})
  const [requestedQuantity, setRequestedQuantity] = useState(1)
  const configuration = { ...defaultLine(product), variantId, modifierIds: Object.values(selected).filter(Boolean) }
  const key = lineKey(configuration)
  const existing = lines.find((line) => lineKey(line) === key)
  const remaining = MAX_QUANTITY - (existing?.quantity ?? 0)
  const quantity = Math.min(requestedQuantity, Math.max(1, remaining))
  const line = { ...configuration, quantity }
  const { total } = lineDetails(line)

  return (
    <Modal title={product.name} variant="product" onClose={onClose} returnFocusId={`choose-${product.id}`}>
      {(dismiss) => (
        <>
          <div className="dialog-scroll product-config">
            <ResponsiveImage className="config-image" sources={productImages(product)} sizes="(min-width: 620px) 390px, 110px" alt={product.name} eager />
            <p className="config-description">{product.description}</p>
            <div className="config-settings">
              {product.variants.length > 1 && (
                <Options group="volume" label="Об’єм" options={product.variants} value={variantId} change={setVariantId} />
              )}
              {product.groups.map((groupId) => {
                const group = modifierGroups[groupId]
                const options = [{ id: '', name: group.defaultLabel, price: 0 }, ...group.options]
                return <Options key={groupId} group={groupId} label={group.name} options={options} value={selected[groupId] || ''}
                  change={(id) => setSelected((previous) => ({ ...previous, [groupId]: id }))} />
              })}
              <div className="config-quantity">
                <p>Кількість</p>
                <QuantityControl value={quantity} max={remaining} onChange={setRequestedQuantity} />
                {existing && <small>У кошику вже {existing.quantity} шт. цієї конфігурації.</small>}
              </div>
            </div>
          </div>
          <div className="dialog-footer config-footer">
            <button type="button" className="button button-primary" disabled={!remaining}
              onClick={(event) => { if (dismiss(event)) add(line) }}>
              <span><ShoppingBag size={20} aria-hidden="true" /> Додати в кошик</span>
              <strong aria-live="polite">{formatPrice(total)}</strong>
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
