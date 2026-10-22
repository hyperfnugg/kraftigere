// ISO weeks: Monday to Sunday, and week 1 holds the year's first Thursday.
// Week ids look like 2026-W44. Counted in UTC days so daylight saving can't shift them.
export function isoWeekId(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const week = Math.ceil(((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86_400_000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

// The week's Monday, as a local date.
export function weekMonday(id: string) {
  const [year, week] = id.split('-W').map(Number)
  const jan4 = new Date(year, 0, 4)
  return new Date(year, 0, 4 - ((jan4.getDay() + 6) % 7) + (week - 1) * 7)
}

export function addWeeks(id: string, n: number) {
  const monday = weekMonday(id)
  return isoWeekId(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7 * n))
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']

// "Uke 44 · 26. okt–1. nov"
export function weekLabel(id: string) {
  const monday = weekMonday(id)
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6)
  const day = (d: Date) => `${d.getDate()}. ${MONTHS[d.getMonth()]}`
  return `Uke ${Number(id.split('-W')[1])} · ${day(monday)}–${day(sunday)}`
}

// "fre. 23. okt 14:05"
export function timeLabel(d: Date) {
  const weekday = ['søn.', 'man.', 'tir.', 'ons.', 'tor.', 'fre.', 'lør.'][d.getDay()]
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${weekday} ${d.getDate()}. ${MONTHS[d.getMonth()]} ${time}`
}
