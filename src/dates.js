/**
 * When the tournament is played.
 *
 * The date was free text — "Friday 5 Sep, 19:00" — which reads well in WhatsApp
 * and is useless everywhere else: a date picker can't open on it, a list can't
 * sort by it, and "Friday" stays Friday forever. So the column holds an ISO
 * `YYYY-MM-DD` plus a separate `HH:MM`, and the prose is generated on the way
 * out. {@link parseWhen} is the funnel: the form posts ISO already, the bot
 * posts whatever the host typed into the group, and both land in the same shape.
 *
 * Everything here works in the club's own timezone (`TZ` in compose), because
 * "is this date in the past" is a question about the club's evening, not UTC's.
 */

import { translator } from './i18n.js'

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december']
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
// The club is in Matosinhos, so half the group will type the day or the month
// in Portuguese. Matched by prefix, which is why "sabado" and "sábado" both land.
const DAYS_PT = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']
const MONTHS_PT = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
// Written out for display; the matcher above works off accent-stripped prefixes,
// but the board and the console print the real spelling.
const DAYS_PT_LONG = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
  'quinta-feira', 'sexta-feira', 'sábado']
const MONTHS_PT_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
// Ukrainian, for the third language the group runs in. Months in the genitive,
// which is how a date is read out: 5 вересня. The matcher uses the same stems.
const DAYS_UK = ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', 'п’ятниця', 'субота']
const MONTHS_UK = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня',
  'серпня', 'вересня', 'жовтня', 'листопада', 'грудня']
// A plain apostrophe is what a phone keyboard produces for п'ятниця.
const uk = (w) => w.replace(/’/g, "'")
// Spanish, the fourth language. Accent-stripped for the matcher, like Portuguese;
// written out properly for display.
const DAYS_ES = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DAYS_ES_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

const pad = (n) => String(n).padStart(2, '0')

/** Today, as the club sees it. */
export const todayISO = (now = new Date()) =>
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

/** ISO string → a Date at local midnight, or null if it isn't a real calendar day. */
export function toDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''))
  if (!m) return null
  const [y, mo, d] = m.slice(1).map(Number)
  const dt = new Date(y, mo - 1, d)
  // Rejects 2026-02-30, which the constructor would happily roll into March.
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? dt : null
}

export const isISODate = (s) => toDate(s) !== null
export const isTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ''))

const shift = (dt, days) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + days)

/**
 * Pull a date and a time out of free text.
 *
 * Handles the forms a host types into a group chat: `2026-09-05`, `05/09/2026`,
 * `5/9` (day first — this is Portugal, not Kansas), `5 Sep`, `Sep 5`, `Friday`,
 * `tomorrow`, each optionally carrying `19:00`, `19h30` or `7pm`. A bare weekday
 * or a date with no year resolves *forward*: "Friday" in December is January's
 * Friday, never one that has already happened.
 */
export function parseWhen(input, { now = new Date(), lang } = {}) {
  const raw = String(input ?? '').trim()
  if (!raw) return { ok: true, date: '', time: '' }

  let s = raw.replace(/[<>()]/g, ' ').replace(/[,]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()

  // Time first, so its digits can't be mistaken for a day of the month.
  let time = ''
  const ampm = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/)
  const hhmm = s.match(/\b([01]?\d|2[0-3])\s*[:h.]\s*([0-5]\d)\b/)
  if (ampm) {
    let h = Number(ampm[1]) % 12
    if (ampm[3] === 'pm') h += 12
    time = `${pad(h)}:${ampm[2] || '00'}`
    s = (s.slice(0, ampm.index) + ' ' + s.slice(ampm.index + ampm[0].length)).trim()
  } else if (hhmm) {
    time = `${pad(Number(hhmm[1]))}:${hhmm[2]}`
    s = (s.slice(0, hhmm.index) + ' ' + s.slice(hhmm.index + hhmm[0].length)).trim()
  } else {
    // "19h" on its own: a whole hour, the way Portuguese writes one.
    const bare = s.match(/(^|\s)([01]?\d|2[0-3])h(?=\s|$)/)
    if (bare) {
      time = `${pad(Number(bare[2]))}:00`
      s = (s.slice(0, bare.index) + ' ' + s.slice(bare.index + bare[0].length)).trim()
    }
  }
  // "at", "às", and the Ukrainian "о" — dropped by whitespace, not \b, which in
  // JavaScript knows only ASCII letters and never sees a Cyrillic word end.
  s = s.replace(/(^|\s)(at|às|as|a las|a la|о)(?=\s|$)/gu, ' ').replace(/’/g, "'").replace(/\s+/g, ' ').trim()
  // Accents off, so "terça" and "terca" are the same word to the matcher below.
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  // "next friday" means the one after this week's; "this friday"/"on friday"
  // mean the same as the bare weekday.
  let strictlyNext = false
  // "next friday", "у п'ятницю", "наступної п'ятниці": the lead word says
  // which one; the Ukrainian case endings are covered by matching stems.
  const lead = s.match(/^(next|this|on|proxima|proximo|у|в|о|цієї|цього|наступн\S*)\s+/u)
  if (lead) { strictlyNext = lead[1] === 'next' || lead[1].startsWith('наступн'); s = s.slice(lead[0].length).trim() }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const out = (dt) => ({ ok: true, date: todayISO(dt), time })

  if (!s) return { ok: true, date: '', time }
  if (/^(today|hoje)$/.test(s)) return out(today)
  if (/^(tomorrow|amanhã|amanha)$/.test(s)) return out(shift(today, 1))

  // ISO — the form's own output, and the one unambiguous written form.
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) {
    const v = `${iso[1]}-${pad(Number(iso[2]))}-${pad(Number(iso[3]))}`
    return isISODate(v) ? { ok: true, date: v, time }
      : { ok: false, error: translator(lang)('dateNotReal', { raw }) }
  }

  // A bare weekday: the next one, today included — a Friday night tournament
  // gets announced on the Friday more often than not.
  const dayOf = (text) => {
    const hit = (list, i) => new RegExp(`^${list[i].slice(0, 5)}`, 'u').test(text) ||
      new RegExp(`^${list[i].slice(0, 3)}[\\p{L}]*$`, 'u').test(text)
    return DAYS.findIndex((_, i) => hit(DAYS, i) || hit(DAYS_PT, i) || hit(DAYS_ES, i) || hit(DAYS_UK.map(uk), i))
  }

  // "Friday 5 Sep" — once a real date follows, the weekday is decoration, and
  // trusting it over the date is how you announce the wrong evening.
  const head = s.split(' ')[0]
  if (s.includes(' ') && dayOf(head) >= 0) s = s.slice(head.length).trim()

  const dayIdx = dayOf(s)
  if (dayIdx >= 0) {
    const ahead = (dayIdx - today.getDay() + 7) % 7
    return out(shift(today, ahead === 0 && strictlyNext ? 7 : ahead || (strictlyNext ? 7 : 0)))
  }

  // 5/9, 05/09/2026 — day first.
  const slash = s.match(/^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?$/)
  if (slash) {
    const [d, mo] = [Number(slash[1]), Number(slash[2])]
    const year = slash[3] ? Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3]) : null
    return resolve(d, mo, year, today, time, raw, lang)
  }

  // 5 sep / sep 5 / 5 september 2026
  const words = s.match(/^(?:(\d{1,2})\s+)?([\p{L}]{3,})(?:\s+(\d{1,2}))?(?:\s+(\d{4}))?$/u)
  if (words) {
    const stem = words[2].slice(0, 3)
    const mo = MONTHS.findIndex((m, i) =>
      m.startsWith(stem) || MONTHS_PT[i].startsWith(stem) || MONTHS_ES[i].startsWith(stem)
      || MONTHS_UK[i].startsWith(stem))
    const d = Number(words[1] || words[3])
    if (mo >= 0 && d) {
      return resolve(d, mo + 1, words[4] ? Number(words[4]) : null, today, time, raw, lang)
    }
  }

  return { ok: false, error: translator(lang)('dateUnreadable', { raw }) }
}

/** Fill in a missing year with the one that puts the date ahead of us, not behind. */
function resolve(d, mo, year, today, time, raw, lang) {
  const bad = { ok: false, error: translator(lang)('dateNotReal', { raw }) }
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return bad
  if (year) {
    const v = `${year}-${pad(mo)}-${pad(d)}`
    return isISODate(v) ? { ok: true, date: v, time } : bad
  }
  for (const y of [today.getFullYear(), today.getFullYear() + 1]) {
    const v = `${y}-${pad(mo)}-${pad(d)}`
    const dt = toDate(v)
    if (dt && dt >= today) return { ok: true, date: v, time }
  }
  const v = `${today.getFullYear()}-${pad(mo)}-${pad(d)}`
  return isISODate(v) ? { ok: true, date: v, time } : bad
}

/**
 * The rules a stored date has to pass: real, not already played, not a decade
 * out. The last one is a typo guard — `2062-09-05` is a slipped finger, and it
 * would otherwise sit at the top of the list until someone noticed.
 */
export function validateWhen({ date, time }, { now = new Date(), lang } = {}) {
  const t = translator(lang)
  if (date && !isISODate(date)) return { ok: false, error: t('dateNotReal', { raw: date }) }
  if (time && !isTime(time)) return { ok: false, error: t('timeNotReal', { raw: time }) }
  if (date) {
    const dt = toDate(date)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const when = humanDate(date, { now, lang })
    if (dt < today) return { ok: false, error: t('datePast', { when }) }
    if (dt > shift(today, 730)) return { ok: false, error: t('dateTooFar', { when }) }
  }
  return { ok: true }
}

/** `2026-09-05` → `Friday 5 September` / `Sábado, 5 de setembro`. */
export function humanDate(date, { now = new Date(), lang } = {}) {
  const dt = toDate(date)
  if (!dt) return String(date || '')
  const year = dt.getFullYear() === now.getFullYear() ? '' : ` ${dt.getFullYear()}`
  if (lang === 'pt') {
    const ptYear = year ? ` de ${dt.getFullYear()}` : ''
    return `${cap(DAYS_PT_LONG[dt.getDay()])}, ${dt.getDate()} de ${MONTHS_PT_LONG[dt.getMonth()]}${ptYear}`
  }
  if (lang === 'uk') {
    return `${cap(DAYS_UK[dt.getDay()])}, ${dt.getDate()} ${MONTHS_UK[dt.getMonth()]}${year}`
  }
  if (lang === 'es') {
    const esYear = year ? ` de ${dt.getFullYear()}` : ''
    return `${cap(DAYS_ES_LONG[dt.getDay()])}, ${dt.getDate()} de ${MONTHS_ES[dt.getMonth()]}${esYear}`
  }
  return `${cap(DAYS[dt.getDay()])} ${dt.getDate()} ${cap(MONTHS[dt.getMonth()])}${year}`
}

/** Just the weekday — the board prints it on a line of its own. */
export function dayName(date, { lang } = {}) {
  const dt = toDate(date)
  if (!dt) return ''
  const names = { pt: DAYS_PT_LONG, uk: DAYS_UK, es: DAYS_ES_LONG }[lang] || DAYS
  return cap(names[dt.getDay()])
}

/** `2026-09-05` → `05/09/2026`, day first, the way the group writes it. */
export function shortDate(date) {
  const dt = toDate(date)
  if (!dt) return ''
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()}`
}

/**
 * `11:00` + 24 min → `11:24`, wrapping past midnight rather than running off the
 * end of the day — a 90-minute tournament starting at 23:30 is a real booking.
 */
export function addMinutes(time, mins) {
  if (!isTime(time)) return ''
  const [h, m] = time.split(':').map(Number)
  const total = (((h * 60 + m + Math.round(Number(mins) || 0)) % 1440) + 1440) % 1440
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}

/**
 * Portugal reads a 24-hour clock and the English-speaking half of the group
 * doesn't, so the two languages genuinely differ here, not just in their words.
 */
const clockFmt = (lang) => (lang === 'pt'
  ? (hh, mm) => `${hh}h${mm ? pad(mm) : ''}`
  : lang === 'uk' || lang === 'es'
    ? (hh, mm) => `${pad(hh)}:${pad(mm)}`
    : (hh, mm) => `${((hh + 11) % 12) + 1}${mm ? `:${pad(mm)}` : ''}${hh < 12 ? 'AM' : 'PM'}`)

/** One time, in the club's own convention: `11AM` / `11h`, `11:24AM` / `11h24`. */
export function clock(time, { lang } = {}) {
  if (!isTime(time)) return ''
  const [h, m] = time.split(':').map(Number)
  return clockFmt(lang)(h, m)
}

/**
 * `11:00` + 120 min → `11AM-1PM` in English, `11h-13h` in Portuguese.
 *
 * The end is the start plus the duration, so the range moves whenever the
 * tournament's own settings do — that is the whole point of generating it
 * rather than typing it into the group by hand.
 */
export function timeRange(time, durationMin, { lang } = {}) {
  if (!isTime(time)) return ''
  const from = clock(time, { lang })
  return durationMin ? `${from}-${clock(addMinutes(time, durationMin), { lang })}` : from
}

/** The one-line form the board, the console and the TV all print. */
export function humanWhen({ play_date, play_time }, { now = new Date(), lang, tbc } = {}) {
  if (!play_date) return tbc ?? translator(lang)('dateTBC')
  const d = humanDate(play_date, { now, lang })
  return play_time ? `${d}, ${play_time}` : d
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

/** Sort key that keeps blank dates last instead of first. */
export const whenKey = (t) => t.play_date || '9999-99-99'
