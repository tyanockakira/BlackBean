import { supabase } from '../../lib/supabase.js'
import { addDays, kyivDateTimeToDate } from '../checkout/pickup.js'

export const pageSize = 20

async function dataFrom(query, signal) {
  const { data, error } = await (signal ? query.abortSignal(signal) : query)
  if (error) throw error
  return data
}

export const loadDashboard = ([from, to, shopId], signal) => dataFrom(supabase.rpc('admin_dashboard', {
  p_from: from, p_to: to, p_shop_id: shopId || null,
}), signal)

export function loadOrders([filter, offset], signal) {
  let query = supabase.from('orders')
    .select('id,order_number,shop_id,status,pickup_at,created_at,total_due_kopecks')
    .order('created_at', { ascending: false }).order('id', { ascending: false })
    .range(offset, offset + pageSize)
  if (filter.number) {
    const number = filter.number.trim().toUpperCase()
    if (/^[0-9]{1,6}$/.test(number)) query = query.eq('order_number', 'BB-' + number.padStart(6, '0'))
    else if (/^BB-[0-9]{1,6}$/.test(number)) query = query.like('order_number', number + '%')
    else return Promise.resolve([])
  }
  if (filter.status) query = query.eq('status', filter.status)
  if (filter.shopId) query = query.eq('shop_id', filter.shopId)
  if (filter.from) query = query.gte('created_at', kyivDateTimeToDate(filter.from))
  if (filter.to) query = query.lt('created_at', kyivDateTimeToDate(addDays(filter.to, 1)))
  if (filter.userId) query = query.eq('user_id', filter.userId)
  return dataFrom(query, signal)
}

export const loadOrder = ([id], signal) => dataFrom(supabase.from('orders')
  .select('id,order_number,shop_id,status,pickup_at,created_at,paid_at,user_id,contact_name,contact_phone,comment,subtotal_kopecks,bonus_used_kopecks,total_due_kopecks,order_items(line_number,product_name,variant_name,modifiers,quantity,unit_price_kopecks,line_total_kopecks)')
  .eq('id', id).single(), signal)

export const transitionOrder = (order, next) => dataFrom(supabase.rpc('transition_order', {
  p_order_id: order.id, p_expected_status: order.status, p_next_status: next, p_payment_confirmed: next === 'completed',
}))

export const loadShops = (_args, signal) => dataFrom(supabase.from('shops')
  .select('id,name,district,opens_at_minute,closes_at_minute').order('name'), signal)

export const loadProducts = (_args, signal) => dataFrom(supabase.from('products')
  .select('id,name,price_kopecks').order('name'), signal)

export const loadVariants = ([productId], signal) => dataFrom(supabase.from('product_variants')
  .select('id,name,extra_kopecks').eq('product_id', productId).order('extra_kopecks').order('id'), signal)

export const loadModifiers = (_args, signal) => dataFrom(supabase.from('modifiers')
  .select('id,name,extra_kopecks,modifier_groups(name)').order('name'), signal)

export const loadAvailability = ([shopId], signal) => dataFrom(supabase.from('shop_products')
  .select('product_id,available').eq('shop_id', shopId).order('product_id'), signal)

export function savePrice(table, id, amount, productId) {
  const column = table === 'products' ? 'price_kopecks' : 'extra_kopecks'
  let query = supabase.from(table).update({ [column]: amount }).eq('id', id)
  if (table === 'product_variants') query = query.eq('product_id', productId)
  return dataFrom(query.select(column).single())
}

export const saveHours = (id, opens, closes) => dataFrom(supabase.from('shops')
  .update({ opens_at_minute: opens, closes_at_minute: closes }).eq('id', id).select('id').single())

export async function saveAvailability(shopId, productId, available) {
  const update = () => supabase.from('shop_products').update({ available })
    .eq('shop_id', shopId).eq('product_id', productId).select('available')
  const existing = await dataFrom(update().maybeSingle())
  if (existing) return existing

  const { data, error } = await supabase.from('shop_products')
    .insert({ shop_id: shopId, product_id: productId, available }).select('available').single()
  if (error?.code === '23505') return dataFrom(update().single())
  if (error) throw error
  return data
}

export const loadCustomers = ([offset, search], signal) => dataFrom(supabase.rpc('admin_customers', {
  p_offset: offset, p_search: search,
}), signal)

export const loadCustomerBonuses = ([userId, offset], signal) => dataFrom(supabase.from('bonus_transactions')
  .select('order_id,kind,amount_kopecks,created_at,orders(order_number)').eq('user_id', userId)
  .order('created_at', { ascending: false }).order('order_id', { ascending: false }).order('kind', { ascending: false })
  .range(offset, offset + pageSize), signal)
