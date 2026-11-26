export const orderStatuses = {
  new: 'Нове', accepted: 'Прийнято', preparing: 'Готується',
  ready: 'Готове до видачі', completed: 'Виконано', cancelled: 'Скасовано',
}

export const bonusKinds = { earn: 'Нарахування', reserve: 'Списання', return: 'Повернення' }

const bonusCurrency = new Intl.NumberFormat('uk-UA', {
  style: 'currency', currency: 'UAH', minimumFractionDigits: 2, maximumFractionDigits: 2,
})
const kyivDateTime = new Intl.DateTimeFormat('uk-UA', {
  timeZone: 'Europe/Kyiv', dateStyle: 'medium', timeStyle: 'short',
})

export function formatBonus(kopecks) {
  return bonusCurrency.format(kopecks / 100)
}

export function formatOrderTime(value) {
  return kyivDateTime.format(new Date(value))
}
