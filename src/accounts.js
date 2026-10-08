/**
 * People, their roles, and how they sign in.
 *
 * One person, one account, any mix of three roles: a **player** sees their own
 * nights and profile; an **organizer** runs nights (sign-ups, pairs, scores,
 * posts); a **club** also owns the settings — clubs, courts, the rules of each
 * format — and decides who else gets a role.
 *
 * There are no passwords. A person proves they own a phone or an email by
 * typing back a six-digit code sent to it (WhatsApp, SMS) or by opening a link
 * sent to the email. Codes and session tokens are stored hashed, expire, and
 * a code allows five tries.
 *
 * Who approves whom: a player is in at once. The first account to claim the
 * club role gets it — somebody has to be first — and so does the first
 * organizer while there is no club yet. After that, organizer and club roles
 * wait for a club member to approve them. `AUTO_APPROVE=1` (the public demo)
 * approves everything, so a visitor can try every role.
 */
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { db, ensurePlayer, onInit } from './db.js'
import { scoped } from './scope.js'

export const ROLES = ['player', 'organizer', 'club']
export const HANDS = ['right', 'left']
export const SIDES = ['drive', 'backhand', 'either']

onInit(() => db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL DEFAULT '',
    phone      TEXT NOT NULL DEFAULT '',          -- +351912345678
    instagram  TEXT NOT NULL DEFAULT '',          -- without the @
    hand       TEXT NOT NULL DEFAULT '',          -- right | left | ''
    side       TEXT NOT NULL DEFAULT '',          -- drive | backhand | either | ''
    player_id  INTEGER NOT NULL DEFAULT 0,        -- their row in the player register, if they play
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE UNIQUE INDEX IF NOT EXISTS accounts_email ON accounts (lower(email)) WHERE email <> '';
  CREATE UNIQUE INDEX IF NOT EXISTS accounts_phone ON accounts (phone) WHERE phone <> '';

  CREATE TABLE IF NOT EXISTS account_roles (
    account_id INTEGER NOT NULL,
    role       TEXT NOT NULL,                     -- player | organizer | club
    status     TEXT NOT NULL DEFAULT 'pending',   -- active | pending
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (account_id, role)
  );

  CREATE TABLE IF NOT EXISTS login_codes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    channel    TEXT NOT NULL,                     -- whatsapp | sms | email
    code_hash  TEXT NOT NULL,
    link_hash  TEXT NOT NULL DEFAULT '',          -- the email's sign-in link
    tries      INTEGER NOT NULL DEFAULT 0,
    used       INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    account_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`))

const one = (sql, ...a) => db.prepare(sql).get(...a)
const all = (sql, ...a) => db.prepare(sql).all(...a)
const run = (sql, ...a) => db.prepare(sql).run(...a)
const sha = (s) => createHash('sha256').update(String(s)).digest('hex')
const inMinutes = (m) => new Date(Date.now() + m * 60000).toISOString()
const nowIso = () => new Date().toISOString()

/** Accounts switched on (ACCOUNTS=on) — off keeps the shared console login. */
// A sandbox always has accounts: its visitor is signed in as the club that owns
// it, and anyone they invite is approved at once so every role can be tried.
export const accountsOn = () => !!scoped()?.box || /^(on|1|true|yes)$/i.test(process.env.ACCOUNTS || '')
const autoApprove = () => !!scoped()?.box || /^(1|true|yes|on)$/i.test(process.env.AUTO_APPROVE || '')

// ---- cleaning what people type ----

/**
 * A phone number as one string: `+351 912 345 678`, `00351…`, `912345678`
 * (a bare national number gets DEFAULT_COUNTRY_CODE, 351 unless set). Returns
 * '' for anything that is not 8–15 digits once tidied.
 */
export function cleanPhone(raw) {
  let s = String(raw || '').replace(/[\s().-]/g, '')
  if (!s) return ''
  if (s.startsWith('00')) s = `+${s.slice(2)}`
  if (!s.startsWith('+')) s = `+${process.env.DEFAULT_COUNTRY_CODE || '351'}${s.replace(/^0/, '')}`
  return /^\+\d{8,15}$/.test(s) ? s : ''
}
export const cleanEmail = (raw) => {
  const s = String(raw || '').trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 160 ? s : ''
}
export const cleanInstagram = (raw) =>
  String(raw || '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/.*$/, '')
    .replace(/[^\w.]/g, '').slice(0, 30)

// ---- accounts ----

export function getAccount(id) {
  const a = one('SELECT * FROM accounts WHERE id = ?', id)
  if (!a) return null
  a.roles = all('SELECT role, status FROM account_roles WHERE account_id = ? ORDER BY created_at', id)
  a.active = new Set(a.roles.filter((r) => r.status === 'active').map((r) => r.role))
  return a
}
export const findAccount = ({ email, phone }) =>
  (email && one('SELECT id FROM accounts WHERE lower(email) = lower(?)', email))
  || (phone && one('SELECT id FROM accounts WHERE phone = ?', phone)) || null

const hasActive = (role) => !!one("SELECT 1 FROM account_roles WHERE role = ? AND status = 'active' LIMIT 1", role)

/**
 * Give a role, active or waiting for a club member. Returns the status given.
 * Somebody has to be first: the club role is free while nobody holds it, and
 * an organizer is approved while there is no club to approve them.
 */
export function grantRole(accountId, role) {
  if (!ROLES.includes(role)) return null
  const existing = one('SELECT status FROM account_roles WHERE account_id = ? AND role = ?', accountId, role)
  if (existing) return existing.status
  const status = autoApprove() || role === 'player' || !hasActive('club') ? 'active' : 'pending'
  run('INSERT INTO account_roles (account_id, role, status) VALUES (?, ?, ?)', accountId, role, status)
  if (role === 'player' && status === 'active') linkPlayer(accountId)
  return status
}

/** A player account finds (or makes) its row in the player register, by name. */
function linkPlayer(accountId) {
  const a = one('SELECT * FROM accounts WHERE id = ?', accountId)
  if (!a || a.player_id) return
  const p = ensurePlayer(a.name)
  if (p) run('UPDATE accounts SET player_id = ? WHERE id = ?', p.id, accountId)
}

/**
 * A new account. `{error}` when the contact is missing or already used — the
 * person should sign in instead, not end up with two accounts.
 */
export function register({ name, email, phone, instagram, hand, side, roles }) {
  const n = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 80)
  const e = cleanEmail(email)
  const p = cleanPhone(phone)
  if (!n) return { error: 'regNeedName' }
  if (!e && !p) return { error: email || phone ? 'regBadContact' : 'regNeedContact' }
  if (findAccount({ email: e, phone: p })) return { error: 'regTaken' }
  const wanted = ROLES.filter((r) => [].concat(roles || []).includes(r))
  if (!wanted.length) return { error: 'regNeedRole' }
  const r = run(`INSERT INTO accounts (name, email, phone, instagram, hand, side) VALUES (?, ?, ?, ?, ?, ?)`,
    n, e, p, cleanInstagram(instagram), HANDS.includes(hand) ? hand : '', SIDES.includes(side) ? side : '')
  const id = Number(r.lastInsertRowid)
  for (const role of wanted) grantRole(id, role)
  return { account: getAccount(id) }
}

/** Profile changes. Contact details are not edited here — they are what you sign in with. */
export function updateProfile(id, { name, instagram, hand, side }) {
  const a = one('SELECT * FROM accounts WHERE id = ?', id)
  if (!a) return null
  run('UPDATE accounts SET name = ?, instagram = ?, hand = ?, side = ? WHERE id = ?',
    String(name || a.name).replace(/\s+/g, ' ').trim().slice(0, 80) || a.name, cleanInstagram(instagram ?? a.instagram),
    HANDS.includes(hand) ? hand : '', SIDES.includes(side) ? side : '', id)
  return getAccount(id)
}

/** Everyone, with their roles — for the club's Members page. */
export function listAccounts() {
  const rows = all('SELECT * FROM accounts ORDER BY lower(name)')
  const roles = all('SELECT * FROM account_roles')
  for (const a of rows) a.roles = roles.filter((r) => r.account_id === a.id)
  return rows
}
export function setRoleStatus(accountId, role, status) {
  if (status === 'remove') {
    // The last active club member cannot remove the role: nobody could approve anyone again.
    if (role === 'club' && all("SELECT account_id FROM account_roles WHERE role = 'club' AND status = 'active'").length <= 1
      && one("SELECT 1 FROM account_roles WHERE account_id = ? AND role = 'club' AND status = 'active'", accountId)) return false
    run('DELETE FROM account_roles WHERE account_id = ? AND role = ?', accountId, role)
    return true
  }
  if (status !== 'active') return false
  run("UPDATE account_roles SET status = 'active' WHERE account_id = ? AND role = ?", accountId, role)
  if (role === 'player') linkPlayer(accountId)
  return true
}
export const pendingCount = () => one("SELECT COUNT(*) AS n FROM account_roles WHERE status = 'pending'").n

// ---- codes ----

/**
 * A new code for this account on this channel. Returns `{code, link}` in the
 * clear exactly once, for the sender; only hashes are kept. Five sends an
 * hour per account, so nobody can flood someone's phone with this form.
 */
export function newCode(accountId, channel) {
  const recent = one(`SELECT COUNT(*) AS n FROM login_codes WHERE account_id = ? AND created_at > datetime('now', '-1 hour')`, accountId).n
  if (recent >= 5) return { error: 'codeTooMany' }
  run('UPDATE login_codes SET used = 1 WHERE account_id = ? AND used = 0', accountId)
  const code = String(randomInt(0, 1000000)).padStart(6, '0')
  const link = channel === 'email' ? randomBytes(24).toString('base64url') : ''
  const r = run('INSERT INTO login_codes (account_id, channel, code_hash, link_hash, expires_at) VALUES (?, ?, ?, ?, ?)',
    accountId, channel, sha(`${accountId}:${code}`), link ? sha(link) : '', inMinutes(15))
  return { id: Number(r.lastInsertRowid), code, link }
}

/** The account a typed code proves, or `{error}`. A code works once. */
export function checkCode(accountId, typed) {
  const c = one('SELECT * FROM login_codes WHERE account_id = ? AND used = 0 ORDER BY id DESC LIMIT 1', accountId)
  if (!c || c.expires_at < nowIso()) return { error: 'codeExpired' }
  if (c.tries >= 5) return { error: 'codeTooManyTries' }
  run('UPDATE login_codes SET tries = tries + 1 WHERE id = ?', c.id)
  const want = Buffer.from(c.code_hash)
  const got = Buffer.from(sha(`${accountId}:${String(typed || '').replace(/\D/g, '')}`))
  if (want.length !== got.length || !timingSafeEqual(want, got)) return { error: 'codeWrong' }
  run('UPDATE login_codes SET used = 1 WHERE id = ?', c.id)
  return { accountId }
}

/** The account an email link proves, or null. */
export function checkLink(token) {
  const c = one('SELECT * FROM login_codes WHERE link_hash = ? AND used = 0', sha(token || ''))
  if (!c || c.expires_at < nowIso()) return null
  run('UPDATE login_codes SET used = 1 WHERE id = ?', c.id)
  return c.account_id
}

// ---- sessions ----

const SESSION_DAYS = 60

export function newSession(accountId) {
  const token = randomBytes(32).toString('base64url')
  run('INSERT INTO sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)',
    sha(token), accountId, inMinutes(SESSION_DAYS * 24 * 60))
  return token
}
export function sessionAccount(token) {
  if (!token) return null
  const s = one('SELECT * FROM sessions WHERE token_hash = ?', sha(token))
  if (!s || s.expires_at < nowIso()) return null
  return getAccount(s.account_id)
}
export const endSession = (token) => run('DELETE FROM sessions WHERE token_hash = ?', sha(token || ''))

/** What an account may do. `club` implies everything an organizer can. */
export const can = (account, what) => {
  if (!account) return false
  const r = account.active
  if (what === 'run') return r.has('organizer') || r.has('club')
  if (what === 'club') return r.has('club')
  if (what === 'play') return r.has('player')
  return false
}

// ---- a signed value for a cookie (which account is mid-sign-in) ----

onInit(() => db.exec('CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)'))
function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET
  const r = one("SELECT value FROM app_settings WHERE key = 'secret'")
  if (r) return r.value
  const v = randomBytes(32).toString('hex')
  run("INSERT INTO app_settings (key, value) VALUES ('secret', ?)", v)
  return v
}
const mac = (v) => createHmac('sha256', secret()).update(String(v)).digest('base64url')
export const sign = (v) => `${v}.${mac(v)}`
export function unsign(signed) {
  const s = String(signed || '')
  const i = s.lastIndexOf('.')
  if (i < 1) return null
  const v = s.slice(0, i)
  const want = Buffer.from(mac(v)); const got = Buffer.from(s.slice(i + 1))
  return want.length === got.length && timingSafeEqual(want, got) ? v : null
}
