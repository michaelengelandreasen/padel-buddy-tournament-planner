import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { parseWhen } from './dates.js'
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
    rules_pt  TEXT NOT NULL DEFAULT ''
  );
  INSERT OR IGNORE INTO club (id, name) VALUES (1, 'Padel Club');

  CREATE TABLE IF NOT EXISTS courts (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    label  TEXT NOT NULL,
    sort   INTEGER NOT NULL DEFAULT 0
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
  for (const [col, def] of [['language', "'en'"], ['rules_en', "''"], ['rules_pt', "''"]]) {
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
  const allowed = ['name', 'address', 'maps_url', 'language', 'rules_en', 'rules_pt']
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

export const listCourts = () => all('SELECT * FROM courts ORDER BY sort, id')
export const addCourt = (label, sort = 0) =>
  run('INSERT INTO courts (label, sort) VALUES (?, ?)', label, sort)
export const deleteCourt = (id) => run('DELETE FROM courts WHERE id = ?', id)

/** Soonest first, with undated ones last — a club reads its list as a calendar. */
export const listTournaments = () =>
  all(`SELECT * FROM tournaments
       ORDER BY CASE WHEN play_date = '' THEN 1 ELSE 0 END, play_date, play_time, id DESC`)
export const getTournament = (id) =>
  one('SELECT * FROM tournaments WHERE id = ?', id)

/** The tournament the bot is talking about: the newest one still open. */
export const currentTournament = () =>
  one("SELECT * FROM tournaments WHERE status != 'done' ORDER BY id DESC LIMIT 1")

/** Wipe a tournament and everything hanging off it — used by the seed script. */
export function deleteTournament(id) {
  run('DELETE FROM matches WHERE tournament_id = ?', id)
  run('DELETE FROM signups WHERE tournament_id = ?', id)
  run('DELETE FROM tournaments WHERE id = ?', id)
}

export function createTournament(t) {
  const r = run(
    `INSERT INTO tournaments (format, level, play_date, play_time, courts, duration_min, round_min)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    t.format ?? 'non-stop', t.level ?? '', t.play_date ?? '', t.play_time ?? '',
    t.courts ?? 2, t.duration_min ?? 90, t.round_min ?? 12,
  )
  return getTournament(Number(r.lastInsertRowid))
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

export function removeSignup(tid, name) {
  const hit = one(
    'SELECT * FROM signups WHERE tournament_id = ? AND lower(name) = lower(?)', tid, name)
  if (hit) run('DELETE FROM signups WHERE id = ?', hit.id)
  return hit
}

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
