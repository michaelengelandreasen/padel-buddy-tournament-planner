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
