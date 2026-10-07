// Accounts, roles and sign-in codes, against a throwaway database.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), 'padel-acc-')), 'test.db')
delete process.env.AUTO_APPROVE
const A = await import('../src/accounts.js')
const db = await import('../src/db.js')

const status = (a, role) => a.roles.find((r) => r.role === role)?.status

test('contacts are tidied: phones get a country code, emails a lower case', () => {
  assert.equal(A.cleanPhone('912 345 678'), '+351912345678')
  assert.equal(A.cleanPhone('0034 612-345-678'), '+34612345678')
  assert.equal(A.cleanPhone('12'), '')
  assert.equal(A.cleanEmail(' Ana@Club.PT '), 'ana@club.pt')
  assert.equal(A.cleanEmail('ana@club'), '')
  assert.equal(A.cleanInstagram('https://instagram.com/ana.padel/'), 'ana.padel')
})

test('the first club claims the club; after that organizer and club roles wait', () => {
  const owner = A.register({ name: 'Rita Club', phone: '911111111', roles: ['club', 'organizer'] }).account
  assert.equal(status(owner, 'club'), 'active')
  const org = A.register({ name: 'Nuno Org', email: 'nuno@x.pt', roles: ['organizer', 'player'] }).account
  assert.equal(status(org, 'organizer'), 'pending')
  assert.equal(status(org, 'player'), 'active')
  assert.equal(A.can(A.getAccount(org.id), 'run'), false)
  assert.equal(A.pendingCount(), 1)
  A.setRoleStatus(org.id, 'organizer', 'active')
  assert.equal(A.can(A.getAccount(org.id), 'run'), true)
  assert.equal(A.can(A.getAccount(org.id), 'club'), false)
})

test('a player account joins the player register under its name', () => {
  const p = A.register({ name: 'Bia Lopes', phone: '+351922222222', hand: 'left', side: 'backhand', roles: ['player'] }).account
  assert.ok(p.player_id)
  assert.equal(db.getPlayer(p.player_id).name, 'Bia Lopes')
  assert.equal(p.hand, 'left')
  assert.equal(p.side, 'backhand')
})

test('registration refuses what it should', () => {
  assert.equal(A.register({ name: '', phone: '933333333', roles: ['player'] }).error, 'regNeedName')
  assert.equal(A.register({ name: 'X', roles: ['player'] }).error, 'regNeedContact')
  assert.equal(A.register({ name: 'X', phone: '12', roles: ['player'] }).error, 'regBadContact')
  assert.equal(A.register({ name: 'X', phone: '933333333', roles: [] }).error, 'regNeedRole')
  assert.equal(A.register({ name: 'Again', phone: '911 111 111', roles: ['player'] }).error, 'regTaken')
})

test('a code works once, the wrong one counts as a try, and five tries is the end', () => {
  const a = A.register({ name: 'Code Person', phone: '944444444', roles: ['player'] }).account
  const { code } = A.newCode(a.id, 'sms')
  assert.equal(A.checkCode(a.id, '000000' === code ? '111111' : '000000').error, 'codeWrong')
  assert.equal(A.checkCode(a.id, code.slice(0, 3) + ' ' + code.slice(3)).accountId, a.id)
  assert.equal(A.checkCode(a.id, code).error, 'codeExpired')
  const again = A.newCode(a.id, 'sms')
  for (let i = 0; i < 5; i++) A.checkCode(a.id, 'nope')
  assert.equal(A.checkCode(a.id, again.code).error, 'codeTooManyTries')
})

test('an email link signs in once', () => {
  const a = A.register({ name: 'Mail Person', email: 'mail@x.pt', roles: ['player'] }).account
  const { link } = A.newCode(a.id, 'email')
  assert.equal(A.checkLink(link), a.id)
  assert.equal(A.checkLink(link), null)
})

test('sessions find their account until they end', () => {
  const a = A.register({ name: 'Session Person', phone: '955555555', roles: ['player'] }).account
  const token = A.newSession(a.id)
  assert.equal(A.sessionAccount(token).id, a.id)
  A.endSession(token)
  assert.equal(A.sessionAccount(token), null)
})

test('the last club member cannot drop the club role', () => {
  const owner = A.listAccounts().find((x) => x.name === 'Rita Club')
  assert.equal(A.setRoleStatus(owner.id, 'club', 'remove'), false)
  assert.equal(status(A.getAccount(owner.id), 'club'), 'active')
})

test('signed values survive the round trip and nothing else does', () => {
  const s = A.sign('12|sms|/t/3')
  assert.equal(A.unsign(s), '12|sms|/t/3')
  assert.equal(A.unsign(s.replace('12', '13')), null)
})
