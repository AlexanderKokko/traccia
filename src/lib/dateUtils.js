const MONTHS = {
  it: [
    'gennaio',
    'febbraio',
    'marzo',
    'aprile',
    'maggio',
    'giugno',
    'luglio',
    'agosto',
    'settembre',
    'ottobre',
    'novembre',
    'dicembre',
  ],
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
}

const WEEKDAYS = {
  it: ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
}

/** "lunedì 8 settembre 2025" / "Monday, September 8 2025" */
export function formatLongDate(date, lang = 'it') {
  const d = typeof date === 'string' ? new Date(date) : date
  const weekday = WEEKDAYS[lang][d.getDay()]
  const day = d.getDate()
  const month = MONTHS[lang][d.getMonth()]
  const year = d.getFullYear()
  return lang === 'en'
    ? `${weekday}, ${month} ${day} ${year}`
    : `${weekday} ${day} ${month} ${year}`
}

/** "8 settembre 2025" / "September 8, 2025" */
export function formatShortDate(date, lang = 'it') {
  const d = typeof date === 'string' ? new Date(date) : date
  return lang === 'en'
    ? `${MONTHS[lang][d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
    : `${d.getDate()} ${MONTHS[lang][d.getMonth()]} ${d.getFullYear()}`
}

/** "08/09/2025" — falls back to a localized "not specified" label. */
export function formatDateInput(iso, lang = 'it') {
  if (!iso) return lang === 'en' ? 'Date not specified' : 'Data non specificata'
  const d = new Date(iso)
  const dd = d.getDate().toString().padStart(2, '0')
  const mm = (d.getMonth() + 1).toString().padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

/** Today in local time as YYYY-MM-DD. */
export function todayISO() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0]
}

/** YYYY-MM-DD, `days` before `iso`. */
export function subtractDays(iso, days) {
  const d = new Date(iso)
  d.setDate(d.getDate() - days)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]
}

/** Whole days between today and `iso` (negative in the past). */
export function daysUntil(iso) {
  const target = new Date(iso)
  target.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target - today) / 86400000)
}

export function getGreeting(lang = 'it') {
  const h = new Date().getHours()
  if (lang === 'en') return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  return h < 12 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera'
}

export function getPeriodDays(period) {
  switch (period) {
    case '7g':
      return 7
    case '14g':
      return 14
    case '30g':
      return 30
    case '90g':
      return 90
    default:
      return 7
  }
}

export function getPeriodLabel(period, lang = 'it') {
  const labels = {
    it: {
      '7g': 'Ultimi 7 giorni',
      '14g': 'Ultime 2 settimane',
      '30g': 'Ultimo mese',
      '90g': 'Ultimi 3 mesi',
    },
    en: {
      '7g': 'Last 7 days',
      '14g': 'Last 2 weeks',
      '30g': 'Last month',
      '90g': 'Last 3 months',
    },
  }
  return (labels[lang] || labels.it)[period] || (labels[lang] || labels.it)['7g']
}

/**
 * Consecutive days with a diary entry, counting back from today.
 * A missing entry for *today* is tolerated (the day is not over yet).
 */
export function computeStreak(entries) {
  const dates = new Set(entries.map((e) => e.entry_date))
  let cursor = todayISO()
  if (!dates.has(cursor)) {
    cursor = subtractDays(cursor, 1)
    if (!dates.has(cursor)) return 0
  }
  let streak = 0
  while (dates.has(cursor)) {
    streak++
    cursor = subtractDays(cursor, 1)
  }
  return streak
}
