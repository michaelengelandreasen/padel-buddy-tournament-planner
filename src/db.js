import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { parseWhen, toDate, todayISO } from './dates.js'
import { parseLevel } from './levels.js'
import { DEFAULT_LANGUAGE, isLanguage, translator } from './i18n.js'

const path = process.env.DB_PATH || './data/planner.db'
mkdirSync(dirname(path), { recursive: true })

export const db = new DatabaseSync(path)

/**
 * One club, many tournaments, and everything a tournament needs to run.
 *
 * The club row is a singleton (id = 1): a club configures its name, where it is
 * and which courts it has once, and every tournament inherits that. Courts are
 * their own table rather than a number, because "how many courts" and "what are
 * they called" are different questions — the WhatsApp message and the TV view
 * both name them, and "Court 3" and "Center" want to be equally sayable.
 */
db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS club (
    id        INTEGER PRIMARY KEY CHECK (id = 1),
    name      TEXT NOT NULL DEFAULT '',
    address   TEXT NOT NULL DEFAULT '',
    maps_url  TEXT NOT NULL DEFAULT '',
    -- One club, one language: it drives this console and the messages the same
    -- button posts to the group, which must never disagree with each other.
    language  TEXT NOT NULL DEFAULT 'en',
    -- The drop-out policy printed under every board, kept in both languages so
    -- switching the club over doesn't silently drop the club's own wording.
    rules_en  TEXT NOT NULL DEFAULT '',
    rules_pt  TEXT NOT NULL DEFAULT '',
    -- Which Telegram group the bot lives in. Learned from the first command it
    -- sees there rather than configured, because no club captain should have to
    -- find out what a numeric chat id is.
    telegram_chat_id TEXT NOT NULL DEFAULT ''
  );
  INSERT OR IGNORE INTO club (id, name) VALUES (1, 'Padel Club');

  CREATE TABLE IF NOT EXISTS courts (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    label  TEXT NOT NULL,
    sort   INTEGER NOT NULL DEFAULT 0
  );

  -- Other places the club plays. A night away is announced with that venue's
  -- name and map link instead of the club's; tournaments name the venue as
  -- text, so an old row keeps saying where it was even if the venue goes.
  CREATE TABLE IF NOT EXISTS venues (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT NOT NULL,
    address   TEXT NOT NULL DEFAULT '',
    maps_url  TEXT NOT NULL DEFAULT '',
    sort      INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS tournaments (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    format       TEXT NOT NULL DEFAULT 'non-stop',
    level        TEXT NOT NULL DEFAULT '',      -- a code from src/levels.js, e.g. MX-4
    play_date    TEXT NOT NULL DEFAULT '',      -- ISO YYYY-MM-DD, so a picker can open on it
    play_time    TEXT NOT NULL DEFAULT '',      -- HH:MM, 24h
    courts       INTEGER NOT NULL DEFAULT 2,
    duration_min INTEGER NOT NULL DEFAULT 90,
    round_min    INTEGER NOT NULL DEFAULT 12,
    venue        TEXT NOT NULL DEFAULT '',      -- where this night is, if not the club itself
    status       TEXT NOT NULL DEFAULT 'open',   -- open | scheduled | done
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- A signup is one player. Pairs are formed by two players naming each other
  -- (or one naming the other), which is why partner lives here rather than in a
  -- teams table the bot would have to guess at.
  CREATE TABLE IF NOT EXISTS signups (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,
    name          TEXT NOT NULL,
    gender        TEXT NOT NULL DEFAULT '',      -- M | F | ''
    partner       TEXT NOT NULL DEFAULT '',
    wa_id         TEXT NOT NULL DEFAULT '',      -- who sent !in, so !out can find them
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (tournament_id, name)
  );

  -- Messages this bot has already posted, so it can edit them instead of
  -- posting again. The sign-up board is one pinned message that keeps changing;
  -- without this it would be twenty near-identical messages in a row.
  CREATE TABLE IF NOT EXISTS posts (
    key        TEXT PRIMARY KEY,
    chat_id    TEXT NOT NULL,
    message_id INTEGER NOT NULL,
    at         TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- A night's own courts. Which courts a club has booked, and what they are
  -- called that evening, changes from night to night — so each tournament
  -- carries its list, seeded from the club's defaults when it is created.
  CREATE TABLE IF NOT EXISTS tournament_courts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,
    label         TEXT NOT NULL,
    sort          INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS matches (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,
    round         INTEGER NOT NULL,
    court         TEXT NOT NULL,
    team_a        TEXT NOT NULL,
    team_b        TEXT NOT NULL,
    score_a       INTEGER,
    score_b       INTEGER,
    UNIQUE (tournament_id, round, court)
  );
`)

/**
 * A tournament's courts, to start with: the club's defaults in order, padded
 * with "Court k" when the night booked more than the club has named.
 */
function seedTournamentCourts(tid, count) {
  const defaults = db.prepare('SELECT label FROM courts ORDER BY sort, id').all().map((c) => c.label)
  const n = Math.max(1, Number(count) || defaults.length || 1)
  const ins = db.prepare('INSERT INTO tournament_courts (tournament_id, label, sort) VALUES (?, ?, ?)')
  for (let i = 0; i < n; i++) ins.run(tid, defaults[i] || String(i + 1), i)
}

/**
 * Migrations, run on every boot and safe to run twice.
 *
 * The date used to be prose ("Friday 5 Sep, 19:00") and the level used to be
 * whatever was typed. Both are now parsed shapes, so old rows are dragged
 * through the same parsers the live code uses rather than being left as values
 * the date picker and the level picker cannot open on. A row that refuses to
 * parse is blanked, not guessed at — "date TBC" is honest, a made-up Friday is not.
 */
function migrate() {
  const clubCols = db.prepare('PRAGMA table_info(club)').all().map((c) => c.name)
  for (const [col, def] of [['language', "'en'"], ['rules_en', "''"], ['rules_pt', "''"],
    ['telegram_chat_id', "''"]]) {
    if (!clubCols.includes(col)) {
      db.exec(`ALTER TABLE club ADD COLUMN ${col} TEXT NOT NULL DEFAULT ${def}`)
    }
  }
  // A club that never wrote its own policy gets the standard one, in both
  // languages, rather than an empty block under every board.
  for (const [col, lang] of [['rules_en', 'en'], ['rules_pt', 'pt']]) {
    db.exec(`UPDATE club SET ${col} = '${
      translator(lang)('dropoutDefault').replace(/'/g, "''")}' WHERE ${col} = ''`)
  }

  const cols = db.prepare('PRAGMA table_info(tournaments)').all().map((c) => c.name)
  if (!cols.includes('play_time')) {
    db.exec("ALTER TABLE tournaments ADD COLUMN play_time TEXT NOT NULL DEFAULT ''")
  }
  if (!cols.includes('venue')) {
    db.exec("ALTER TABLE tournaments ADD COLUMN venue TEXT NOT NULL DEFAULT ''")
  }
  // Courts used to be stored as "Court 3"; the word is put back on display, so
  // a stored label is just the number (or the name). Strip it wherever a label
  // is written, but only when what is left is a number — "Court Center" stays.
  for (const [table, col] of [['courts', 'label'], ['tournament_courts', 'label'], ['matches', 'court']]) {
    for (const word of ['Court ', 'Campo ']) {
      db.exec(`UPDATE ${table} SET ${col} = trim(substr(${col}, ${word.length + 1}))
        WHERE ${col} LIKE '${word}%' AND trim(substr(${col}, ${word.length + 1})) GLOB '[0-9]*'
        AND trim(substr(${col}, ${word.length + 1})) NOT GLOB '*[^0-9]*'`)
    }
  }

  // Tournaments from before courts were per night get theirs from the club's
  // list, the way a new one would.
  for (const t of db.prepare('SELECT id, courts FROM tournaments').all()) {
    const n = db.prepare('SELECT COUNT(*) AS n FROM tournament_courts WHERE tournament_id = ?').get(t.id).n
    if (!n) seedTournamentCourts(t.id, t.courts)
  }

  const rows = db.prepare('SELECT id, level, play_date, play_time FROM tournaments').all()
  const fix = db.prepare('UPDATE tournaments SET level = ?, play_date = ?, play_time = ? WHERE id = ?')
  for (const r of rows) {
    const lv = parseLevel(r.level)
    const level = lv.ok ? lv.code : ''
    const when = /^\d{4}-\d{2}-\d{2}$/.test(r.play_date)
      ? { ok: true, date: r.play_date, time: r.play_time || '' }
      : parseWhen(r.play_date)
    const date = when.ok ? when.date : ''
    const time = (when.ok && when.time) || r.play_time || ''
    if (level !== r.level || date !== r.play_date || time !== r.play_time) {
      fix.run(level, date, time, r.id)
    }
  }
}
migrate()

const one = (sql, ...args) => db.prepare(sql).get(...args)
const all = (sql, ...args) => db.prepare(sql).all(...args)
const run = (sql, ...args) => db.prepare(sql).run(...args)

export const getClub = () => one('SELECT * FROM club WHERE id = 1')

/** The club's language, guaranteed to be one this app actually has strings for. */
export function clubLanguage() {
  const l = getClub()?.language
  return isLanguage(l) ? l : DEFAULT_LANGUAGE
}

/** Only the keys given are written, so the language form can't blank the address. */
export function saveClub(patch) {
  const allowed = ['name', 'address', 'maps_url', 'language', 'rules_en', 'rules_pt',
    'telegram_chat_id']
  const keys = allowed.filter((k) => patch[k] !== undefined)
  if (!keys.length) return getClub()
  const clean = (k) => (k === 'language' && !isLanguage(patch[k])
    ? DEFAULT_LANGUAGE : String(patch[k] ?? ''))
  run(`UPDATE club SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = 1`,
    ...keys.map(clean))
  return getClub()
}

/** The drop-out policy in the club's current language, blank if it cleared it. */
export function clubRules(lang = clubLanguage()) {
  const club = getClub()
  return (lang === 'pt' ? club.rules_pt : club.rules_en).trim()
}

/**
 * The Telegram group the bot posts into, or '' before it has ever been spoken to.
 *
 * `TELEGRAM_CHAT_ID` overrides it, for a club that wants the group pinned down
 * in configuration rather than learned — but the learned value is the normal
 * path, and it is what makes adding the bot to a group the whole setup.
 */
export const telegramChat = () =>
  process.env.TELEGRAM_CHAT_ID || getClub()?.telegram_chat_id || ''

/** Remember the group a command came from, the first time one arrives from it. */
export function rememberTelegramChat(chatId) {
  const id = String(chatId || '')
  if (!id || id === getClub()?.telegram_chat_id) return
  run('UPDATE club SET telegram_chat_id = ? WHERE id = 1', id)
}

/** A message the bot posted and may want to edit: the pinned board, mostly. */
export const getPost = (key) => one('SELECT * FROM posts WHERE key = ?', key) || null
export const savePost = (key, chatId, messageId) =>
  run(`INSERT INTO posts (key, chat_id, message_id) VALUES (?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET
         chat_id = excluded.chat_id, message_id = excluded.message_id, at = datetime('now')`,
    key, String(chatId), Number(messageId))
export const forgetPost = (key) => run('DELETE FROM posts WHERE key = ?', key)

export const listVenues = () => all('SELECT * FROM venues ORDER BY sort, id')
const cleanVenue = (v) => ({
  name: String(v.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
  address: String(v.address ?? '').trim().slice(0, 160),
  maps_url: /^https?:\/\//.test(String(v.maps_url ?? '').trim()) ? String(v.maps_url).trim().slice(0, 300) : '',
})
export function addVenue(v) {
  const c = cleanVenue(v)
  if (!c.name) return null
  run('INSERT INTO venues (name, address, maps_url, sort) VALUES (?, ?, ?, ?)',
    c.name, c.address, c.maps_url, listVenues().length)
  return listVenues().at(-1)
}
export function updateVenue(id, v) {
  const c = cleanVenue(v)
  if (!c.name) return null
  run('UPDATE venues SET name = ?, address = ?, maps_url = ? WHERE id = ?', c.name, c.address, c.maps_url, id)
  return one('SELECT * FROM venues WHERE id = ?', id)
}
export const deleteVenue = (id) => run('DELETE FROM venues WHERE id = ?', id)

/** Accents and case aside — "m9 - maia" finds "M9 Maia". */
const fold = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * The saved venue a free-text name refers to, or null. Exact first; then a
 * saved name contained in the text or the text in it, longest name wins — so
 * "M9 - Maia" matches a venue called "M9" and not one called "Maia Padel" by
 * accident of both containing "maia".
 */
export function findVenue(text) {
  const q = fold(text)
  if (!q) return null
  const venues = listVenues()
  const exact = venues.find((v) => fold(v.name) === q)
  if (exact) return exact
  const hits = venues.filter((v) => {
    const n = fold(v.name)
    return n && (` ${q} `.includes(` ${n} `) || ` ${n} `.includes(` ${q} `))
  })
  return hits.sort((a, b) => fold(b.name).length - fold(a.name).length)[0] || null
}

export const listCourts = () => all('SELECT * FROM courts ORDER BY sort, id')
export const addCourt = (label, sort = 0) =>
  run('INSERT INTO courts (label, sort) VALUES (?, ?)', label, sort)
export const deleteCourt = (id) => run('DELETE FROM courts WHERE id = ?', id)

/** Rename one of the club's default courts. Nights already created keep their own. */
export function renameCourt(id, label) {
  const next = String(label ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)
  if (next) run('UPDATE courts SET label = ? WHERE id = ?', next, id)
  return one('SELECT * FROM courts WHERE id = ?', id)
}

// ---- a night's own courts ----
export const listTournamentCourts = (tid) =>
  all('SELECT * FROM tournament_courts WHERE tournament_id = ? ORDER BY sort, id', tid)

/** Keep the tournament's court count — what the board draws slots from — equal to its list. */
const syncCourtCount = (tid) => run('UPDATE tournaments SET courts = ? WHERE id = ?',
  Math.max(1, listTournamentCourts(tid).length), tid)

export function addTournamentCourt(tid, label) {
  const next = String(label ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)
  if (!next) return null
  run('INSERT INTO tournament_courts (tournament_id, label, sort) VALUES (?, ?, ?)',
    tid, next, listTournamentCourts(tid).length)
  syncCourtCount(tid)
  return listTournamentCourts(tid)
}

/**
 * Rename a court for this night only. Its matches store the label as text —
 * the schedule is a printed thing, not a join — so they are renamed with it;
 * other nights that happen to use the same name are not touched.
 */
export function renameTournamentCourt(tid, id, label) {
  const court = one('SELECT * FROM tournament_courts WHERE id = ? AND tournament_id = ?', id, tid)
  const next = String(label ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)
  if (!court || !next || next === court.label) return court
  run('UPDATE tournament_courts SET label = ? WHERE id = ?', next, id)
  run('UPDATE matches SET court = ? WHERE tournament_id = ? AND court = ?', next, tid, court.label)
  return one('SELECT * FROM tournament_courts WHERE id = ?', id)
}

/** Rename several of this night's courts at once: `{id: label}`. Returns how many changed. */
export function renameTournamentCourts(tid, labels) {
  let n = 0
  for (const c of listTournamentCourts(tid)) {
    if (!(c.id in labels)) continue
    const next = String(labels[c.id] ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)
    if (next && next !== c.label) { renameTournamentCourt(tid, c.id, next); n++ }
  }
  return n
}

/** Rename several of the club's default courts at once. */
export function renameCourts(labels) {
  let n = 0
  for (const c of listCourts()) {
    if (!(c.id in labels)) continue
    const next = String(labels[c.id] ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)
    if (next && next !== c.label) { renameCourt(c.id, next); n++ }
  }
  return n
}

/** Remove a court from this night. Refused once a schedule names it. */
export function deleteTournamentCourt(tid, id) {
  const court = one('SELECT * FROM tournament_courts WHERE id = ? AND tournament_id = ?', id, tid)
  if (!court) return false
  const used = one('SELECT COUNT(*) AS n FROM matches WHERE tournament_id = ? AND court = ?', tid, court.label).n
  if (used) return false
  run('DELETE FROM tournament_courts WHERE id = ?', id)
  syncCourtCount(tid)
  return true
}

/** Soonest first, with undated ones last — a club reads its list as a calendar. */
export const listTournaments = () =>
  all(`SELECT * FROM tournaments
       ORDER BY CASE WHEN play_date = '' THEN 1 ELSE 0 END, play_date, play_time, id DESC`)
export const getTournament = (id) =>
  one('SELECT * FROM tournaments WHERE id = ?', id)

/** The tournament the bot is talking about: the newest one still open. */
export const currentTournament = () =>
  one("SELECT * FROM tournaments WHERE status != 'done' ORDER BY id DESC LIMIT 1")

/**
 * The tournament being *played*, which is not the same question as the newest
 * one open.
 *
 * A club opens next Friday's night while Saturday morning's is still on court,
 * so `currentTournament` — newest not yet done — is the right answer for `!in`
 * and the wrong one for "where do I go next". This picks the night with a draw
 * whose date is nearest to now: during a tournament that is today's, and between
 * tournaments it is the one just played, which is what `!table` should show.
 */
export function playingTournament(today = todayISO()) {
  const drawn = all(`SELECT * FROM tournaments t
    WHERE EXISTS (SELECT 1 FROM matches m WHERE m.tournament_id = t.id)`)
  if (!drawn.length) return null
  const here = toDate(today)
  const away = (t) => {
    const d = toDate(t.play_date)
    return d && here ? Math.abs(d - here) : Number.POSITIVE_INFINITY
  }
  return drawn.sort((a, b) => away(a) - away(b) || b.id - a.id)[0]
}

/** Wipe a tournament and everything hanging off it — used by the seed script. */
export function deleteTournament(id) {
  forgetPost(`board:${id}`)
  run('DELETE FROM tournament_courts WHERE tournament_id = ?', id)
  run('DELETE FROM matches WHERE tournament_id = ?', id)
  run('DELETE FROM signups WHERE tournament_id = ?', id)
  run('DELETE FROM tournaments WHERE id = ?', id)
}

export function createTournament(t) {
  const r = run(
    `INSERT INTO tournaments (format, level, play_date, play_time, courts, duration_min, round_min, venue)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    t.format ?? 'non-stop', t.level ?? '', t.play_date ?? '', t.play_time ?? '',
    t.courts ?? 2, t.duration_min ?? 90, t.round_min ?? 12, String(t.venue ?? '').trim().slice(0, 80),
  )
  const id = Number(r.lastInsertRowid)
  seedTournamentCourts(id, t.courts ?? 2)
  return getTournament(id)
}

export const listSignups = (tid) =>
  all('SELECT * FROM signups WHERE tournament_id = ? ORDER BY id', tid)

export function addSignup(tid, { name, gender, partner, wa_id }) {
  run(`INSERT INTO signups (tournament_id, name, gender, partner, wa_id)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (tournament_id, name) DO UPDATE SET
         gender = excluded.gender, partner = excluded.partner, wa_id = excluded.wa_id`,
    tid, name, gender ?? '', partner ?? '', wa_id ?? '')
  return listSignups(tid)
}

/** Write one player's partner — the pairs board saves both halves of a pair. */
export const setPartner = (tid, name, partner) =>
  run('UPDATE signups SET partner = ? WHERE tournament_id = ? AND name = ?', partner ?? '', tid, name)

export function removeSignup(tid, name) {
  const hit = one(
    'SELECT * FROM signups WHERE tournament_id = ? AND lower(name) = lower(?)', tid, name)
  if (hit) run('DELETE FROM signups WHERE id = ?', hit.id)
  return hit
}

export const getMatch = (id) => one('SELECT * FROM matches WHERE id = ?', id)
export const listMatches = (tid) =>
  all('SELECT * FROM matches WHERE tournament_id = ? ORDER BY round, court', tid)

export function replaceMatches(tid, matches) {
  run('DELETE FROM matches WHERE tournament_id = ?', tid)
  const ins = db.prepare(
    `INSERT INTO matches (tournament_id, round, court, team_a, team_b)
     VALUES (?, ?, ?, ?, ?)`)
  for (const m of matches) ins.run(tid, m.round, m.court, m.teamA, m.teamB)
  run("UPDATE tournaments SET status = 'scheduled' WHERE id = ?", tid)
  return listMatches(tid)
}

export function recordScore(matchId, a, b) {
  run('UPDATE matches SET score_a = ?, score_b = ? WHERE id = ?', a, b, matchId)
  return one('SELECT * FROM matches WHERE id = ?', matchId)
}
