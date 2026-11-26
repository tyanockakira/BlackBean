import { useEffect, useReducer, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getProduct } from '../catalog/catalog.js'
import { getShop, isAvailable } from '../catalog/shops.js'
import { addLine, lineKey, MAX_QUANTITY, restoreCart, serializeCart, STORAGE_KEY, unavailableLines } from './cart.js'
import { CartContext } from './cartState.js'

function loadCart() {
  try {
    return restoreCart(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return restoreCart(null)
  }
}

function reduceCart(state, action) {
  switch (action.type) {
    case 'add': {
      if (!isAvailable(action.line.productId, state.shopId)) {
        return { ...state, notice: { text: 'Цієї позиції немає у вибраній кав’ярні.' } }
      }
      const { lines, added } = addLine(state.lines, action.line)
      const name = getProduct(action.line.productId).name
      const text = added === 0
        ? 'У кошику вже 20 одиниць цієї конфігурації.'
        : `Додано: ${name} · ${added} шт.`
      return { ...state, lines, notice: { text } }
    }
    case 'quantity':
      if (!Number.isInteger(action.quantity) || action.quantity < 1 || action.quantity > MAX_QUANTITY) return state
      return {
        ...state,
        lines: state.lines.map((line) => lineKey(line) === action.key ? { ...line, quantity: action.quantity } : line),
      }
    case 'remove':
      return { ...state, lines: state.lines.filter((line) => lineKey(line) !== action.key) }
    case 'clear':
      return { ...state, lines: [] }
    case 'shop': {
      if (!getShop(action.shopId) || action.shopId === state.shopId) return state
      const unavailable = unavailableLines(state.lines, action.shopId)
      if (unavailable.length && !action.removeUnavailable) return state
      return { ...state, shopId: action.shopId, lines: state.lines.filter((line) => !unavailable.includes(line)) }
    }
    case 'dismiss':
      return state.notice === action.notice ? { ...state, notice: null } : state
    default:
      return state
  }
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(reduceCart, null, loadCart)
  const [panel, setPanel] = useState(null)
  const { pathname } = useLocation()
  const { shopId, lines, notice } = state

  if (panel && panel.pathname !== pathname) setPanel(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, serializeCart({ shopId, lines }))
    } catch {
      // Keep the current in-memory cart when storage is unavailable.
    }
  }, [shopId, lines])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => dispatch({ type: 'dismiss', notice }), 2500)
    return () => window.clearTimeout(timer)
  }, [notice])

  const value = {
    shopId,
    lines,
    notice,
    panel: panel?.mode,
    count: lines.reduce((total, line) => total + line.quantity, 0),
    panelShopId: panel?.shopId,
    panelReturnFocusId: panel?.returnFocusId,
    showPanel: (mode, { shopId: selectedShop, returnFocusId } = {}) => setPanel({ mode, pathname, shopId: selectedShop, returnFocusId }),
    hidePanel: () => setPanel(null),
    add: (line) => dispatch({ type: 'add', line }),
    setQuantity: (key, quantity) => dispatch({ type: 'quantity', key, quantity }),
    remove: (key) => dispatch({ type: 'remove', key }),
    clear: () => dispatch({ type: 'clear' }),
    changeShop: (nextShopId, removeUnavailable = false) => dispatch({ type: 'shop', shopId: nextShopId, removeUnavailable }),
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
