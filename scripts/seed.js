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
const COURTS = ['Court 1', 'Court 2', 'Court 3', 'Court 4']

/** The next given weekday, at least a week out so the sample never sits on today. */
function nextFriday(weeksAhead = 0) {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7) + weeksAhead * 7)
  return todayISO(d)
}

const MIXED = [
  ['Miguel Ferreira', 'M', 'Inês Costa'], ['Inês Costa', 'F', 'Miguel Ferreira'],
  ['João Almeida', 'M', 'Rita Sousa'], ['Rita Sousa', 'F', 'João Almeida'],
  ['Tiago Nunes', 'M', 'Beatriz Lima'], ['Beatriz Lima', 'F', 'Tiago Nunes'],
  ['André Pinto', 'M', 'Carolina Dias'], ['Carolina Dias', 'F', 'André Pinto'],
  ['Rui Marques', 'M', 'Mariana Braga'], ['Mariana Braga', 'F', 'Rui Marques'],
  // Half a team: her partner hasn't messaged the group yet, which is the case
  // the sign-up board exists to show.
  ['Sofia Ramos', 'F', 'Pedro Alves'],
]

const MENS = [
  ['Nuno Cardoso', 'M', 'Bruno Teixeira'], ['Bruno Teixeira', 'M', 'Nuno Cardoso'],
  ['Diogo Moreira', 'M', 'Filipe Rocha'], ['Filipe Rocha', 'M', 'Diogo Moreira'],
  ['Ricardo Santos', 'M', ''],
]

// Round 1 and 2 are in the books; the rest of the night hasn't happened yet.
const SCORES = [[11, 7], [9, 11], [11, 5], [8, 11], [11, 9], [11, 6]]

saveClub(CLUB)
for (const c of listCourts()) deleteCourt(c.id)
COURTS.forEach((label, i) => addCourt(label, i))

if (reset) for (const t of listTournaments()) deleteTournament(t.id)

const mixed = createTournament({
  level: 'MX-4', play_date: nextFriday(), play_time: '19:00',
  courts: 4, duration_min: 90, round_min: 12,
})
for (const [name, gender, partner] of MIXED) {
  addSignup(mixed.id, { name, gender, partner, wa_id: '' })
}

const { teams } = buildTeams(listSignups(mixed.id))
const { matches } = schedule(teams, COURTS, { durationMin: 90, roundMin: 12 })
replaceMatches(mixed.id, matches)
listMatches(mixed.id)
  .filter((m) => m.round <= 2)
  .forEach((m, i) => recordScore(m.id, ...(SCORES[i % SCORES.length])))

const mens = createTournament({
  level: 'M-3', play_date: nextFriday(1), play_time: '20:30',
  courts: 3, duration_min: 90, round_min: 12,
})
for (const [name, gender, partner] of MENS) {
  addSignup(mens.id, { name, gender, partner, wa_id: '' })
}

console.log(`Seeded ${CLUB.name}: ${COURTS.length} courts, ` +
  `MX-4 on ${mixed.play_date} (${teams.length} pairs, rounds 1–2 played), ` +
  `M-3 on ${mens.play_date} (sign-ups open).`)
