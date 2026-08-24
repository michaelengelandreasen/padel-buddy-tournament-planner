import { createServer } from 'node:http'
import {
  addCourt, createTournament, deleteCourt, getClub, getTournament, listCourts,
  listMatches, listSignups, listTournaments, recordScore, replaceMatches, saveClub,
} from './db.js'
import { buildTeams, schedule, standings } from './formats/nonstop.js'
import { handle, signupMessage } from './bot.js'
import { parseWhen, validateWhen } from './dates.js'
import { parseLevel } from './levels.js'
import { transport } from './whatsapp/transport.js'
import * as V from './views.js'

const wa = transport()
const PORT = Number(process.env.PORT || 8080)

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

/** Everything a tournament view needs, derived in one place. */
function view(id) {
  const t = getTournament(id)
  if (!t) return null
  const { teams, waiting } = buildTeams(listSignups(t.id))
  const matches = listMatches(t.id)
  return { t, teams, waiting, matches, table: standings(teams, matches) }
}

const routes = [
  ['GET', /^\/$/, () => ({ html: V.overview({
    club: getClub(), tournaments: listTournaments(), courts: listCourts(), live: wa.live }) })],

  ['GET', /^\/settings$/, () => ({ html: V.settings({ club: getClub(), courts: listCourts() }) })],
  ['POST', /^\/settings$/, async (_m, req) => { saveClub(await body(req)); return { to: '/settings' } }],
  ['POST', /^\/courts$/, async (_m, req) => {
    const f = await body(req)
    if (f.label?.trim()) addCourt(f.label.trim(), listCourts().length)
    return { to: '/settings' }
  }],
  ['POST', /^\/courts\/(\d+)\/delete$/, (m) => { deleteCourt(Number(m[1])); return { to: '/settings' } }],

  ['GET', /^\/tournaments$/, () => ({ html: V.tournamentsPage({ tournaments: listTournaments() }) })],
  ['POST', /^\/tournaments$/, async (_m, req) => {
    const f = await body(req)
    // The form offers only valid choices, so this is not about the browser — it
    // is about anything else that can POST here. On a failure the page comes
    // back with the reason and what was typed, not a redirect that eats both.
    const bad = (error) => ({
      html: V.tournamentsPage({ tournaments: listTournaments(), form: f, error }), code: 400,
    })

    const level = parseLevel(`${f.level_category ?? ''}-${f.level_grade ?? ''}`)
    if (!level.ok) return bad(level.error)

    const when = parseWhen(`${f.play_date ?? ''} ${f.play_time ?? ''}`.trim())
    if (!when.ok) return bad(when.error)
    if (!when.date) return bad('Pick the date the tournament is played.')
    const valid = validateWhen(when)
    if (!valid.ok) return bad(valid.error)

    const num = (v, fallback, min, max) => {
      const n = Number.parseInt(v, 10)
      return Number.isFinite(n) && n >= min && n <= max ? n : fallback
    }
    const t = createTournament({
      level: level.code, play_date: when.date, play_time: when.time,
      courts: num(f.courts, 3, 1, 20),
      duration_min: num(f.duration_min, 90, 10, 600),
      round_min: num(f.round_min, 12, 5, 120),
    })
    return { to: `/t/${t.id}` }
  }],

  ['GET', /^\/t\/(\d+)$/, (m) => {
    const v = view(Number(m[1]))
    if (!v) return { html: V.page('Not found', '<h1>No such tournament</h1>'), code: 404 }
    return { html: V.tournamentPage({ ...v, courts: listCourts(),
      message: signupMessage(v.t) }) }
  }],

  ['GET', /^\/t\/(\d+)\/tv$/, (m) => {
    const v = view(Number(m[1]))
    if (!v) return { html: '<h1>No such tournament</h1>', code: 404 }
    return { html: V.tvPage({ ...v, club: getClub() }) }
  }],

  ['POST', /^\/t\/(\d+)\/schedule$/, (m) => {
    const id = Number(m[1])
    const v = view(id)
    // Courts the club configured, capped by what this tournament booked. A club
    // with six courts running a three-court night should not draw six.
    const courts = listCourts().map((c) => c.label)
    const use = (courts.length ? courts : Array.from({ length: v.t.courts },
      (_, i) => `Court ${i + 1}`)).slice(0, v.t.courts)
    const { matches } = schedule(v.teams, use,
      { durationMin: v.t.duration_min, roundMin: v.t.round_min })
    replaceMatches(id, matches)
    return { to: `/t/${id}` }
  }],

  ['POST', /^\/matches\/(\d+)\/score$/, async (m, req) => {
    const f = await body(req)
    const row = recordScore(Number(m[1]), Number(f.a) || 0, Number(f.b) || 0)
    return { to: `/t/${row.tournament_id}` }
  }],

  ['GET', /^\/whatsapp$/, () => ({ html: V.whatsappPage({ live: wa.live, outbox: wa.outbox() }) })],
  ['POST', /^\/whatsapp\/simulate$/, async (_m, req) => {
    const f = await body(req)
    const reply = handle(f.text, { waId: f.wa_id || '', isHost: true })
    if (reply) await wa.send(reply, { reason: 'reply' })
    return { html: V.whatsappPage({ live: wa.live, outbox: wa.outbox(),
      log: reply ?? '(the bot stayed quiet — not a command it knows)' }) }
  }],

  // ---- REST, for the Android console and any linked-device bridge ----
  ['POST', /^\/api\/whatsapp\/incoming$/, async (_m, req) => {
    const f = await body(req)
    const reply = handle(f.text, { waId: f.from || '', isHost: f.isHost !== false })
    if (reply) await wa.send(reply, { reason: 'reply', to: f.chat || '' })
    return { json: { reply, transport: wa.name, live: wa.live } }
  }],
  ['GET', /^\/api\/club$/, () => ({ json: { club: getClub(), courts: listCourts() } })],
  ['GET', /^\/api\/tournaments$/, () => ({ json: listTournaments() })],
  ['GET', /^\/api\/tournaments\/(\d+)$/, (m) => {
    const v = view(Number(m[1]))
    return v ? { json: { ...v, message: signupMessage(v.t) } } : { json: { error: 'not found' }, code: 404 }
  }],
  ['GET', /^\/api\/outbox$/, () => ({ json: wa.outbox() })],
  ['GET', /^\/healthz$/, () => ({ json: { ok: true, transport: wa.name } })],
]

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  for (const [method, re, fn] of routes) {
    if (req.method !== method) continue
    const m = url.pathname.match(re)
    if (!m) continue
    try {
      const out = await fn(m, req)
      if (out.to) return seeOther(res, out.to)
      if (out.json) return json(res, out.json, out.code || 200)
      return html(res, out.html, out.code || 200)
    } catch (err) {
      console.error(err)
      return html(res, V.page('Error', `<h1>Something broke</h1><pre class="msg">${
        String(err && err.message)}</pre>`), 500)
    }
  }
  html(res, V.page('Not found', '<h1>Not found</h1><p><a href="/">Back to the club</a></p>'), 404)
}).listen(PORT, () => console.log(`padel-tournament-planner on :${PORT} (whatsapp: ${wa.name})`))
