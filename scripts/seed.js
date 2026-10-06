/**
 * Sample data: Padel Tribe, Matosinhos.
 *
 * A real club with a real address, so the WhatsApp message that comes out has a
 * map link somebody could actually follow. Court names are the club's own
 * numbering as far as anyone here knows — rename them in Settings.
 *
 *   node scripts/seed.js          # club, courts, two tournaments
 *   node scripts/seed.js --reset  # …after deleting the tournaments already there
 *
 * Dates are computed from today, so the sample never seeds a night that has
 * already been played and the date picker always has something live to show.
 */
import {
  addCourt, addSignup, createTournament, deleteCourt, deleteTournament, listCourts,
  listTournaments, listSignups, recordScore, replaceMatches, saveClub, listMatches,
} from '../src/db.js'
import { buildTeams, schedule } from '../src/formats/nonstop.js'
import { todayISO } from '../src/dates.js'

const reset = process.argv.includes('--reset')

const CLUB = {
  name: 'Padel Tribe',
  address: 'R. Gonçalves Zarco 1813, 4450-685 Matosinhos, Portugal',
  maps_url: 'https://maps.app.goo.gl/PC4yvKz3BES4Xuh66',
}
// The club has four; a given night books as many as it needs.
const COURTS = ['1', '2', '3', '4']

/** The next given weekday. Never today, so the sample is always still to come. */
function next(weekday, weeksAhead = 0) {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7 || 7) + weeksAhead * 7)
  return todayISO(d)
}
const SATURDAY = 6, FRIDAY = 5

// A Saturday group: five mixed pairs in, and Nico still looking
// for a partner — which is exactly the state an empty slot next to his name says.
//
// Five pairs on three courts is the shape worth sampling: two courts busy, one
// pair resting, and one slot on the board still open. A three-pair night draws a
// single match and makes the round message look like it has nothing to say.
const MIXED = [
  ['Nico', 'M', ''],
  ['Laura Quintas', 'F', 'Hélio Varela'], ['Hélio Varela', 'M', 'Laura Quintas'],
  ['Daniela Seabra', 'F', 'Jaime Costa'], ['Jaime Costa', 'M', 'Daniela Seabra'],
  ['Lúcia Abreu', 'F', 'Rodrigo Barreira'], ['Rodrigo Barreira', 'M', 'Lúcia Abreu'],
  ['Vera Sales', 'F', 'Simão Brito'], ['Simão Brito', 'M', 'Vera Sales'],
  ['Raquel Dantas', 'F', 'Fausto Correia'], ['Fausto Correia', 'M', 'Raquel Dantas'],
]

const MENS = [
  ['Renato Calado', 'M', 'Alberto Teles'], ['Alberto Teles', 'M', 'Renato Calado'],
  ['Mauro Pestana', 'M', 'Xavier Viana'], ['Xavier Viana', 'M', 'Mauro Pestana'],
  ['Lauro Simões', 'M', ''],
]

// Round 1 is in the books; the rest of the morning hasn't happened yet.
const SCORES = [[11, 7], [9, 11], [11, 5], [8, 11], [11, 9], [11, 6]]

saveClub(CLUB)
for (const c of listCourts()) deleteCourt(c.id)
COURTS.forEach((label, i) => addCourt(label, i))

if (reset) for (const t of listTournaments()) deleteTournament(t.id)

const mixed = createTournament({
  level: 'MX-4', play_date: next(SATURDAY), play_time: '11:00',
  courts: 3, duration_min: 120, round_min: 12,
})
for (const [name, gender, partner] of MIXED) {
  addSignup(mixed.id, { name, gender, partner, wa_id: '' })
}

const { teams } = buildTeams(listSignups(mixed.id))
const { matches } = schedule(teams, COURTS.slice(0, 3), { durationMin: 120, roundMin: 12 })
replaceMatches(mixed.id, matches)
listMatches(mixed.id)
  .filter((m) => m.round === 1)
  .forEach((m, i) => recordScore(m.id, ...(SCORES[i % SCORES.length])))

const mens = createTournament({
  level: 'M-3', play_date: next(FRIDAY, 1), play_time: '20:30',
  courts: 2, duration_min: 90, round_min: 12,
})
for (const [name, gender, partner] of MENS) {
  addSignup(mens.id, { name, gender, partner, wa_id: '' })
}

console.log(`Seeded ${CLUB.name}: ${COURTS.length} courts, ` +
  `MX-4 on ${mixed.play_date} 11:00 (${teams.length} pairs + 1 looking, round 1 played), ` +
  `M-3 on ${mens.play_date} (sign-ups open).`)
