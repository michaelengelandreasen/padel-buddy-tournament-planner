import { createServer } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import {
  addCourt, addSignup, addVenue, clubLanguage, createTournament, deleteCourt, deleteVenue,
  findVenue, getClub, getTournament, listVenues, updateVenue,
  listCourts, listMatches, listSignups, listTournaments, recordScore, rememberTelegramChat,
  renameCourt, replaceMatches, saveClub, setPartner, telegramChat,
} from './db.js'
import { buildTeams, schedule, standings } from './formats/nonstop.js'
import { handle, roundMessage, signupMessage, standingsMessage } from './bot.js'
import { parseWhen, validateWhen } from './dates.js'
import { currentRound, roundComplete, roundsOf } from './rounds.js'
import { parseLevel } from './levels.js'
import { parseBoard } from './import.js'
import { partnersFromSeats } from './pairs.js'
import { LANGUAGES, isLanguage, translator } from './i18n.js'
import { bus, listen } from './messaging/transport.js'
import { normalizeCommand } from './messaging/telegram.js'
import * as V from './views.js'

const groups = bus()
const PORT = Number(process.env.PORT || 8080)

/**
 * One shared login for the whole console, HTTP Basic.
 *
 * The public URL puts a club's sign-up sheet and score entry on the open
 * internet, and the people who need it are a handful of hosts who will get the
 * link from each other. A username and password that travel inside the link
 * (`https://padel:buddy@host/`) is exactly the right amount of door: no
 * accounts, no reset flow, and the browser remembers it. `BASIC_AUTH=user:pass`
 * in the environment; empty disables it. `/healthz` stays open for monitoring.
 */
const AUTH = String(process.env.BASIC_AUTH || '')
const authOk = (req) => {
  if (!AUTH) return true
  const h = String(req.headers.authorization || '')
  if (!h.startsWith('Basic ')) return false
  const given = Buffer.from(h.slice(6).trim(), 'base64')
  const want = Buffer.from(AUTH)
  // Compare in constant time, on equal-length buffers, so neither the length
  // nor the position of the first wrong byte leaks through the clock.
  return given.length === want.length && timingSafeEqual(given, want)
}
const OPEN_PATHS = new Set(['/healthz'])

/**
 * Post to every group the club runs, without making the caller wait.
 *
 * A host tapping "save score" on the side of a court should get their page back
 * immediately; whether Telegram acknowledged in 40ms or 900ms is not their
 * problem. Failures are logged by the bus itself and shown in the outbox.
 */
const post = (text, meta) => { groups.send(text, meta).catch((err) => console.error(err)) }

const html = (res, body, code = 200) => {
  res.writeHead(code, { 'content-type': 'text/html; charset=utf-8' }); res.end(body)
}
const json = (res, data, code = 200) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data, null, 2))
}
const seeOther = (res, to) => { res.writeHead(303, { location: to }); res.end() }

async function body(req) {
  const chunks = []
  for await (const c of req) chunks.push(c)
  const raw = Buffer.concat(chunks).toString('utf8')
  if ((req.headers['content-type'] || '').includes('application/json')) {
    try { return JSON.parse(raw || '{}') } catch { return {} }
  }
  return Object.fromEntries(new URLSearchParams(raw))
}

/**
 * Everything a tournament view needs, derived in one place.
 *
 * The tournament is called `tournament`, not `t`: `t` is the translator every
 * view also takes, and one object carrying both under the same name renders a
 * page full of `undefined`.
 */
function view(id) {
  const tournament = getTournament(id)
  if (!tournament) return null
  const { teams, waiting } = buildTeams(listSignups(tournament.id))
  const matches = listMatches(tournament.id)
  return { tournament, teams, waiting, matches, table: standings(teams, matches) }
}

const routes = [
  ['GET', /^\/$/, (_m, _r, t) => ({ html: V.overview({
    club: getClub(), tournaments: listTournaments(), courts: listCourts(),
    live: groups.live, t }) })],

  ['GET', /^\/settings$/, (_m, _r, t) =>
    ({ html: V.settings({ club: getClub(), courts: listCourts(), venues: listVenues(), t }) })],
  ['POST', /^\/venues$/, async (_m, req) => { addVenue(await body(req)); return { to: '/settings#venues' } }],
  ['POST', /^\/venues\/(\d+)$/, async (m, req) => { updateVenue(Number(m[1]), await body(req)); return { to: '/settings#venues' } }],
  ['POST', /^\/venues\/(\d+)\/delete$/, (m) => { deleteVenue(Number(m[1])); return { to: '/settings#venues' } }],
  // Every settings form says which tab it lives on, so a save lands back there.
  ['POST', /^\/settings$/, async (_m, req) => {
    const f = await body(req)
    saveClub(f)
    return { to: `/settings#${/^[a-z]+$/.test(f.tab || '') ? f.tab : 'club'}` }
  }],

  // The header toggle. Same handler as the settings form, so there is one place
  // the language is written and one place it is validated.
  ['POST', /^\/language$/, async (_m, req) => {
    const f = await body(req)
    if (isLanguage(f.language)) saveClub({ language: f.language })
    // Back to the page the toggle was pressed on — but only ever to a path on
    // this site, never to whatever a form field happens to say.
    const back = /^\/(?!\/)[\w/-]*$/.test(f.back || '') ? f.back : '/'
    return { to: back }
  }],
  ['POST', /^\/courts$/, async (_m, req) => {
    const f = await body(req)
    if (f.label?.trim()) addCourt(f.label.trim(), listCourts().length)
    return { to: '/settings#courts' }
  }],
  ['POST', /^\/courts\/(\d+)$/, async (m, req) => {
    const f = await body(req)
    renameCourt(Number(m[1]), f.label)
    return { to: '/settings#courts' }
  }],
  ['POST', /^\/courts\/(\d+)\/delete$/, (m) => { deleteCourt(Number(m[1])); return { to: '/settings#courts' } }],

  ['GET', /^\/tournaments$/, (_m, _r, t) =>
    ({ html: V.tournamentsPage({ tournaments: listTournaments(), venues: listVenues(), t }) })],
  // Paste the club's own message; the form fills itself in for the host to check.
  ['POST', /^\/tournaments\/import$/, async (_m, req, t) => {
    const f = await body(req)
    const read = parseBoard(f.text, { lang: t.lang })
    // "M9 - MAIA" in the message is the saved venue "M9", if there is one.
    const known = read.location ? findVenue(read.location) : null
    if (known) { read.matchedVenue = known; read.location = known.name }
    const level = parseLevel(read.level, { lang: t.lang })
    const form = {
      level_category: level.ok ? level.category : 'MX',
      level_grade: level.ok ? String(level.grade) : '',
      play_date: read.date, play_time: read.time, venue: read.location,
      courts: read.courts, duration_min: read.duration_min, round_min: 12,
      roster: JSON.stringify(read.players.map(({ name, partner }) => ({ name, partner }))),
    }
    return { html: V.tournamentsPage({ tournaments: listTournaments(), venues: listVenues(), form,
      imported: read, pasted: f.text, t }) }
  }],

  ['POST', /^\/tournaments$/, async (_m, req, t) => {
    const f = await body(req)
    // The form offers only valid choices, so this is not about the browser — it
    // is about anything else that can POST here. On a failure the page comes
    // back with the reason and what was typed, not a redirect that eats both.
    const bad = (error) => ({
      html: V.tournamentsPage({ tournaments: listTournaments(), venues: listVenues(), form: f, error, t }),
      code: 400,
    })
    const lang = t.lang

    const level = parseLevel(`${f.level_category ?? ''}-${f.level_grade ?? ''}`, { lang })
    if (!level.ok) return bad(level.error)

    const when = parseWhen(`${f.play_date ?? ''} ${f.play_time ?? ''}`.trim(), { lang })
    if (!when.ok) return bad(when.error)
    if (!when.date) return bad(t('datePick'))
    const valid = validateWhen(when, { lang })
    if (!valid.ok) return bad(valid.error)

    const num = (v, fallback, min, max) => {
      const n = Number.parseInt(v, 10)
      return Number.isFinite(n) && n >= min && n <= max ? n : fallback
    }
    const created = createTournament({
      level: level.code, play_date: when.date, play_time: when.time, venue: f.venue,
      courts: num(f.courts, 3, 1, 20),
      duration_min: num(f.duration_min, 90, 10, 600),
      round_min: num(f.round_min, 12, 5, 120),
    })
    // A roster that came with an imported message signs everyone up at once.
    // Names are re-checked here — the field is a hidden input, and hidden
    // inputs are whatever the browser was told to send.
    let signed = 0
    try {
      const roster = JSON.parse(f.roster || '[]')
      if (Array.isArray(roster)) {
        for (const p of roster.slice(0, 64)) {
          const name = String(p?.name || '').replace(/\s+/g, ' ').trim().slice(0, 80)
          if (!name) continue
          addSignup(created.id, { name, gender: '', partner: String(p?.partner || '').slice(0, 80), wa_id: '' })
          signed++
        }
      }
    } catch { /* not JSON: nothing to sign up */ }
    return { to: `/t/${created.id}${signed ? `?signed=${signed}` : ''}#board` }
  }],

  ['GET', /^\/t\/(\d+)$/, (m, req, t) => {
    const v = view(Number(m[1]))
    if (!v) return { html: V.page('404', '<h1>404</h1>', { t }), code: 404 }
    // What the last manual post did, carried in the redirect so a refresh
    // doesn't re-post and the message survives exactly one page load.
    const q = new URL(req.url, 'http://x').searchParams
    const flash = q.get('posted') ? {
      what: q.get('posted'), tg: q.get('tg') || '', err: (q.get('err') || '').slice(0, 120),
      n: q.get('n') || '',
    } : q.get('signed') ? { what: 'board', signed: q.get('signed') } : null
    return { html: V.tournamentPage({ ...v, courts: listCourts(), flash,
      message: signupMessage(v.tournament, '', t.lang),
      // What the group would see right now, so a host can read it before
      // deciding to send it.
      roundText: v.matches.length
        ? roundMessage(v.tournament, currentRound(v.matches), t.lang) : '',
      tableText: v.table.length ? standingsMessage(v.tournament, t.lang) : '',
      t }) }
  }],

  ['GET', /^\/t\/(\d+)\/tv$/, (m, _r, t) => {
    const v = view(Number(m[1]))
    if (!v) return { html: '<h1>404</h1>', code: 404 }
    return { html: V.tvPage({ ...v, club: getClub(), t }) }
  }],

  ['POST', /^\/t\/(\d+)\/schedule$/, (m, _r, t) => {
    const id = Number(m[1])
    const v = view(id)
    // Courts the club configured, capped by what this tournament booked. A club
    // with six courts running a three-court night should not draw six.
    const courts = listCourts().map((c) => c.label)
    const use = (courts.length ? courts : Array.from({ length: v.tournament.courts },
      (_, i) => `Court ${i + 1}`)).slice(0, v.tournament.courts)
    const { matches } = schedule(v.teams, use,
      { durationMin: v.tournament.duration_min, roundMin: v.tournament.round_min })
    replaceMatches(id, matches)
    // The draw is the moment the night starts existing for the players, so the
    // first round goes to the groups without anyone having to remember to send it.
    if (matches.length) post(roundMessage(getTournament(id), 1, t.lang), { reason: 'round 1' })
    return { to: `/t/${id}#rounds` }
  }],

  /**
   * Save scores — every box on the page at once, or one match when the host
   * pressed that match's own Save (`only`).
   *
   * An empty pair of boxes means "no result yet", never 0–0: it used to be
   * coerced to zero, which marked a match as played and could complete a round
   * that nobody had finished. Half a score (one box filled) is left alone.
   */
  ['POST', /^\/t\/(\d+)\/scores$/, async (m, req, t) => {
    const id = Number(m[1])
    const tour = getTournament(id)
    if (!tour) return { html: V.page('404', '<h1>404</h1>', { t }), code: 404 }
    const f = await body(req)
    const before = listMatches(id)
    const only = f.only ? Number(f.only) : null
    const num = (v) => {
      if (v == null || String(v).trim() === '') return null
      const n = Number.parseInt(v, 10)
      return Number.isFinite(n) && n >= 0 && n <= 99 ? n : null
    }
    let changed = 0
    for (const mt of before) {
      if (only && mt.id !== only) continue
      if (!(`a${mt.id}` in f)) continue
      const a = num(f[`a${mt.id}`]), b = num(f[`b${mt.id}`])
      if (a == null && b == null) {
        if (mt.score_a != null || mt.score_b != null) { recordScore(mt.id, null, null); changed++ }
        continue
      }
      if (a == null || b == null) continue
      if (a !== mt.score_a || b !== mt.score_b) { recordScore(mt.id, a, b); changed++ }
    }

    // A round that became complete in this save is the only reliable "time has
    // passed" signal this system gets — nobody presses a button while holding a
    // racket. It sends twenty people to their next court. When several rounds
    // complete at once (scores typed in after the fact) only the last one is
    // announced; re-posting a round everyone has left is noise.
    const after = listMatches(id)
    const newlyDone = roundsOf(after).filter((r) => !roundComplete(before, r) && roundComplete(after, r))
    if (newlyDone.length) {
      const next = Math.max(...newlyDone) + 1
      const hasNext = roundsOf(after).includes(next)
      post(hasNext ? roundMessage(tour, next, t.lang) : standingsMessage(tour, t.lang),
        { reason: hasNext ? `round ${next}` : 'final' })
    }
    return { to: `/t/${id}?posted=scores&n=${changed}#rounds` }
  }],

  // The pairs board: seats → partners, written both ways. Only while the night
  // is still open — once the schedule is drawn, the pairs are the schedule.
  ['POST', /^\/t\/(\d+)\/pairs$/, async (m, req, t) => {
    const id = Number(m[1])
    const tour = getTournament(id)
    if (!tour) return { html: V.page('404', '<h1>404</h1>', { t }), code: 404 }
    if (listMatches(id).length) return { to: `/t/${id}#teams` }
    const f = await body(req)
    let seats = []
    try { seats = JSON.parse(f.seats || '[]') } catch { seats = [] }
    if (!Array.isArray(seats)) seats = []
    const signups = listSignups(id)
    const partner = partnersFromSeats(seats, signups.map((x) => x.name))
    let pairs = 0
    for (const x of signups) {
      const want = partner.get(x.name) || ''
      if (want !== x.partner) setPartner(id, x.name, want)
      if (want) pairs++
    }
    return { to: `/t/${id}?posted=pairs&n=${pairs / 2}#teams` }
  }],

  // Post on demand, for a host who wants the board or a round in the group now.
  ['POST', /^\/t\/(\d+)\/post$/, async (m, req, t) => {
    const id = Number(m[1])
    const tour = getTournament(id)
    if (!tour) return { html: V.page('404', '<h1>404</h1>', { t }), code: 404 }
    const f = await body(req)
    const round = Number.parseInt(f.round, 10)
    const isRound = Number.isFinite(round)
    const isTable = f.what === 'table'
    // A deliberate press waits for the answer — a second of latency is worth
    // being told whether Telegram actually took it. Automatic posts don't wait.
    const results = await groups.send(
      isTable ? standingsMessage(tour, t.lang)
        : isRound ? roundMessage(tour, round, t.lang) : signupMessage(tour, '', t.lang),
      isTable ? { reason: 'standings' }
        : isRound ? { reason: `round ${round}` } : { key: `board:${id}`, pin: true, reason: 'board' })
    const tg = results.find((r) => r.channel === 'telegram')
    const code = !tg ? '' : tg.error ? 'err' : tg.edited ? 'edit' : tg.delivered ? 'ok' : 'wait'
    const q = new URLSearchParams({ posted: isTable ? 'table' : isRound ? `round-${round}` : 'board' })
    if (code) q.set('tg', code)
    if (tg?.error) q.set('err', String(tg.error).slice(0, 120))
    return { to: `/t/${id}?${q}#${isTable ? 'table' : isRound ? 'rounds' : 'board'}` }
  }],

  ['GET', /^\/groups$/, (_m, _r, t) => ({ html: V.groupsPage({ groups, chat: telegramChat(), t }) })],
  // The old name, from when WhatsApp was the only channel. Kept as a redirect
  // because it is written on a phone home screen somewhere.
  ['GET', /^\/whatsapp$/, () => ({ to: '/groups' })],
  ['POST', /^\/groups\/simulate$/, async (_m, req, t) => {
    const f = await body(req)
    const reply = handle(f.text, { waId: f.wa_id || '', isHost: true, lang: t.lang })
    if (reply) await groups.send(reply.text, reply.meta)
    return { html: V.groupsPage({ groups, chat: telegramChat(), t,
      log: reply?.text ?? t('botStayedQuiet') }) }
  }],

  // ---- REST, for the Android console and any linked-device bridge ----
  ['POST', /^\/api\/(?:whatsapp|messages)\/incoming$/, async (_m, req) => {
    const f = await body(req)
    const reply = handle(f.text, { waId: f.from || '', isHost: f.isHost !== false })
    if (reply) await groups.send(reply.text, { ...reply.meta, to: f.chat || '' })
    // `reply` stays a string: the Android console reads it straight into a
    // text view, and it has no use for how the message wanted to be posted.
    return { json: { reply: reply?.text ?? null, transport: groups.name, live: groups.live } }
  }],
  ['GET', /^\/api\/club$/, () => ({ json: { club: getClub(), courts: listCourts() } })],
  ['GET', /^\/api\/languages$/, () => ({ json: { current: clubLanguage(), available: LANGUAGES } })],
  ['GET', /^\/api\/tournaments$/, () => ({ json: listTournaments() })],
  ['GET', /^\/api\/tournaments\/(\d+)$/, (m) => {
    const v = view(Number(m[1]))
    if (!v) return { json: { error: 'not found' }, code: 404 }
    // The payload keeps its `t` key: the Android client reads it, and renaming
    // a field to match an internal rename is a breaking change for no gain.
    const { tournament, ...rest } = v
    return { json: { t: tournament, ...rest, message: signupMessage(tournament) } }
  }],
  ['GET', /^\/api\/outbox$/, () => ({ json: groups.outbox() })],
  // What a player's phone would ask: where do I go, without a group chat at all.
  ['GET', /^\/api\/tournaments\/(\d+)\/round$/, (m, req) => {
    const v = view(Number(m[1]))
    if (!v) return { json: { error: 'not found' }, code: 404 }
    const url = new URL(req.url, 'http://x')
    const asked = Number.parseInt(url.searchParams.get('n') ?? '', 10)
    const round = Number.isFinite(asked) ? asked : currentRound(v.matches)
    return { json: { round, rounds: roundsOf(v.matches),
      message: roundMessage(v.tournament, round) } }
  }],
  ['GET', /^\/healthz$/, () => ({ json: {
    ok: true, channels: groups.channels.map((c) => c.name), live: groups.live } })],
]

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  if (!OPEN_PATHS.has(url.pathname) && !authOk(req)) {
    res.writeHead(401, {
      'www-authenticate': 'Basic realm="Padel Buddy", charset="UTF-8"',
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    })
    return res.end('Padel Buddy — sign in.')
  }
  // One language per request, read once: every view and every parser gets the
  // same `t`, so a page can never render half in one language and half in another.
  const t = translator(clubLanguage())
  for (const [method, re, fn] of routes) {
    if (req.method !== method) continue
    const m = url.pathname.match(re)
    if (!m) continue
    try {
      const out = await fn(m, req, t)
      if (out.to) return seeOther(res, out.to)
      if (out.json) return json(res, out.json, out.code || 200)
      return html(res, out.html, out.code || 200)
    } catch (err) {
      console.error(err)
      return html(res, V.page('Error', `<h1>⚠️</h1><pre class="msg">${
        String(err && err.message)}</pre>`, { t }), 500)
    }
  }
  html(res, V.page('404', `<h1>404</h1><p><a href="/">${t('appName')}</a></p>`, { t }), 404)
}).listen(PORT, () => {
  console.log(`padel-tournament-planner on :${PORT} (groups: ${groups.name})`)
  startTelegram()
})

/**
 * Let the club talk to the bot from its Telegram group.
 *
 * The group is learned, not configured: the first command the bot sees tells it
 * which chat it lives in, and that is remembered. Opening a tournament stays a
 * host's job, and in a group Telegram can actually answer who that is — so the
 * check is the group's own admin list rather than a trusting default.
 */
async function startTelegram() {
  const tg = groups.telegram
  if (!tg) return
  let me
  try {
    me = await tg.whoami()
    console.log(`telegram: @${me.username} listening`)
  } catch (err) {
    console.error(`telegram: ${err.message}`)
    return
  }
  listen(tg, async (u) => {
    const msg = u.message
    if (!msg?.text) return
    rememberTelegramChat(msg.chat.id)
    const text = normalizeCommand(msg.text, me.username)
    if (!text) return
    const isHost = msg.chat.type === 'private' || await tg.isAdmin(msg.chat.id, msg.from?.id)
    const reply = handle(text, { waId: String(msg.from?.id || ''), isHost, lang: clubLanguage() })
    if (reply) await tg.send(reply.text, { ...reply.meta, chat: msg.chat.id })
  })
}
