/**
 * The parsers are the only place in this app where a human's typing becomes a
 * stored value, so they are the only place worth testing. Run with:
 *
 *   TZ=Europe/Lisbon node --test
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseLevel, levelShort, levelTight, isMixedLevel, ALL_LEVELS, categories, grades,
} from '../src/levels.js'
import {
  parseWhen, validateWhen, humanWhen, isISODate, dayName, shortDate, timeRange,
} from '../src/dates.js'
import { translator, LANGUAGES, isLanguage } from '../src/i18n.js'
import { buildTeams, capacity, slots } from '../src/formats/nonstop.js'

// A fixed Monday, so "Friday" and "next monday" have one right answer.
const now = new Date(2026, 7, 24, 14, 0)

test('levels: the spellings people actually type', () => {
  for (const input of ['MX-4', 'mx4', 'MX 4', 'mixed 4', '4 misto', '<MX-4>', ' mx - 4 ']) {
    assert.equal(parseLevel(input).code, 'MX-4', input)
  }
  assert.equal(parseLevel('ladies 2').code, 'F-2')
  assert.equal(parseLevel('men 6').code, 'M-6')
  assert.equal(parseLevel('F5').code, 'F-5')
})

test('levels: MX is never read as a mens level', () => {
  assert.equal(parseLevel('MX-3').category, 'MX')
  assert.equal(parseLevel('M-3').category, 'M')
  assert.equal(isMixedLevel('MX-3'), true)
  assert.equal(isMixedLevel('M-3'), false)
})

test('levels: everything invalid is refused, with a reason', () => {
  for (const input of ['', 'banana', 'MX', '4', 'M-9', 'MX-0']) {
    const r = parseLevel(input)
    assert.equal(r.ok, false, input)
    assert.ok(r.error.length > 10, input)
  }
})

test('levels: every generated code round-trips', () => {
  assert.equal(ALL_LEVELS.length, 21)
  for (const code of ALL_LEVELS) assert.equal(parseLevel(code).code, code)
  assert.equal(levelShort('MX-4'), 'Mixed 4')
})

test('dates: written forms, day-first like Portugal', () => {
  const same = (input, date, time = '') => {
    const r = parseWhen(input, { now })
    assert.deepEqual([r.ok, r.date, r.time], [true, date, time], input)
  }
  same('2026-09-05', '2026-09-05')
  same('05/09/2026', '2026-09-05')
  same('5/9', '2026-09-05')
  same('5 Sep', '2026-09-05')
  same('Sep 5', '2026-09-05')
  same('5 setembro', '2026-09-05')
  same('Friday 5 Sep, 19:00', '2026-09-05', '19:00')
  same('5 Sep 7pm', '2026-09-05', '19:00')
  same('5 September 2026 19h30', '2026-09-05', '19:30')
})

test('dates: weekdays resolve forward, in both languages', () => {
  assert.equal(parseWhen('Friday', { now }).date, '2026-08-28')
  assert.equal(parseWhen('sexta', { now }).date, '2026-08-28')
  assert.equal(parseWhen('sábado', { now }).date, '2026-08-29')
  assert.equal(parseWhen('today', { now }).date, '2026-08-24')
  assert.equal(parseWhen('tomorrow', { now }).date, '2026-08-25')
  // Said on a Monday: "monday" is tonight, "next monday" is the week after.
  assert.equal(parseWhen('monday', { now }).date, '2026-08-24')
  assert.equal(parseWhen('next monday', { now }).date, '2026-08-31')
})

test('dates: an unread date is an error, never a guess', () => {
  for (const input of ['banana', '2026-02-30', '12/13', 'sometime soon']) {
    assert.equal(parseWhen(input, { now }).ok, false, input)
  }
  // Absent is not invalid — the bot lets a host open a board with the date TBC.
  assert.deepEqual(parseWhen('', { now }), { ok: true, date: '', time: '' })
})

test('dates: a month with no year lands ahead of today, not behind', () => {
  assert.equal(parseWhen('5 Sep', { now }).date, '2026-09-05')   // still to come
  assert.equal(parseWhen('12 mar', { now }).date, '2027-03-12')  // already gone this year
})

test('dates: validation refuses the past and obvious typos', () => {
  assert.equal(validateWhen({ date: '2026-08-24' }, { now }).ok, true)
  assert.equal(validateWhen({ date: '2020-01-01' }, { now }).ok, false)
  assert.equal(validateWhen({ date: '2062-09-05' }, { now }).ok, false)
  assert.equal(validateWhen({ date: '2026-09-05', time: '25:00' }, { now }).ok, false)
  assert.equal(validateWhen({ date: '2026-09-05', time: '19:00' }, { now }).ok, true)
})

test('dates: what the club reads', () => {
  assert.equal(humanWhen({ play_date: '2026-09-05', play_time: '19:00' }, { now }),
    'Saturday 5 September, 19:00')
  assert.equal(humanWhen({ play_date: '2027-01-08' }, { now }), 'Friday 8 January 2027')
  assert.equal(humanWhen({ play_date: '' }, { now }), 'Date TBC')
  assert.equal(isISODate('2026-02-30'), false)
})

// ---------------------------------------------------------------------------
// The sign-up board and the language layer.
// ---------------------------------------------------------------------------
const SIGNUPS = [
  { id: 1, name: 'Mike', gender: 'M', partner: '' },
  { id: 2, name: 'Paula Quevedo', gender: 'F', partner: 'Luís Miranda' },
  { id: 3, name: 'Luís Miranda', gender: 'M', partner: 'Paula Quevedo' },
  { id: 4, name: 'Adriana Osório', gender: 'F', partner: 'Manuel Lima' },
  { id: 5, name: 'Manuel Lima', gender: 'M', partner: 'Adriana Osório' },
]

test('board: four slots a court, alternating for a mixed level', () => {
  assert.equal(capacity(3), 12)
  const { teams, waiting } = buildTeams(SIGNUPS)
  const { board, reserves, size, taken } = slots(teams, waiting, { courts: 3, category: 'MX' })
  assert.equal(size, 12)
  assert.equal(taken, 5)
  assert.equal(reserves.length, 0)
  assert.deepEqual(board.slice(0, 4).map((s) => s.want), ['F', 'M', 'F', 'M'])
  // Pairs are seated first, woman first so she lands in the slot that wants her.
  assert.deepEqual(board.slice(0, 4).map((s) => s.player.name),
    ['Paula Quevedo', 'Luís Miranda', 'Adriana Osório', 'Manuel Lima'])
  // The partnerless player takes the next free slot his gender fits, not simply
  // the next free slot — that would put a man on a woman's line.
  assert.equal(board[5].player.name, 'Mike')
  assert.equal(board[4].player, null)
})

test('board: a single-gender level does not alternate', () => {
  const men = [
    { id: 1, name: 'A', gender: 'M', partner: 'B' }, { id: 2, name: 'B', gender: 'M', partner: 'A' },
  ]
  const { teams, waiting } = buildTeams(men)
  const { board } = slots(teams, waiting, { courts: 2, category: 'M' })
  assert.equal(board.length, 8)
  assert.ok(board.every((s) => s.want === 'M'))
})

test('board: anyone past capacity becomes a reserve, never silently dropped', () => {
  const many = Array.from({ length: 6 }, (_, i) => ({
    id: i + 1, name: `P${i}`, gender: i % 2 ? 'M' : 'F', partner: '',
  }))
  const { teams, waiting } = buildTeams(many)
  const { taken, reserves, size } = slots(teams, waiting, { courts: 1, category: 'MX' })
  assert.equal(size, 4)
  assert.equal(taken, 4)
  assert.equal(reserves.length, 2)
})

test('board: the header lines are generated from the settings', () => {
  assert.equal(dayName('2026-08-29', { lang: 'en' }), 'Saturday')
  assert.equal(dayName('2026-08-29', { lang: 'pt' }), 'Sábado')
  assert.equal(shortDate('2026-08-29'), '29/08/2026')
  // Start plus duration, on the clock each language actually reads.
  assert.equal(timeRange('11:00', 120, { lang: 'en' }), '11AM-1PM')
  assert.equal(timeRange('11:00', 120, { lang: 'pt' }), '11h-13h')
  assert.equal(timeRange('11:30', 120, { lang: 'pt' }), '11h30-13h30')
  assert.equal(timeRange('20:30', 90, { lang: 'pt' }), '20h30-22h')
  assert.equal(timeRange('', 90, { lang: 'en' }), '')
  assert.equal(levelTight('MX-4'), 'MX4')
})

test('i18n: the two languages are genuinely different, not silent fallbacks', () => {
  const en = translator('en'), pt = translator('pt')
  assert.equal(en('whosIn'), "Who's in?")
  assert.equal(pt('whosIn'), 'Quem alinha?')
  assert.ok(pt('dropoutDefault').startsWith('Depois'))
  assert.equal(levelShort('MX-4', pt), 'Misto 4')
  assert.equal(categories(pt)[0].label, 'Misto')
  assert.equal(grades(pt)[3].label, 'Intermédio alto')
})

test('i18n: an unknown language falls back rather than blanking the page', () => {
  assert.equal(isLanguage('de'), false)
  assert.equal(LANGUAGES.length, 2)
  const t = translator('de')
  assert.equal(t.lang, 'en')
  assert.equal(t('whosIn'), "Who's in?")
})

test('i18n: a missing key shows itself instead of rendering empty', () => {
  assert.equal(translator('pt')('no_such_key_at_all'), 'no_such_key_at_all')
})

test('board: a level mismatch is shown, not smoothed over', () => {
  // A woman signing into a men's level still gets a place — but the board has
  // to render her, not the slot's expectation, or the host never sees it.
  const men = [
    { id: 1, name: 'A', gender: 'M', partner: 'B' }, { id: 2, name: 'B', gender: 'M', partner: 'A' },
    { id: 3, name: 'Sofia', gender: 'F', partner: '' },
  ]
  const { teams, waiting } = buildTeams(men)
  const { board, reserves } = slots(teams, waiting, { courts: 1, category: 'M' })
  assert.equal(reserves.length, 0)
  const sofia = board.find((s) => s.player?.name === 'Sofia')
  assert.ok(sofia, 'she is on the board')
  assert.equal(sofia.want, 'M')
  assert.equal(sofia.player.gender, 'F')
})

// ---- the night: where do I go next ----
import {
  courtsByTeam, currentRound, roundComplete, roundPlan, roundWindow, teamsNamed,
} from '../src/rounds.js'
import { normalizeCommand, toHtml } from '../src/messaging/markup.js'

const NIGHT = { play_time: '11:00', round_min: 12 }
const TEAMS = ['Ana & Rui', 'Bea & Zé', 'Cátia & Tó'].map((name) => ({ name }))
const MATCHES = [
  { round: 1, court: 'Court 2', team_a: 'Ana & Rui', team_b: 'Bea & Zé', score_a: 11, score_b: 7 },
  { round: 2, court: 'Court 1', team_a: 'Cátia & Tó', team_b: 'Ana & Rui', score_a: null, score_b: null },
  { round: 3, court: 'Court 1', team_a: 'Bea & Zé', team_b: 'Cátia & Tó', score_a: null, score_b: null },
]

test('rounds: the current round is the first one still missing a score', () => {
  assert.equal(currentRound(MATCHES), 2)
  assert.equal(currentRound(MATCHES.map((m) => ({ ...m, score_a: 1, score_b: 0 }))), 3)
  assert.equal(currentRound([]), 0)
  assert.equal(roundComplete(MATCHES, 1), true)
  assert.equal(roundComplete(MATCHES, 2), false)
  assert.equal(roundComplete(MATCHES, 9), false)
})

test('rounds: a round runs from start plus (n-1) lengths, and wraps midnight', () => {
  assert.deepEqual(roundWindow(NIGHT, 1), { start: '11:00', end: '11:12' })
  assert.deepEqual(roundWindow(NIGHT, 3), { start: '11:24', end: '11:36' })
  assert.deepEqual(roundWindow({ play_time: '23:50', round_min: 15 }, 1), { start: '23:50', end: '00:05' })
  assert.deepEqual(roundWindow({ play_time: '', round_min: 12 }, 1), { start: '', end: '' })
})

test('rounds: a plan names who is resting, not just who is playing', () => {
  const plan = roundPlan({ tournament: NIGHT, matches: MATCHES, teams: TEAMS, round: 2 })
  assert.deepEqual(plan.games.map((g) => g.court), ['Court 1'])
  assert.deepEqual(plan.resting, ['Bea & Zé'])
  assert.deepEqual(plan.rounds, [1, 2, 3])
  const next = courtsByTeam(MATCHES, 3)
  assert.equal(next.get('Bea & Zé'), 'Court 1')
  assert.equal(next.get('Ana & Rui'), undefined)
})

test('rounds: a first name finds its pair, accents and case aside; two pairs stay two', () => {
  assert.deepEqual(teamsNamed(TEAMS, 'catia').map((x) => x.name), ['Cátia & Tó'])
  assert.deepEqual(teamsNamed(TEAMS, 'ZÉ').map((x) => x.name), ['Bea & Zé'])
  assert.deepEqual(teamsNamed(TEAMS, 'nobody'), [])
  const twoAnas = [...TEAMS, { name: 'Ana Rita & Vasco' }]
  assert.equal(teamsNamed(twoAnas, 'ana').length, 2)
  assert.equal(teamsNamed(twoAnas, 'rita').length, 1)
})

test('telegram: chat markup becomes HTML that a name cannot break', () => {
  assert.equal(toHtml('*Court 1*\nAna_Rita & Rui <3'), '<b>Court 1</b>\nAna_Rita &amp; Rui &lt;3')
  assert.equal(toHtml('Sign up: `!in Mike M partner Sofia`'), 'Sign up: <code>!in Mike M partner Sofia</code>')
  assert.equal(toHtml('_note_ and a * on its own'), '<i>note</i> and a * on its own')
})

test('telegram: slash commands, with or without the bot name, are the club syntax', () => {
  assert.equal(normalizeCommand('/where mike', 'padelbot'), '!where mike')
  assert.equal(normalizeCommand('/list@padelbot', 'padelbot'), '!list')
  assert.equal(normalizeCommand('/list@otherbot', 'padelbot'), '')
  assert.equal(normalizeCommand('/start', 'padelbot'), '!help')
  assert.equal(normalizeCommand('!in Ana F', 'padelbot'), '!in Ana F')
  assert.equal(normalizeCommand('hello', 'padelbot'), 'hello')
})

// ---- importing the club's own message ----
import { readFileSync } from 'node:fs'
import { parseBoard, tidyName } from '../src/import.js'

const MAIA = readFileSync(new URL('./fixtures/maia.txt', import.meta.url), 'utf8')
const NOW = new Date('2026-09-12T10:00:00')

test('import: the club message yields date, window, level, venue and roster', () => {
  const r = parseBoard(MAIA, { now: NOW })
  assert.equal(r.date, '2026-09-13')
  assert.equal(r.time, '09:30')
  assert.equal(r.duration_min, 120)
  assert.equal(r.end, '11:30')
  assert.equal(r.levelRaw, 'M-9')
  assert.equal(r.level, '')                       // not on the ladder: left for the host
  assert.equal(r.location, 'Maia')
  assert.equal(r.players.length, 16)
  assert.equal(r.courts, 4)
})

test('import: names are tidied and "(dupla)" pairs a line with the one above', () => {
  const r = parseBoard(MAIA, { now: NOW })
  const by = Object.fromEntries(r.players.map((p) => [p.n, p]))
  assert.equal(by[8].name, 'Pedro')
  assert.equal(by[9].name, 'Rafa Campos')
  assert.equal(by[14].name, 'Tiago Delgado')
  assert.equal(by[14].partner, 'Pedro Delgado')
  assert.equal(by[13].partner, 'Tiago Delgado')
  assert.equal(by[15].partner, '')
  assert.equal(tidyName('maria de sousa'), 'Maria de sousa'.replace('sousa', 'Sousa'))
  assert.equal(tidyName('McDonald'), 'McDonald')
})

test('import: a readable level is accepted, a missing roster is said out loud', () => {
  const r = parseBoard('📅 20/09/26\n⏱ 19h00 - 20h30\nMX4 - Padel Tribe\n1🎾 Ana\n2🎾 Rui', { now: NOW })
  assert.equal(r.level, 'MX-4')
  assert.equal(r.location, 'Padel Tribe')
  assert.equal(r.duration_min, 90)
  assert.equal(r.courts, 1)
  const empty = parseBoard('hello', { now: NOW })
  assert.equal(empty.players.length, 0)
  assert.ok(empty.warnings.some((w) => /numbered players/.test(w)))
  assert.ok(empty.warnings.some((w) => /No date/.test(w)))
})
