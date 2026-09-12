/**
 * Read a night out of the message the club already writes.
 *
 * The group posts a fixed shape — a date line, a time line, a level/venue line,
 * then a numbered list of players, one per line, in blocks of four — and the
 * host currently retypes it into whatever runs the night. This reads that
 * message as posted, sloppiness included: `09:30- 11:30`, `9 🎾 rafa Campos`,
 * `14🎾Tiago Delgado (dupla)`, a missing space after the racket, a name in
 * lowercase. What it cannot read it says so, per field, and leaves for the host
 * to fill in on the form — a message is never rejected whole because one line
 * was odd.
 *
 *   📅 13/09/26 - Domingo
 *   ⏱ 09:30- 11:30
 *   M9 - MAIA
 *   1🎾 Rui Basto
 *   2🎾 Rui Magalhaes
 *   …
 *   13🎾Pedro Delgado
 *   14🎾Tiago Delgado (dupla)      ← a pair with the line above
 */

import { addMinutes, isTime, parseWhen } from './dates.js'
import { parseLevel } from './levels.js'
import { translator } from './i18n.js'

/**
 * A clock the way people type it: 09:30, 9.30, 9h30, 9h, 9H, 9am, 9 pm.
 * Hours alone count when marked as hours ("9h") or paired by a range with
 * another clock ("9 às 11", "9-11h") — a bare "9" on its own is not a time.
 */
const CLOCK = /\b([01]?\d|2[0-3])(?:\s*[:h.]\s*([0-5]\d)|\s*[hH](?![\p{L}])|\s*(am|pm)\b)/giu
const BARE_RANGE = /\b([01]?\d|2[0-3])\s*(?:-|–|—|a|às|as|to|até)\s*([01]?\d|2[0-3])\s*[hH]?\b/iu
const pad = (n) => String(n).padStart(2, '0')

/** `rafa Campos` → `Rafa Campos`; particles like `de` stay down. */
export function tidyName(raw) {
  const PARTICLES = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'di', 'del', 'van', 'von'])
  return String(raw || '').replace(/\s+/g, ' ').trim().split(' ').map((w, i) => {
    const low = w.toLowerCase()
    if (i > 0 && PARTICLES.has(low)) return low
    // Only lift a first letter; "McDonald" and "DJ" are somebody's own spelling.
    // A short code with a digit ("m9") is a name, and reads better upper-case.
    if (/^[a-z]\d+$/.test(low)) return low.toUpperCase()
    return w === low ? low.charAt(0).toUpperCase() + low.slice(1) : w
  }).join(' ')
}

/**
 * A roster line: a number, then the racket or a separator, then a name. The
 * separator is required — "13/09/26" starts with a number too, and so does
 * "3 Courts". Any number of players is fine; nobody writes 100.
 */
const ROSTER = /^\s*(\d{1,2})\s*(?:🎾|[-–.):])\s*(.+?)\s*$/u
const PAIR_NOTE = /\(\s*(dupla|pair|par|par(?:ceiro|ceira)|with|com)\s*\)/iu

/**
 * What WhatsApp itself prepends when a message is copied from the desktop app
 * or exported: `[12/09/26, 10:15:23] Mike: ` or `12/09/26, 10:15 - Mike: `.
 * Left in, that date and time are the copy's, not the night's, and every
 * roster line starts with a bracket instead of a number.
 */
const COPY_PREFIX = /^\s*\[?\d{1,2}[/.]\d{1,2}[/.]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\]?\s*[-–]?\s*[^:\n]{1,40}:\s*/u

export function parseBoard(text, { now = new Date(), lang } = {}) {
  const t = translator(lang)
  const lines = String(text || '').replace(/\r/g, '').split('\n')
    .map((l) => l.replace(COPY_PREFIX, '').replace(/\uFE0F/g, ''))
  const out = {
    date: '', time: '', duration_min: 0, level: '', location: '',
    courts: 0, players: [], warnings: [],
  }

  // Header lines are the ones before the first numbered player.
  const firstPlayer = lines.findIndex((l) => ROSTER.test(l))
  const head = (firstPlayer >= 0 ? lines.slice(0, firstPlayer) : lines).map((l) => l.trim()).filter(Boolean)
  const body = firstPlayer >= 0 ? lines.slice(firstPlayer) : []

  for (const line of head) {
    const bare = line.replace(/^[^\p{L}\p{N}]+/u, '').trim()      // drop a leading emoji
    // Date: the first dd/mm(/yy) on a line; the weekday after it is decoration.
    const d = bare.match(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/)
    if (d && !out.date) {
      const when = parseWhen(d[0], { now, lang })
      if (when.ok && when.date) out.date = when.date
      else out.warnings.push(when.error || t('importBadDate', { raw: d[0] }))
      continue
    }
    // Time: one clock is a start, two are a window and give the duration.
    let clocks = [...bare.matchAll(CLOCK)].map((m) => {
      let h = Number(m[1])
      if (m[3]) { h = h % 12 + (m[3].toLowerCase() === 'pm' ? 12 : 0) }
      return `${pad(h)}:${m[2] || '00'}`
    })
    // "9 às 11" / "9-11h": two bare hours joined as a range. It wins over a
    // lone "11h" found in the same line, and only counts on a line that is
    // about time — it carries a clock emoji, or no time has been found yet.
    const range = clocks.length < 2 && (/[⏱🕒🕐🕑🕓🕔🕕🕖🕗🕘🕙🕚🕛]/u.test(line) || !out.time)
      && bare.match(BARE_RANGE)
    if (range) clocks = [`${pad(Number(range[1]))}:00`, `${pad(Number(range[2]))}:00`]
    if (clocks.length && !out.time) {
      out.time = clocks[0]
      if (clocks[1] && isTime(clocks[1])) {
        const [h1, m1] = clocks[0].split(':').map(Number)
        const [h2, m2] = clocks[1].split(':').map(Number)
        const mins = ((h2 * 60 + m2) - (h1 * 60 + m1) + 1440) % 1440
        if (mins) out.duration_min = mins
      }
      continue
    }
    // Level, if the line has one that is actually a level: `MX4 - Padel Tribe`,
    // `Nonstop MX4`. A code that does not parse is not a level — `M9 - MAIA`
    // is a club called M9, in Maia — so the whole line is the venue instead.
    const lv = bare.match(/\b(MX|M|F)\s*-?\s*(\d)\b/i)
    const parsed = lv ? parseLevel(`${lv[1].toUpperCase()}-${lv[2]}`, { lang }) : { ok: false }
    if (parsed.ok && !out.level) {
      out.level = parsed.code
      const rest = bare.replace(/nonstop|non-stop/i, '').replace(lv[0], '').replace(/^[\s\-–·:]+|[\s\-–·:]+$/g, '')
      if (rest && !out.location) out.location = tidyName(rest.toLowerCase())
      continue
    }
    // Anything else in the header is where the night is.
    if (!out.location && /\p{L}/u.test(bare)) out.location = tidyName(bare.toLowerCase())
  }
  if (!out.level) out.warnings.push(t('importNoLevel'))

  // The roster. "(dupla)" on a line pairs it with the line above.
  let prev = null
  for (const line of body) {
    const m = line.match(ROSTER)
    if (!m || !line.trim()) continue
    let name = m[2].replace(/^🎾\s*/u, '')
    const isPair = PAIR_NOTE.test(name)
    name = tidyName(name.replace(PAIR_NOTE, '').replace(/\(.*?\)/g, '').trim())
    if (!name) continue
    const player = { n: Number(m[1]), name, partner: '' }
    if (isPair && prev) { player.partner = prev.name; prev.partner = name }
    out.players.push(player)
    prev = player
  }

  // Duplicates are a real thing in a sixteen-line paste; the second one is
  // usually a typo of the first, and the host should see it rather than get a
  // silent "1 player" where they expected 2.
  const seen = new Map()
  for (const p of out.players) {
    const k = p.name.toLowerCase()
    if (seen.has(k)) out.warnings.push(t('importDuplicate', { name: p.name }))
    seen.set(k, true)
  }

  if (!out.players.length) out.warnings.push(t('importNoPlayers'))
  if (!out.date) out.warnings.push(t('importNoDate'))
  if (!out.time) out.warnings.push(t('importNoTime'))
  out.courts = Math.max(1, Math.ceil(out.players.length / 4))
  if (!out.duration_min) out.duration_min = 90
  out.end = out.time ? addMinutes(out.time, out.duration_min) : ''
  return out
}
