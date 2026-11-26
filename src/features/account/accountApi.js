import { supabase } from '../../lib/supabase.js'

const profileFields = 'display_name,contact_phone,bonus_balance_kopecks'

export async function loadProfile(userId, signal) {
  const { data, error } = await supabase.from('profiles').select(profileFields)
    .eq('user_id', userId).abortSignal(signal).single()
  if (error) throw error
  return data
}

export async function saveProfile(userId, displayName, phone) {
  const { data, error } = await supabase.from('profiles')
    .update({ display_name: displayName, contact_phone: phone })
    .eq('user_id', userId).select(profileFields).single()
  if (error) throw error
  return data
}

const historyFields = {
  orders: 'id,order_number,shop_id,status,pickup_at,subtotal_kopecks,bonus_used_kopecks,total_due_kopecks,order_items(line_number,product_name,variant_name,modifiers,quantity,line_total_kopecks)',
  bonus_transactions: 'order_id,kind,amount_kopecks,created_at',
}

export const historyPageSize = 12

export async function loadHistory(table, userId, offset, signal) {
  const { data, error } = await supabase.from(table).select(historyFields[table])
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order(table === 'orders' ? 'id' : 'order_id', { ascending: false })
    .range(offset, offset + historyPageSize).abortSignal(signal)
  if (error) throw error
  return data
}
