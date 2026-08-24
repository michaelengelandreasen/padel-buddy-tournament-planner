import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

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
    maps_url  TEXT NOT NULL DEFAULT ''
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
    level        TEXT NOT NULL DEFAULT '',
    play_date    TEXT NOT NULL DEFAULT '',
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

const one = (sql, ...args) => db.prepare(sql).get(...args)
const all = (sql, ...args) => db.prepare(sql).all(...args)
const run = (sql, ...args) => db.prepare(sql).run(...args)

export const getClub = () => one('SELECT * FROM club WHERE id = 1')

export function saveClub({ name, address, maps_url }) {
  run('UPDATE club SET name = ?, address = ?, maps_url = ? WHERE id = 1',
    name ?? '', address ?? '', maps_url ?? '')
  return getClub()
}

export const listCourts = () => all('SELECT * FROM courts ORDER BY sort, id')
export const addCourt = (label, sort = 0) =>
  run('INSERT INTO courts (label, sort) VALUES (?, ?)', label, sort)
export const deleteCourt = (id) => run('DELETE FROM courts WHERE id = ?', id)

export const listTournaments = () =>
  all('SELECT * FROM tournaments ORDER BY id DESC')
export const getTournament = (id) =>
  one('SELECT * FROM tournaments WHERE id = ?', id)

/** The tournament the bot is talking about: the newest one still open. */
export const currentTournament = () =>
  one("SELECT * FROM tournaments WHERE status != 'done' ORDER BY id DESC LIMIT 1")

export function createTournament(t) {
  const r = run(
    `INSERT INTO tournaments (format, level, play_date, courts, duration_min, round_min)
     VALUES (?, ?, ?, ?, ?, ?)`,
    t.format ?? 'non-stop', t.level ?? '', t.play_date ?? '',
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
