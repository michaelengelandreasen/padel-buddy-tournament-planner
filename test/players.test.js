// The player register, against a throwaway database.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), 'padel-')), 'test.db')
const db = await import('../src/db.js')

test('players: signing up puts a name in the register, gender filled once', () => {
  const t = db.createTournament({ level: 'MX-4', play_date: '2030-01-05', play_time: '10:00', courts: 2 })
  db.addSignup(t.id, { name: 'Ana', gender: '', partner: '' })
  db.addSignup(t.id, { name: 'ana', gender: 'F', partner: '' })
  const p = db.listPlayers().find((x) => x.name === 'Ana')
  assert.equal(p.gender, 'F')
  assert.equal(p.nights, 1)
})

test('players: a level change is kept with its note; the same level again is not a change', () => {
  const p = db.ensurePlayer('Rui', 'M')
  assert.equal(db.setPlayerLevel(p.id, 5, 'first rating'), true)
  assert.equal(db.setPlayerLevel(p.id, 5), false)
  assert.equal(db.setPlayerLevel(p.id, 4, 'won three nights'), true)
  const full = db.getPlayer(p.id)
  assert.equal(full.grade, 4)
  assert.deepEqual(full.history.map((h) => [h.grade, h.note]), [[4, 'won three nights'], [5, 'first rating']])
  assert.equal(db.listPlayers().find((x) => x.id === p.id).prev_grade, 5)
  assert.equal(db.setPlayerLevel(p.id, 9), true)   // out of range clears to "not rated"
  assert.equal(db.getPlayer(p.id).grade, 0)
})

test('players: a sign-up borrows the register\'s gender and level', () => {
  const t = db.createTournament({ level: 'MX-4', play_date: '2030-01-06', play_time: '10:00', courts: 2 })
  db.addSignup(t.id, { name: 'Rui', gender: '', partner: '' })
  const s = db.listSignups(t.id).find((x) => x.name === 'Rui')
  assert.equal(s.gender, 'M')
})

test('players: bulk add skips known names but fills what they lacked; rename follows the history', () => {
  assert.equal(db.addPlayersFromText('Bea | F | 3\nAna | F | 6\n\nZé'), 2)
  assert.equal(db.listPlayers().find((x) => x.name === 'Ana').grade, 6)
  const ana = db.listPlayers().find((x) => x.name === 'Ana')
  assert.deepEqual(db.updatePlayer(ana.id, { name: 'Bea' }), { taken: true })
  db.updatePlayer(ana.id, { name: 'Ana Rita' })
  assert.ok(db.listSignups(1).some((x) => x.name === 'Ana Rita'))
})
