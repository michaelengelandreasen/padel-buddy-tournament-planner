/**
 * The parsers are the only place in this app where a human's typing becomes a
 * stored value, so they are the only place worth testing. Run with:
 *
 *   TZ=Europe/Lisbon node --test
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseLevel, levelShort, isMixedLevel, ALL_LEVELS } from '../src/levels.js'
import { parseWhen, validateWhen, humanWhen, isISODate } from '../src/dates.js'

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
