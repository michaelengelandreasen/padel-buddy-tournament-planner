/**
 * Sandboxes: a private copy of the app for anyone who wants to try it.
 *
 * A visitor types a name and gets a club of their own — invented players, a
 * tournament half played, three more on the calendar — signed in as the club
 * that owns it. Nothing they do is seen by anyone else, and a week later it is
 * deleted: the database file, the account, all of it. No email, no password;
 * the cookie is the key, and a private link carries it to another device.
 *
 * Each sandbox is one SQLite file. That is the whole isolation model, and it is
 * a strong one: there is no tenant column to forget in a WHERE clause, because
 * a request scoped to one file (scope.js) cannot name another. Deleting a
 * sandbox is deleting a file.
 *
 * A public form that creates files needs limits, so there are three: how many
 * sandboxes exist at once, how many one address may start in a day, and how
 * large one may grow.
 */
import { DatabaseSync } from 'node:sqlite'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { db, openDb } from './db.js'
import { scope } from './scope.js'
import { seedDemo } from './demo-seed.js'
import * as A from './accounts.js'

export const sandboxOn = /^(on|1|true|yes)$/i.test(process.env.SANDBOX || '')

const DIR = process.env.SANDBOX_DIR || join(dirname(process.env.DB_PATH || './data/planner.db'), 'sandboxes')
export const DAYS = Math.max(1, Number(process.env.SANDBOX_DAYS) || 7)
const MAX = Math.max(1, Number(process.env.SANDBOX_MAX) || 300)
const PER_IP = Math.max(1, Number(process.env.SANDBOX_PER_IP) || 5)
export const MAX_BYTES = (Number(process.env.SANDBOX_MAX_MB) || 8) * 1024 * 1024
const OPEN_AT_ONCE = 40

let reg = null
/** The list of sandboxes — a database of its own, so it outlives any one of them. */
function registry() {
  if (reg) return reg
  mkdirSync(DIR, { recursive: true })
  reg = new DatabaseSync(join(DIR, '_registry.db'))
  reg.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS boxes (
      id         TEXT PRIMARY KEY,
      owner      TEXT NOT NULL,
      club       TEXT NOT NULL,
      account_id INTEGER NOT NULL DEFAULT 0,
      ip_hash    TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `)
  return reg
}

function secret() {
  if (process.env.SANDBOX_SECRET) return process.env.SANDBOX_SECRET
  const r = registry().prepare("SELECT value FROM settings WHERE key = 'secret'").get()
  if (r) return r.value
  const v = randomBytes(32).toString('hex')
  registry().prepare("INSERT INTO settings (key, value) VALUES ('secret', ?)").run(v)
  return v
}
const mac = (v) => createHmac('sha256', secret()).update(String(v)).digest('base64url').slice(0, 22)
/** The cookie value, and the tail of the private link: the id and proof we issued it. */
export const tokenFor = (id) => `${id}.${mac(id)}`
function idFrom(token) {
  const s = String(token || '')
  const i = s.indexOf('.')
  if (i < 1 || !/^[\w-]{8,24}$/.test(s.slice(0, i))) return null
  const want = Buffer.from(mac(s.slice(0, i))); const got = Buffer.from(s.slice(i + 1))
  return want.length === got.length && timingSafeEqual(want, got) ? s.slice(0, i) : null
}

const file = (id) => join(DIR, `${id}.db`)
const iso = (ms) => new Date(ms).toISOString()
const clean = (v, max) => String(v || '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
// Only ever compared, never shown: enough to count an address without keeping it.
const ipHash = (ip) => createHash('sha256').update(`${secret()}|${ip || ''}`).digest('hex').slice(0, 24)

/** Open handles, most recently used last. A sandbox nobody is looking at is closed. */
const open = new Map()
function handle(id) {
  let h = open.get(id)
  if (h) { open.delete(id); open.set(id, h); return h }
  h = { db: openDb(file(id)), outbox: [] }
  open.set(id, h)
  while (open.size > OPEN_AT_ONCE) close(open.keys().next().value)
  return h
}
function close(id) {
  const h = open.get(id)
  if (!h) return
  open.delete(id)
  try { h.db.close() } catch { /* already closed */ }
}

const row = (id) => registry().prepare('SELECT * FROM boxes WHERE id = ?').get(id) || null

/** Run `fn` with the app pointed at this sandbox's data. */
export function inside(box, fn) {
  const h = handle(box.id)
  return scope.run({ db: h.db, outbox: h.outbox, box }, fn)
}

/** The sandbox a cookie or a link belongs to — or null if it never existed or has run out. */
export function find(token) {
  const id = idFrom(token)
  if (!id) return null
  const b = row(id)
  if (!b) return null
  if (b.expires_at <= iso(Date.now())) { remove(id); return null }
  return { ...b, token: tokenFor(id), daysLeft: Math.max(1, Math.ceil((Date.parse(b.expires_at) - Date.now()) / 86400000)) }
}

export const count = () => registry().prepare('SELECT COUNT(*) AS n FROM boxes').get().n

/**
 * Start a sandbox. Returns `{ box, session }`, or `{ error }` with a reason the
 * page can say plainly: no name, the house is full, or this address has started
 * enough for one day.
 */
export function create({ name, club, ip = '', now = Date.now() } = {}) {
  const owner = clean(name, 60)
  if (!owner) return { error: 'sbNeedName' }
  sweep(now)
  if (count() >= MAX) return { error: 'sbFull' }
  const who = ipHash(ip)
  const today = registry().prepare('SELECT COUNT(*) AS n FROM boxes WHERE ip_hash = ? AND created_at > ?')
    .get(who, iso(now - 86400000)).n
  if (ip && today >= PER_IP) return { error: 'sbTooMany' }

  const id = randomBytes(9).toString('base64url')
  const clubName = clean(club, 60) || `${owner.split(' ')[0]}'s Padel Club`
  const box = { id, owner, club: clubName, created_at: iso(now), expires_at: iso(now + DAYS * 86400000) }
  let session = ''
  let accountId = 0
  try {
    inside(box, () => {
      // One transaction: a seed committed row by row is a second of fsyncs.
      db.exec('BEGIN')
      seedDemo({ clubName })
      // The visitor is the club: every role, so nothing in the app is closed to them.
      const r = A.register({ name: owner, email: `${id.toLowerCase().replace(/[^a-z0-9]/g, 'x')}@sandbox.invalid`,
        roles: ['club', 'organizer', 'player'] })
      if (r.error) throw new Error(r.error)
      accountId = r.account.id
      session = A.newSession(accountId)
      db.exec('COMMIT')
    })
  } catch (err) {
    remove(id)
    throw err
  }
  registry().prepare(`INSERT INTO boxes (id, owner, club, account_id, ip_hash, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, owner, clubName, accountId, who, box.created_at, box.expires_at)
  return { box: find(tokenFor(id)), session }
}

/** A fresh sign-in for the sandbox's owner — what opening the private link does. */
export const signIn = (box) => inside(box, () => A.newSession(box.account_id))

/** Delete a sandbox now: the row, the open handle, the files. */
export function remove(id) {
  if (!/^[\w-]{8,24}$/.test(String(id))) return
  close(id)
  registry().prepare('DELETE FROM boxes WHERE id = ?').run(id)
  for (const suffix of ['', '-wal', '-shm']) rmSync(file(id) + suffix, { force: true })
}

/** How big a sandbox has grown, WAL included. */
export function bytes(id) {
  let n = 0
  for (const suffix of ['', '-wal']) { try { n += statSync(file(id) + suffix).size } catch { /* not there */ } }
  return n
}

/**
 * Delete everything that has run out, and any database file the registry does
 * not know — a create that died halfway must not leave a file behind forever.
 */
export function sweep(now = Date.now()) {
  const gone = registry().prepare('SELECT id FROM boxes WHERE expires_at <= ?').all(iso(now))
  for (const { id } of gone) remove(id)
  if (existsSync(DIR)) {
    const known = new Set(registry().prepare('SELECT id FROM boxes').all().map((b) => b.id))
    for (const f of readdirSync(DIR)) {
      const m = /^([\w-]{8,24})\.db(-wal|-shm)?$/.exec(f)
      if (m && !m[1].startsWith('_') && !known.has(m[1]) && !open.has(m[1])) rmSync(join(DIR, f), { force: true })
    }
  }
  return gone.length
}

/** Sweep at start and every hour, without keeping the process alive for it. */
export function startSweeper() {
  const n = sweep()
  if (n) console.log(`sandbox: removed ${n} expired`)
  setInterval(() => { try { sweep() } catch (err) { console.error('sandbox sweep:', err.message) } }, 3600000).unref()
}
