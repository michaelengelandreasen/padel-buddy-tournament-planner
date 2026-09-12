import {
  addSignup, clubLanguage, clubRules, createTournament, currentTournament,
  getClub, listMatches, listSignups, playingTournament, removeSignup,
} from './db.js'
import { buildTeams, slots, standings } from './formats/nonstop.js'
import { clock, dayName, parseWhen, shortDate, timeRange, validateWhen } from './dates.js'
import {
  courtsByTeam, currentRound, findGame, opponentIn, roundPlan, roundsOf, teamsNamed,
} from './rounds.js'
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
 * Handle one incoming message. Returns `{text, meta}`, or null to stay quiet — a
 * bot that answers everything in a group chat gets muted by lunchtime.
 *
 * `meta` is how the reply should be posted rather than what it says. The sign-up
 * board carries a key and a pin, so a channel that can edit (Telegram) keeps one
 * pinned message correct instead of posting twenty near-identical ones; a round
 * message deliberately carries neither, because it has to arrive on a phone.
 */
export function handle(text, { waId = '', isHost = true, lang = clubLanguage() } = {}) {
  const parsed = split(text)
  if (!parsed) return null
  const { cmd, rest } = parsed
  const s = translator(lang)
  const say = (body, meta = {}) => (body == null ? null : { text: body, meta })
  const board = (t, prefix = '') =>
    say(boardMessage(t, prefix, lang), { key: `board:${t.id}`, pin: true, reason: 'board' })
  const OPEN_CMD = '`!tournament non-stop level MX-4 date 2026-09-05 11:00 courts 3 duration 120`'
  const IN_CMD = '`!in Mike M partner Sofia`'

  if (cmd === 'tournament') {
    if (!isHost) return say(s('onlyHostOpens'))
    const parsedT = parseTournament(rest, { lang })
    if (!parsedT.ok) return say(`⚠️ ${parsedT.error}`)
    return board(createTournament(parsedT.value))
  }

  if (cmd === 'in') {
    const t = currentTournament()
    if (!t) return say(s('noTournamentOpen', { cmd: OPEN_CMD }))
    const p = parseSignup(rest)
    if (!p.name) return say(s('needAName', { cmd: IN_CMD }))
    addSignup(t.id, { ...p, wa_id: waId })
    return board(t)
  }

  if (cmd === 'out') {
    const t = currentTournament()
    if (!t) return null
    const name = parseSignup(rest).name
    if (!name) return say(s('whoIsDropping', { cmd: '`!out Mike`' }))
    const gone = removeSignup(t.id, name)
    if (!gone) return say(s('notOnTheList', { name }))
    return board(t, s('isOut', { name: gone.name }))
  }

  if (cmd === 'list' || cmd === 'players') {
    const t = currentTournament()
    return t ? board(t) : say(s('noTournamentOpenShort'))
  }

  // The night itself. These are the commands that replace walking to the wall
  // and reading a printed sheet, so they are the ones with short aliases and
  // Portuguese spellings — they get typed with one thumb, mid-tournament.
  //
  // They read the tournament being played rather than the newest one open: a
  // club announces next Friday while Saturday is still on court, and "where do I
  // go" must never answer about a night that has not started.
  const tonight = () => playingTournament() || currentTournament()

  if (cmd === 'round' || cmd === 'ronda') {
    const t = tonight()
    if (!t) return say(s('noTournamentOpenShort'))
    const matches = listMatches(t.id)
    if (!matches.length) return say(s('noScheduleYet'))
    const asked = Number.parseInt(rest, 10)
    const n = Number.isFinite(asked) ? asked : currentRound(matches)
    return say(roundMessage(t, n, lang), { reason: `round ${n}` })
  }

  if (cmd === 'next' || cmd === 'seguir') {
    const t = tonight()
    if (!t) return say(s('noTournamentOpenShort'))
    const matches = listMatches(t.id)
    if (!matches.length) return say(s('noScheduleYet'))
    const n = currentRound(matches) + 1
    return say(roundMessage(t, n, lang), { reason: `round ${n}` })
  }

  if (cmd === 'where' || cmd === 'onde') {
    const t = tonight()
    if (!t) return say(s('noTournamentOpenShort'))
    if (!rest) return say(s('whoAreYou', { cmd: '`!where Mike`' }))
    return say(whereMessage(t, rest, lang), { reason: 'where' })
  }

  if (cmd === 'table' || cmd === 'standings' || cmd === 'tabela') {
    const t = tonight()
    if (!t) return say(s('noTournamentOpenShort'))
    return say(standingsMessage(t, lang), { reason: 'standings' })
  }

  if (cmd === 'levels') return say(levelHelp(s))
  if (cmd === 'help') return say(helpMessage(lang))
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

  // Weekday and date on one line: the club writes them apart, but a phone shows
  // a two-line header as two unrelated facts, and the date is the answer to the
  // only question the header is asked.
  lines.push(t.play_date
    ? `📆 ${dayName(t.play_date, { lang })} ${shortDate(t.play_date)}`
    : `📆 ${s('dateTBC')}`)
  const range = timeRange(t.play_time, t.duration_min, { lang })
  if (range) lines.push(`🕒 ${range}`)
  lines.push(`📈 ${s('boardFormat')} ${levelTight(t.level) || '—'}`)
  lines.push('')
  // A night away from home says where; the club's map link is only the club's.
  lines.push(`📍 ${t.venue || club.name}`)
  if (!t.venue && club.maps_url) lines.push(club.maps_url)
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

/** Everything the night messages read, fetched once. */
function night(t) {
  const { teams } = buildTeams(listSignups(t.id))
  return { teams, matches: listMatches(t.id) }
}

/** `11:24 → 11:36`, or '' for a tournament with no start time to count from. */
function clockWindow(t, plan, lang) {
  const from = clock(plan.start, { lang })
  const to = clock(plan.end, { lang })
  return from && to ? `${from} → ${to}` : ''
}

/**
 * One round, as the group needs to read it: where to go now, and where to go next.
 *
 * This is the message the whole thing is for. The club currently runs its nights
 * off a printed sheet and a PDF, so between rounds twenty people walk to a wall
 * and squint at a grid to find their own name. The same information posted into
 * the group as it happens is the entire improvement — and the *next* block is
 * the half that paper does worst, because finding your next court on a grid
 * means tracing a row you have already lost your place in.
 *
 * The next block lists one line per pair rather than the fixtures, because a
 * player reading it is not asking who they play. They are asking where to stand.
 */
export function roundMessage(tour, round, lang = clubLanguage()) {
  const s = translator(lang)
  const { teams, matches } = night(tour)
  if (!matches.length) return s('noScheduleYet')

  const rounds = roundsOf(matches)
  if (!rounds.includes(round)) {
    // Asking for the round after the last one is what `!next` does on the final
    // round, and "there isn't one" is the honest, useful answer to it.
    return round > (rounds[rounds.length - 1] ?? 0)
      ? `🏁 ${s('thatWasTheLast')}\n\n${standingsMessage(tour, lang)}`
      : s('noSuchRound', { n: round, max: rounds[rounds.length - 1] ?? 0 })
  }

  const plan = roundPlan({ tournament: tour, matches, teams, round })
  const last = round === rounds[rounds.length - 1]
  const lines = [
    `🎾 ${b(s('roundOfN', { n: round, total: rounds.length }))} · ${
      s('boardFormat')} ${levelTight(tour.level) || ''}`.trim(),
  ]
  const when = clockWindow(tour, plan, lang)
  if (when) lines.push(`⏱ ${when}`)

  for (const g of plan.games) {
    const scored = g.score_a != null && g.score_b != null
    const tail = (n) => (scored ? ` — ${n}` : '')
    lines.push('', b(g.court))
    lines.push(`${g.team_a}${tail(g.score_a)}`)
    lines.push(`🆚 ${g.team_b}${tail(g.score_b)}`)
  }
  if (plan.resting.length) lines.push('', `☕ ${s('sittingOut')}: ${plan.resting.join(', ')}`)

  if (last) {
    lines.push('', `🏁 ${s('lastRoundNote')}`)
  } else {
    const nextRound = round + 1
    const nextAt = clock(plan.end, { lang })
    const courts = courtsByTeam(matches, nextRound)
    lines.push('', b(`⏭ ${s('nextRoundAt', { n: nextRound, at: nextAt || '—' })}`))
    // Sorted by court, so the block reads as a list of places rather than a list
    // of pairs — you find your name once and the court is already next to it.
    // Whoever is resting goes last: an empty court is not a place to walk to.
    const goes = teams.map((x) => x.name)
      .map((name) => ({ name, court: courts.get(name) || '' }))
      .sort((a, x) => Number(!a.court) - Number(!x.court)
        || String(a.court).localeCompare(String(x.court), undefined, { numeric: true })
        || a.name.localeCompare(x.name))
    for (const g of goes) {
      lines.push(g.court ? `${g.court} — ${g.name}` : `☕ ${g.name}`)
    }
  }

  return lines.join('\n')
}

/**
 * `!where Mike` — the same answer, for one person who does not want to read a
 * list at all.
 *
 * Matched on any word of a pair's name, so people type their own first name and
 * it works. Two pairs matching is a real Saturday (there are two Anas), and the
 * bot says so instead of picking one.
 */
export function whereMessage(tour, query, lang = clubLanguage()) {
  const s = translator(lang)
  const { teams, matches } = night(tour)
  if (!matches.length) return s('noScheduleYet')

  const hits = teamsNamed(teams, query)
  if (!hits.length) return s('notOnAnyPair', { name: query })
  if (hits.length > 1) return s('whichPair', { names: hits.map((x) => x.name).join(' · ') })

  const team = hits[0].name
  const rounds = roundsOf(matches)
  const round = currentRound(matches)
  const plan = roundPlan({ tournament: tour, matches, teams, round })
  const now = findGame(matches, round, team)

  const lines = [`📍 ${b(team)}`]
  const when = clockWindow(tour, plan, lang)
  lines.push(now
    ? `🎾 ${s('nowShort')} · ${b(now.court)}${when ? ` (${when})` : ''}`
    : `☕ ${s('restingThisRound')}${when ? ` (${when})` : ''}`)
  if (now) lines.push(`🆚 ${opponentIn(now, team)}`)

  if (round >= (rounds[rounds.length - 1] ?? 0)) {
    lines.push(`🏁 ${s('thatWasTheLast')}`)
  } else {
    const nextCourt = courtsByTeam(matches, round + 1).get(team)
    const at = clock(plan.end, { lang })
    lines.push(nextCourt
      ? `⏭ ${s('nextGoTo', { court: nextCourt, at: at || '—' })}`
      : `⏭ ${s('nextYouRest', { at: at || '—' })}`)
  }
  return lines.join('\n')
}

/** The table, short enough to read on a phone between points. */
export function standingsMessage(tour, lang = clubLanguage()) {
  const s = translator(lang)
  const { teams, matches } = night(tour)
  const table = standings(teams, matches)
  if (!table.length) return s('noResults')
  const medal = ['🥇', '🥈', '🥉']
  return [
    `🏆 ${b(s('standings'))} · ${s('boardFormat')} ${levelTight(tour.level) || ''}`.trim(),
    '',
    ...table.map((r, i) => `${medal[i] || `${i + 1}.`} ${r.team} — ${
      s('pointsWonShort', { points: r.points, won: r.won })}`),
  ].join('\n')
}

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
    b(s('helpOnTheNight')),
    `\`!where Mike\` — ${s('helpWhere')}`,
    `\`!round\` — ${s('helpRound')}`,
    `\`!next\` — ${s('helpNext')}`,
    `\`!table\` — ${s('helpTable')}`,
    '',
    `_${s('helpDates', { examples: '`2026-09-05`, `5 Sep`, `sexta 19:00`, `Friday`' })}_`,
  ].join('\n')
}

export const _test = { parseTournament, parseSignup, split }
