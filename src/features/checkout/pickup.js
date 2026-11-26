const minuteMs = 60_000
const preparation = 15
const slotStep = 15
const kyivClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Kyiv',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
})

function kyivParts(time) {
  return Object.fromEntries(kyivClock.formatToParts(time).map(({ type, value }) => [type, Number(value)]))
}

export function formatClock(minutes) {
  const hour = String(Math.floor(minutes / 60)).padStart(2, '0')
  const minute = String(minutes % 60).padStart(2, '0')
  return `${hour}:${minute}`
}

export function formatShopHours(shop) {
  return `${formatClock(shop.hours.opens)}–${formatClock(shop.hours.closes)}`
}

export function pickupOptions(shop, now) {
  if (!shop) return { status: 'no-shop', asap: null, slots: [] }

  const { year, month, day, hour, minute } = kyivParts(now)
  const localTime = hour * 60 + minute
  const { opens, closes } = shop.hours
  if (localTime >= closes) return { status: 'closed', asap: null, slots: [] }

  const beforeOpening = localTime < opens
  const roundedTime = localTime + (now.getTime() % minuteMs !== 0 ? 1 : 0)
  const earliest = Math.max(opens, roundedTime) + preparation
  if (earliest >= closes) return { status: 'no-time', asap: null, slots: [] }

  const wallDate = Date.UTC(year, month - 1, day)
  // All shops are open in daytime, after the early-morning Kyiv clock change.
  const noon = kyivParts(wallDate + 12 * 60 * minuteMs)
  const offset = (noon.hour * 60 + noon.minute - 12 * 60) * minuteMs
  const slotAt = (time) => ({
    at: new Date(wallDate + time * minuteMs - offset).toISOString(),
    label: formatClock(time),
  })

  const slots = []
  for (let time = Math.ceil(earliest / slotStep) * slotStep; time < closes; time += slotStep) {
    slots.push(slotAt(time))
  }
  return { status: beforeOpening ? 'before-opening' : 'open', asap: beforeOpening ? null : slotAt(earliest), slots }
}
