const minuteMs = 60_000
const preparation = 15
const slotStep = 15
const timeZone = 'Europe/Kyiv'
const kyivClock = new Intl.DateTimeFormat('en-GB', {
  timeZone,
  year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
})

function kyivParts(time) {
  return Object.fromEntries(kyivClock.formatToParts(time).map(({ type, value }) => [type, Number(value)]))
}

function wallDate({ year, month, day }) {
  return Date.UTC(year, month - 1, day)
}

function wallDateKey(value) {
  const date = new Date(value)
  return [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0')).join('-')
}

export function kyivDateTimeToDate(dateKey, minutes = 0) {
  const [year, month, day] = dateKey.split('-').map(Number)
  let utc = Date.UTC(year, month - 1, day) + minutes * minuteMs
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = kyivParts(new Date(utc))
    const actualWall = wallDate(parts) + (parts.hour * 60 + parts.minute) * minuteMs + parts.second * 1000
    const requestedWall = Date.UTC(year, month - 1, day) + minutes * minuteMs
    utc += requestedWall - actualWall
  }
  return new Date(utc).toISOString()
}

export function addDays(dateKey, days) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return wallDateKey(Date.UTC(year, month - 1, day + days))
}

export function formatClock(minutes) {
  const hour = String(Math.floor(minutes / 60) % 24).padStart(2, '0')
  const minute = String(minutes % 60).padStart(2, '0')
  return `${hour}:${minute}`
}

export function formatShopHours(shop) {
  return `${formatClock(shop.hours.opens)}–${formatClock(shop.hours.closes)}`
}

export function formatPickupDate(dateKey) {
  return new Intl.DateTimeFormat('uk-UA', { timeZone, day: 'numeric', month: 'long' })
    .format(new Date(`${dateKey}T12:00:00+03:00`))
}

export function pickupDateKeys(now) {
  const today = wallDateKey(wallDate(kyivParts(now)))
  return { today, tomorrow: addDays(today, 1) }
}

function normalizedClosing(opens, closes) {
  return closes <= opens ? closes + 1440 : closes
}

function dayMinutes(parts) {
  return parts.hour * 60 + parts.minute + parts.second / 60
}

export function pickupOptions(shop, now, dateKey = pickupDateKeys(now).today) {
  if (!shop) return { status: 'no-shop', dateKey, asap: null, slots: [] }

  const current = kyivParts(now)
  const today = wallDateKey(wallDate(current))
  const selectedDay = dateKey === today ? 0 : dateKey === addDays(today, 1) ? 1 : null
  if (selectedDay === null) return { status: 'invalid-date', dateKey, asap: null, slots: [] }

  const opens = shop.hours.opens
  const closes = normalizedClosing(opens, shop.hours.closes)
  const localNow = dayMinutes(current)
  const earliestToday = Math.ceil(localNow + (now.getUTCMilliseconds() ? 1 / 60000 : 0)) + preparation
  const windows = closes > 1440 ? [[opens - 1440, closes - 1440], [opens, closes]] : [[opens, closes]]
  const slotAt = (minutes) => ({ at: kyivDateTimeToDate(dateKey, minutes), label: formatClock(minutes) })
  const slots = []
  for (const [windowStart, windowEnd] of windows) {
    const earliest = selectedDay === 0 ? earliestToday : 0
    const firstSlot = windowStart + Math.max(1, Math.ceil((earliest - windowStart) / slotStep)) * slotStep
    for (let time = firstSlot; time < 1440 && time <= windowEnd - preparation; time += slotStep) {
      const slot = slotAt(time)
      const local = kyivParts(new Date(slot.at))
      if (dayMinutes(local) === time && Date.parse(slot.at) > now.getTime()) slots.push(slot)
    }
  }

  const currentWindow = windows.find(([start, end]) => localNow >= start && localNow < end)
  const beforeOpening = selectedDay === 0 && !currentWindow && localNow < opens
  const canAsap = selectedDay === 0 && currentWindow && earliestToday < Math.min(currentWindow[1], 1440)
  let status = 'open'
  if (beforeOpening) status = 'before-opening'
  else if (selectedDay === 0 && !currentWindow) status = 'closed'
  else if (selectedDay === 0 && !canAsap) status = 'no-time'
  return { status, dateKey, asap: canAsap ? slotAt(earliestToday) : null, slots }
}
