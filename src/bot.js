import {
  addSignup, createTournament, currentTournament,
  getClub, listSignups, removeSignup,
} from './db.js'
import { buildTeams } from './formats/nonstop.js'

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

/** `!tournament non-stop level <MX-4> date <2026-09-05> courts <3> duration 90` */
function parseTournament(rest) {
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
  return {
    format: out.format,
    level: (out.level || '').toUpperCase(),
    play_date: out.date || '',
    courts: Number.parseInt(out.courts || '', 10) || 2,
    duration_min: Number.parseInt(out.duration || '', 10) || 90,
    round_min: Number.parseInt(out.round || '', 10) || 12,
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
export function handle(text, { waId = '', isHost = true } = {}) {
  const parsed = split(text)
  if (!parsed) return null
  const { cmd, rest } = parsed

  if (cmd === 'tournament') {
    if (!isHost) return '🔒 Only the host can open a tournament.'
    const t = createTournament(parseTournament(rest))
    return openedMessage(t)
  }

  if (cmd === 'in') {
    const t = currentTournament()
    if (!t) return '🎾 No tournament is open yet. The host starts one with:\n`!tournament non-stop level MX-4 date Friday courts 3 duration 90`'
    const p = parseSignup(rest)
    if (!p.name) return '🤔 I need a name — try `!in Mike M partner Sofia`.'
    addSignup(t.id, { ...p, wa_id: waId })
    return signupMessage(t)
  }

  if (cmd === 'out') {
    const t = currentTournament()
    if (!t) return null
    const name = parseSignup(rest).name
    if (!name) return '🤔 Who is dropping out? Try `!out Mike`.'
    const gone = removeSignup(t.id, name)
    if (!gone) return `🤷 I don't have ${name} on the list.`
    return signupMessage(t, `👋 ${gone.name} is out.`)
  }

  if (cmd === 'list' || cmd === 'players') {
    const t = currentTournament()
    return t ? signupMessage(t) : '🎾 No tournament is open yet.'
  }

  if (cmd === 'help') return helpMessage()
  return null
}

const b = (s) => `*${s}*`

export function openedMessage(t) {
  const club = getClub()
  const where = club.maps_url ? `\n📍 ${club.address || club.name} — ${club.maps_url}` : ''
  return [
    `🎾 ${b('Non-stop smash')} — ${club.name}`,
    `🏆 Level: ${t.level || 'open'}`,
    `📅 ${t.play_date || 'date TBC'}`,
    `🕒 ${t.duration_min} min · ${t.round_min} min rounds`,
    `🏟️ ${t.courts} court${t.courts === 1 ? '' : 's'}${where}`,
    '',
    `Sign up with ${b('!in')} — name, M/F, and your partner:`,
    '`!in Mike M partner Sofia`',
    `Dropping out? ${b('!out')} and your name.`,
  ].join('\n')
}

/**
 * The sign-up board, re-posted on every change.
 *
 * Pairs first because pairs are what plays; half-teams below with the partner
 * they are waiting on, so the group can see who still needs someone. The count
 * against the courts is the number the host actually cares about.
 */
export function signupMessage(t, prefix = '') {
  const signups = listSignups(t.id)
  const { teams, waiting } = buildTeams(signups)
  const lines = []

  if (prefix) lines.push(prefix, '')
  lines.push(`🎾 ${b(`Non-stop smash — ${t.level || 'open'}`)}`)
  lines.push(`📅 ${t.play_date || 'date TBC'} · 🏟️ ${t.courts} court${t.courts === 1 ? '' : 's'}`)
  lines.push('')

  if (!teams.length && !waiting.length) {
    lines.push('_Nobody signed up yet._', '', 'First in: `!in YourName M partner TheirName`')
    return lines.join('\n')
  }

  if (teams.length) {
    lines.push(b(`✅ Teams (${teams.length})`))
    teams.forEach((team, i) => {
      const marks = team.players.map((p) => genderMark(p.gender)).join('')
      lines.push(`${medal(i)} ${team.name} ${marks}${team.mixed ? ' 🔀' : ''}`)
    })
  }
  if (waiting.length) {
    lines.push('', b(`⏳ Waiting for a partner (${waiting.length})`))
    waiting.forEach((p) => {
      const wants = p.partner ? ` — waiting on ${p.partner}` : ' — no partner named'
      lines.push(`• ${p.name} ${genderMark(p.gender)}${wants}`)
    })
  }

  const need = t.courts * 2
  lines.push('', teams.length >= need
    ? `🔥 ${teams.length} teams — enough for all ${t.courts} courts.`
    : `📣 ${teams.length}/${need} teams for ${t.courts} courts — room for ${need - teams.length} more.`)
  return lines.join('\n')
}

const genderMark = (g) => (g === 'F' ? '🙋‍♀️' : g === 'M' ? '🙋‍♂️' : '🙋')
const medal = (i) => (i === 0 ? '1️⃣' : i === 1 ? '2️⃣' : i === 2 ? '3️⃣' : '▫️')

export function helpMessage() {
  return [
    `🎾 ${b('Padel Tournament Planner')}`,
    '',
    b('Host'),
    '`!tournament non-stop level MX-4 date Friday courts 3 duration 90`',
    '',
    b('Players'),
    '`!in Mike M partner Sofia` — sign up as a pair',
    '`!out Mike` — cancel',
    '`!list` — who is in',
  ].join('\n')
}

export const _test = { parseTournament, parseSignup, split }
