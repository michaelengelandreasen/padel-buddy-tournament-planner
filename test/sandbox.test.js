// Sandboxes: each visitor's data is their own, limited, and gone after a week.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'padel-sbx-'))
process.env.DB_PATH = join(dir, 'base.db')
process.env.SANDBOX = 'on'
process.env.SANDBOX_DIR = join(dir, 'boxes')
process.env.SANDBOX_MAX = '4'
process.env.SANDBOX_PER_IP = '2'
delete process.env.ACCOUNTS
const S = await import('../src/sandbox.js')
const db = await import('../src/db.js')
const A = await import('../src/accounts.js')
const { draft } = await import('../src/messaging/draft.js')
const { buildChannels } = await import('../src/messaging/transport.js')

const DAY = 86400000

test('a sandbox starts seeded, with its visitor signed in as the club', () => {
  const { box, session, error } = S.create({ name: '  Ana   Silva ', club: 'Clube da Ana', ip: '1.1.1.1' })
  assert.equal(error, undefined)
  assert.equal(box.owner, 'Ana Silva')
  assert.equal(box.daysLeft, 7)
  S.inside(box, () => {
    assert.equal(db.getClub().name, 'Clube da Ana')
    assert.ok(db.listPlayers().length >= 16)
    assert.ok(db.listTournaments().length >= 3)
    const me = A.sessionAccount(session)
    assert.equal(me.name, 'Ana Silva')
    assert.ok(A.can(me, 'club') && A.can(me, 'run') && A.can(me, 'play'))
  })
  S.remove(box.id)
})

test('one visitor cannot see or change another visitor’s data', () => {
  const a = S.create({ name: 'Rui', ip: '2.2.2.2' }).box
  const b = S.create({ name: 'Marta', ip: '3.3.3.3' }).box
  S.inside(a, () => { db.saveClub({ name: 'Only Rui sees this' }); db.addPlayersFromText('Zacarias Único') })
  S.inside(b, () => {
    assert.equal(db.getClub().name, "Marta's Padel Club")
    assert.equal(db.listPlayers().some((p) => p.name === 'Zacarias Único'), false)
  })
  S.inside(a, () => assert.equal(db.listPlayers().some((p) => p.name === 'Zacarias Único'), true))
  // Outside any sandbox the club's own database is untouched by both.
  assert.notEqual(db.getClub().name, 'Only Rui sees this')
  assert.equal(db.listPlayers().length, 0)
  S.remove(a.id); S.remove(b.id)
})

test('a session from one sandbox opens nothing in another', () => {
  const a = S.create({ name: 'Pedro', ip: '4.4.4.4' })
  const other = S.find(S.tokenFor(S.create({ name: 'Other', ip: '4.4.4.5' }).box.id))
  assert.equal(S.inside(other, () => A.sessionAccount(a.session)), null)
  S.remove(a.box.id); S.remove(other.id)
})

test('messages stay in the sandbox that wrote them, and never reach a real group', async () => {
  const [a, b] = ['x', 'y'].map((n, i) => S.find(S.tokenFor(S.create({ name: n, ip: `5.5.5.${i}` }).box.id)))
  await S.inside(a, () => draft.send('round 2 — court 1'))
  assert.equal(S.inside(a, () => draft.outbox().length), 1)
  assert.equal(S.inside(b, () => draft.outbox().length), 0)
  assert.equal(draft.outbox().length, 0)
  assert.deepEqual(buildChannels({ SANDBOX: 'on', TELEGRAM_BOT_TOKEN: '123:abc', MESSAGING_CHANNELS: 'telegram' }).map((c) => c.name), ['draft'])
  S.remove(a.id); S.remove(b.id)
})

test('only a token this server issued opens a sandbox', () => {
  const { box } = S.create({ name: 'Token', ip: '6.6.6.6' })
  assert.equal(S.find(box.token).id, box.id)
  assert.equal(S.find(`${box.id}.wrongsignaturewrongsig`), null)
  assert.equal(S.find(`../../etc/passwd.${'a'.repeat(22)}`), null)
  assert.equal(S.find(''), null)
  S.remove(box.id)
})

test('a name is required, and control characters and markup are stripped from it', () => {
  assert.equal(S.create({ name: '   ' }).error, 'sbNeedName')
  const { box } = S.create({ name: 'Zé <script>\n', ip: '7.7.7.7' })
  assert.equal(box.owner, 'Zé script')
  S.remove(box.id)
})

test('one address can only start so many in a day; the house can only hold so many', () => {
  const left = () => 4 - S.count()
  // Clear the board for exact counting.
  S.sweep(Date.now() + 30 * DAY)
  assert.equal(S.count(), 0)
  assert.ok(S.create({ name: 'one', ip: '9.9.9.9' }).box)
  assert.ok(S.create({ name: 'two', ip: '9.9.9.9' }).box)
  assert.equal(S.create({ name: 'three', ip: '9.9.9.9' }).error, 'sbTooMany')
  assert.ok(S.create({ name: 'a', ip: '9.9.9.1' }).box)
  assert.ok(S.create({ name: 'b', ip: '9.9.9.2' }).box)
  assert.equal(left(), 0)
  assert.equal(S.create({ name: 'c', ip: '9.9.9.3' }).error, 'sbFull')
})

test('after a week the sandbox is gone: the row, the files, the sign-in', () => {
  S.sweep(Date.now() + 30 * DAY)
  const { box, session } = S.create({ name: 'Week', ip: '8.8.8.8' })
  const f = join(process.env.SANDBOX_DIR, `${box.id}.db`)
  assert.ok(existsSync(f))
  assert.equal(S.sweep(Date.now() + 6 * DAY), 0)
  assert.ok(S.find(box.token))
  assert.equal(S.sweep(Date.now() + 7 * DAY + 1000), 1)
  assert.equal(S.find(box.token), null)
  assert.equal(existsSync(f), false)
  assert.equal(existsSync(`${f}-wal`), false)
  assert.equal(S.count(), 0)
  assert.equal(session.length > 20, true)
})

test('a database file nobody registered is swept away too', () => {
  const stray = join(process.env.SANDBOX_DIR, 'strayfile1234.db')
  writeFileSync(stray, '')
  S.sweep()
  assert.equal(existsSync(stray), false)
  assert.ok(existsSync(join(process.env.SANDBOX_DIR, '_registry.db')))
})
