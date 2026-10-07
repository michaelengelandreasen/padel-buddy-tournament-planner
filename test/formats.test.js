// The tournament formats, checked against the rules a club would state.
import test from 'node:test'
import assert from 'node:assert/strict'
import { advance, checkScore, cleanRules, draw, entrants, plannedRounds, standings } from '../src/formats/index.js'
import { members } from '../src/rounds.js'

const COURTS = ['1', '2', '3', '4']
const players = (n, grades = []) => Array.from({ length: n }, (_, i) => ({
  id: i + 1, name: `P${i + 1}`, gender: '', partner: '', grade: grades[i] ?? 0,
}))
const night = (format, rules = {}, extra = {}) => ({
  id: 1, format, rules: JSON.stringify(cleanRules(format, rules)), duration_min: 105, round_min: 15, ...extra,
})
// A deterministic "random", so a failing test fails the same way twice.
const seeded = (seed = 7) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
// Stored rows look like this; the engine returns teamA/teamB.
const stored = (ms) => ms.map((m, i) => ({ id: i + 1, round: m.round, court: m.court, team_a: m.teamA, team_b: m.teamB, score_a: null, score_b: null }))
const score = (rows, round, f) => rows.forEach((m) => { if (m.round === round) [m.score_a, m.score_b] = f(m) })

test('americano: eight players, two courts — everyone plays every round, partners spread out', () => {
  const tour = night('americano')
  const { teams } = entrants(tour, players(8))
  const ms = draw(tour, teams, COURTS.slice(0, 2), { random: seeded() })
  assert.equal(plannedRounds(tour), 7)
  assert.equal(new Set(ms.map((m) => m.round)).size, 7)
  const partners = new Map()
  for (const m of ms) {
    for (const s of [m.teamA, m.teamB]) {
      const [a, b] = members(s)
      partners.set(a, new Set([...(partners.get(a) || []), b]))
      partners.set(b, new Set([...(partners.get(b) || []), a]))
    }
  }
  for (const [, set] of partners) assert.ok(set.size >= 5, 'each player partners at least five different people')
  for (let r = 1; r <= 7; r++) {
    const on = ms.filter((m) => m.round === r).flatMap((m) => [...members(m.teamA), ...members(m.teamB)])
    assert.equal(new Set(on).size, 8)
  }
})

test('americano: ten players on two courts — sitting out is shared, never twice before everyone once', () => {
  const tour = night('americano')
  const { teams } = entrants(tour, players(10))
  const ms = draw(tour, teams, COURTS.slice(0, 2), { random: seeded(3) })
  const rests = new Map(teams.map((x) => [x.name, 0]))
  for (let r = 1; r <= 7; r++) {
    const on = new Set(ms.filter((m) => m.round === r).flatMap((m) => [...members(m.teamA), ...members(m.teamB)]))
    for (const n of rests.keys()) if (!on.has(n)) rests.set(n, rests.get(n) + 1)
  }
  const counts = [...rests.values()]
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1)
})

test('mexicano: round 1 by level, round 2 from the table — 1st & 4th vs 2nd & 3rd on the top court', () => {
  const tour = night('mexicano', { seeding: 'level', pattern: '14-23', points: 24 })
  const { teams } = entrants(tour, players(8, [3, 5, 1, 4, 6, 2, 7, 4]))
  const r1 = draw(tour, teams, COURTS.slice(0, 2), { random: seeded() })
  assert.equal(new Set(r1.map((m) => m.round)).size, 1)
  // The four best levels (1, 2, 3, 4) are on court 1.
  assert.deepEqual(new Set(members(r1[0].teamA).concat(members(r1[0].teamB))), new Set(['P3', 'P6', 'P1', 'P4']))
  const rows = stored(r1)
  score(rows, 1, (m) => (m.court === '1' ? [20, 4] : [13, 11]))
  const next = advance(tour, teams, rows, COURTS.slice(0, 2))
  assert.equal(next.round, 2)
  const table = standings(tour, teams, rows).map((r) => r.team)
  const top = next.matches.find((m) => m.court === '1')
  assert.deepEqual(members(top.teamA), [table[0], table[3]])
  assert.deepEqual(members(top.teamB), [table[1], table[2]])
})

test('mexicano: a corrected score redraws the next round, until that round has a score', () => {
  const tour = night('mexicano')
  const { teams } = entrants(tour, players(8))
  const rows = stored(draw(tour, teams, COURTS.slice(0, 2), { random: seeded() }))
  score(rows, 1, () => [12, 12])
  const first = advance(tour, teams, rows, COURTS.slice(0, 2))
  const r2 = stored(first.matches).map((m, i) => ({ ...m, id: 100 + i }))
  r2[0].score_a = 13; r2[0].score_b = 11
  assert.equal(advance(tour, teams, [...rows, ...r2], COURTS.slice(0, 2)), null)
})

test('up and down: winners climb, losers drop, and pairs that arrive together are split', () => {
  const tour = night('up-down', { partners: 'rotate', seeding: 'signup' })
  const { teams } = entrants(tour, players(8))
  const rows = stored(draw(tour, teams, COURTS.slice(0, 2)))
  // Court 1: P1 & P4 beat P2 & P3. Court 2: P5 & P8 lose to P6 & P7.
  score(rows, 1, (m) => (m.court === '1' ? [6, 2] : [1, 6]))
  const next = advance(tour, teams, rows, COURTS.slice(0, 2)).matches
  const on = (c) => new Set(next.filter((m) => m.court === c).flatMap((m) => [...members(m.teamA), ...members(m.teamB)]))
  assert.deepEqual(on('1'), new Set(['P1', 'P4', 'P6', 'P7']))
  assert.deepEqual(on('2'), new Set(['P2', 'P3', 'P5', 'P8']))
  const top = next.find((m) => m.court === '1')
  for (const s of [top.teamA, top.teamB]) {
    const pair = members(s)
    assert.ok(!(pair.includes('P1') && pair.includes('P4')), 'last round\'s winning pair is split')
  }
  // The ladder: court 1's winners first.
  assert.deepEqual(standings(tour, teams, rows).slice(0, 2).map((r) => r.team).sort(), ['P1', 'P4'])
})

test('up and down with fixed pairs moves whole pairs', () => {
  const tour = night('up-down', { partners: 'fixed', seeding: 'signup' })
  const signups = players(8).map((p, i) => ({ ...p, partner: `P${i % 2 ? i : i + 2}` }))
  const { teams } = entrants(tour, signups)
  assert.equal(teams.length, 4)
  const rows = stored(draw(tour, teams, COURTS.slice(0, 2)))
  score(rows, 1, (m) => (m.court === '1' ? [2, 6] : [6, 3]))
  const next = advance(tour, teams, rows, COURTS.slice(0, 2)).matches
  const top = next.find((m) => m.court === '1')
  assert.deepEqual(new Set([top.teamA, top.teamB]), new Set([rows[0].team_b, rows[1].team_a]))
})

test('rules are enforced at the score box', () => {
  assert.deepEqual(checkScore(night('americano', { points: 24 }), 13, 10), { key: 'scoreMustTotal', vars: { n: 24 } })
  assert.equal(checkScore(night('americano', { points: 24 }), 13, 11), null)
  assert.equal(checkScore(night('americano', { points: 0 }), 9, 4), null)
  assert.deepEqual(checkScore(night('up-down', { ties: 'golden' }), 5, 5), { key: 'scoreNeedsWinner', vars: {} })
  assert.equal(checkScore(night('up-down', { ties: 'stay' }), 5, 5), null)
  assert.equal(checkScore(night('non-stop'), 3, 3), null)
})

test('sitting out earns what the club says: the player\'s own average', () => {
  const tour = night('americano', { rest: 'average', points: 0 })
  const { teams } = entrants(tour, players(5))
  const rows = [
    { id: 1, round: 1, court: '1', team_a: 'P1 & P2', team_b: 'P3 & P4', score_a: 10, score_b: 6 },
    { id: 2, round: 2, court: '1', team_a: 'P1 & P5', team_b: 'P2 & P3', score_a: 8, score_b: 8 },
  ]
  const p4 = standings(tour, teams, rows).find((r) => r.team === 'P4')
  assert.equal(p4.points, 12)                       // 6 played, plus 6 for the round sat out
  const p5 = standings(tour, teams, rows).find((r) => r.team === 'P5')
  assert.equal(p5.points, 16)
})

test('unknown or broken rules fall back to the defaults', () => {
  assert.deepEqual(cleanRules('mexicano', '{"points":"x","pattern":"99","seeding":"random"}'),
    { points: 24, seeding: 'random', pattern: '14-23', rest: 'average', tiebreak: 'wins' })
})
