import {
  addSignup, clubLanguage, clubRules, createTournament, currentTournament,
  getClub, listSignups, removeSignup,
} from './db.js'
import { buildTeams, slots } from './formats/nonstop.js'
import { dayName, humanWhen, parseWhen, shortDate, timeRange, validateWhen } from './dates.js'
import { levelHelp, levelTight, parseLevel } from './levels.js'
import { translator } from './i18n.js'

/**
 * The WhatsApp command language.
 *
 * Three commands, because a group chat is a terrible place to learn a syntax:
 * the host opens a tournament, players say they are in or out, and everything
 * else is the bot talking. Commands are matched case-insensitively and tolerate
 * the angle brackets from the spec being present or absent, because people will
 * copy the example literally and people will also not.
 */

const KEYS = ['level', 'date', 'courts', 'duration', 'round']

/**
 * `!tournament non-stop level <MX-4> date <2026-09-05> courts <3> duration 90`
 *
 * Returns `{ok:false, error}` rather than a tournament when the level or the
 * date won't parse. The level used to be stored verbatim, so a typo opened a
 * night nobody could self-select into and left the console with a value its
 * picker could not show; the date used to stay the word "Friday" forever.
 */
function parseTournament(rest, { now = new Date(), lang } = {}) {
  const t = translator(lang)
  const clean = rest.replace(/[<>]/g, ' ')
  const out = { format: 'non-stop' }
  // Each key takes the words up to the next key, so a date can contain spaces.
  const re = new RegExp(`\\b(${KEYS.join('|')})\\b\\s*:?\\s*`, 'gi')
  const hits = [...clean.matchAll(re)]
  hits.forEach((h, i) => {
    const from = h.index + h[0].length
    const to = i + 1 < hits.length ? hits[i + 1].index : clean.length
    out[h[1].toLowerCase()] = clean.slice(from, to).trim()
  })
  const head = (hits[0] ? clean.slice(0, hits[0].index) : clean).trim()
  if (/americano/i.test(head)) out.format = 'americano'

  const level = parseLevel(out.level, { lang })
  if (!level.ok) return { ok: false, error: `${level.error}\n\n${levelHelp(t)}` }

  // The date stays optional from the group — a host who knows the level but not
  // the evening can still open the board — but if one is given it has to be real.
  const when = parseWhen(out.date, { now, lang })
  if (!when.ok) return { ok: false, error: when.error }
  const valid = validateWhen(when, { now, lang })
  if (!valid.ok) return { ok: false, error: valid.error }

  return {
    ok: true,
    value: {
      format: out.format,
      level: level.code,
      play_date: when.date,
      play_time: when.time,
      courts: Number.parseInt(out.courts || '', 10) || 2,
      duration_min: Number.parseInt(out.duration || '', 10) || 90,
      round_min: Number.parseInt(out.round || '', 10) || 12,
    },
  }
}

/**
 * `!in Mike M partner Sofia` — and the four other ways people will write it.
 *
 * Gender is a bare M/F/X token or the words; partner is whatever follows
 * "partner", "with", "+" or "&". Anything left over is the name, so `!in Mike`
 * works and so does `!in Mike (M) with Sofia`.
 */
function parseSignup(rest) {
  let s = rest.replace(/[<>()]/g, ' ').trim()
  let partner = ''
  // The word forms need a boundary; "+" and "&" must not ask for one, because
  // "Carla F & Nuno" has a space before the ampersand and \b never matches
  // there — which silently made the whole line one very long name.
  const pm = s.match(/(?:\b(?:partner|with)\b|[+&])\s*(.+)$/i)
  if (pm) { partner = pm[1].trim(); s = s.slice(0, pm.index).trim() }

  let gender = ''
  const gm = s.match(/\b(m|male|f|female|x)\b/i)
  if (gm) {
    const g = gm[1].toLowerCase()
    gender = g.startsWith('f') ? 'F' : g === 'x' ? 'X' : 'M'
    s = (s.slice(0, gm.index) + ' ' + s.slice(gm.index + gm[1].length)).trim()
  }
  return { name: s.replace(/\s+/g, ' ').trim(), gender, partner }
}

/** Split "!in mike m partner sofia" into its command and the rest. */
function split(text) {
  const m = String(text || '').trim().match(/^!\s*([a-z]+)\b\s*(.*)$/is)
  return m ? { cmd: m[1].toLowerCase(), rest: m[2].trim() } : null
}

/**
 * Handle one incoming message. Returns the reply text, or null to stay quiet —
 * a bot that answers everything in a group chat gets muted by lunchtime.
 */
export function handle(text, { waId = '', isHost = true, lang = clubLanguage() } = {}) {
  const parsed = split(text)
  if (!parsed) return null
  const { cmd, rest } = parsed
  const s = translator(lang)
  const OPEN_CMD = '`!tournament non-stop level MX-4 date 2026-09-05 11:00 courts 3 duration 120`'
  const IN_CMD = '`!in Mike M partner Sofia`'

  if (cmd === 'tournament') {
    if (!isHost) return s('onlyHostOpens')
    const parsedT = parseTournament(rest, { lang })
    if (!parsedT.ok) return `⚠️ ${parsedT.error}`
    return boardMessage(createTournament(parsedT.value), '', lang)
  }

  if (cmd === 'in') {
    const t = currentTournament()
    if (!t) return s('noTournamentOpen', { cmd: OPEN_CMD })
    const p = parseSignup(rest)
    if (!p.name) return s('needAName', { cmd: IN_CMD })
    addSignup(t.id, { ...p, wa_id: waId })
    return boardMessage(t, '', lang)
  }

  if (cmd === 'out') {
    const t = currentTournament()
    if (!t) return null
    const name = parseSignup(rest).name
    if (!name) return s('whoIsDropping', { cmd: '`!out Mike`' })
    const gone = removeSignup(t.id, name)
    if (!gone) return s('notOnTheList', { name })
    return boardMessage(t, s('isOut', { name: gone.name }), lang)
  }

  if (cmd === 'list' || cmd === 'players') {
    const t = currentTournament()
    return t ? boardMessage(t, '', lang) : s('noTournamentOpenShort')
  }

  if (cmd === 'levels') return levelHelp(s)
  if (cmd === 'help') return helpMessage(lang)
  return null
}

const b = (s) => `*${s}*`

/** The slot emoji the group already uses. Category decides which ones appear. */
const SLOT = { F: '👩🏻', M: '👦🏼' }

/**
 * The sign-up board, re-posted on every change.
 *
 * This is the club's own WhatsApp format, generated instead of retyped: the
 * weekday and the date come from the tournament's date, the time range is its
 * start plus its duration, the level and the court count are its settings, and
 * the slot list is `courts × 4` long — so changing a tournament from three
 * courts to four adds four blanks rather than needing a new message written by
 * hand. The empty slots are the point of the format: they are what makes
 * somebody reply.
 */
export function boardMessage(t, prefix = '', lang = clubLanguage()) {
  const s = translator(lang)
  const club = getClub()
  const { teams, waiting } = buildTeams(listSignups(t.id))
  const level = parseLevel(t.level)
  const category = level.ok ? level.category : 'MX'
  const { board, reserves, size, taken } = slots(teams, waiting, { courts: t.courts, category })

  const lines = []
  if (prefix) lines.push(prefix, '')

  if (t.play_date) {
    lines.push(`📆 ${dayName(t.play_date, { lang })}`)
    lines.push(shortDate(t.play_date))
  } else {
    lines.push(`📆 ${s('dateTBC')}`)
  }
  const range = timeRange(t.play_time, t.duration_min, { lang })
  if (range) lines.push(`🕒 ${range}`)
  lines.push(`📈 ${s('boardFormat')} ${levelTight(t.level) || '—'}`)
  lines.push('')
  lines.push(`📍 ${club.name}`)
  if (club.maps_url) lines.push(club.maps_url)
  lines.push('')
  lines.push(`${t.courts} ${s('courtsWord')}`)
  lines.push('')

  for (const slot of board) {
    // An empty slot shows what the level is asking for; a taken one shows who is
    // actually in it. They agree almost always — and when they don't, the board
    // says so out loud: two 👦🏼 in a row on a mixed night, or one 👩🏻 in a
    // men's list, is the mismatch a host needs to see before the draw.
    const want = SLOT[slot.want] || SLOT.M
    if (!slot.player) { lines.push(want); continue }
    lines.push(`${SLOT[slot.player.gender] || want} ${slot.player.name}`)
  }

  if (reserves.length) {
    lines.push('', b(`${s('reserves')} (${reserves.length})`))
    reserves.forEach((p) => lines.push(`• ${p.name}`))
  }

  lines.push('')
  // Blanks say "there is room" on their own; a full board can't, so it says so.
  lines.push(taken >= size
    ? (reserves.length ? s('boardFull', { n: reserves.length }) : s('boardFullClean'))
    : s('whosIn'))
  lines.push(s('signupHint', { cmd: '`!in Mike M partner Sofia`' }))
  lines.push(s('dropoutHint', { cmd: '`!out Mike`' }))

  const rules = clubRules(lang)
  if (rules) lines.push('', b(s('important')), rules)

  return lines.join('\n')
}

/** Kept as names because the console and the API both ask for them. */
export const signupMessage = (t, prefix = '', lang) => boardMessage(t, prefix, lang)
export const openedMessage = (t, lang) => boardMessage(t, '', lang)

export function helpMessage(lang = clubLanguage()) {
  const s = translator(lang)
  return [
    `🎾 ${b(s('appName'))}`,
    '',
    b(s('helpHost')),
    '`!tournament non-stop level MX-4 date 2026-09-05 11:00 courts 3 duration 120`',
    '',
    b(s('helpPlayers')),
    `\`!in Mike M partner Sofia\` — ${s('helpSignUpAsPair')}`,
    `\`!out Mike\` — ${s('helpCancel')}`,
    `\`!list\` — ${s('helpWhoIsIn')}`,
    `\`!levels\` — ${s('helpWhatLevel')}`,
    '',
    `_${s('helpDates', { examples: '`2026-09-05`, `5 Sep`, `sexta 19:00`, `Friday`' })}_`,
  ].join('\n')
}

export const _test = { parseTournament, parseSignup, split }
