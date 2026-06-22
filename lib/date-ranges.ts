export interface DateRange {
  from: string
  to: string
}

export function toDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDateInput(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function currentWeekRange(now = new Date()): DateRange {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekday = monday.getDay()
  monday.setDate(monday.getDate() + (weekday === 0 ? -6 : 1 - weekday))

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  return { from: toDateInput(monday), to: toDateInput(sunday) }
}

export function currentMonthRange(now = new Date()): DateRange {
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { from: toDateInput(firstDay), to: toDateInput(lastDay) }
}
