/**
 * Demo data: a fictional club and fictional players.
 *
 * Used for the organizer deck, the public demo, and every sandbox a visitor
 * starts — so nothing shown to a stranger ever comes from a real club. Builds
 * into whichever database is current: two clubs, sixteen invented players with
 * levels that have moved over the season, today's mixed tournament half played,
 * and three more on the calendar.
 */
import {
  addCourt, addSignup, addVenue, createTournament, db, listMatches, listSignups, listVenues,
  recordScore, replaceMatches, saveClub, setActiveTournament, setPlayerLevel, ensurePlayer,
} from './db.js'
import { buildTeams, schedule } from './formats/nonstop.js'
import { todayISO } from './dates.js'

export function seedDemo({ clubName = 'Demo Padel Club' } = {}) {
  saveClub({ name: clubName, address: 'Av. da Praia 120, Matosinhos', maps_url: 'https://maps.google.com/?q=Matosinhos', language: 'en' })
  for (const v of listVenues()) db.prepare('DELETE FROM venues WHERE id = ?').run(v.id)
  addVenue({ name: clubName, address: 'Av. da Praia 120, Matosinhos', maps_url: 'https://maps.google.com/?q=Matosinhos' })
  addVenue({ name: 'Riverside Padel', address: 'Rua do Rio 8, Porto', maps_url: 'https://maps.google.com/?q=Porto' })
  saveClub({ home_venue_id: listVenues()[0].id })
  db.exec('DELETE FROM courts')
  ;['1', '2', '3', 'Center'].forEach((c, i) => addCourt(c, i))

  // Invented names. [name, gender, partner, level history oldest → newest]
  const ROSTER = [
    ['Inês Carvalho', 'F', 'Tomás Ribeiro', [5, 4]], ['Tomás Ribeiro', 'M', 'Inês Carvalho', [4]],
    ['Beatriz Lopes', 'F', 'Duarte Pinho', [6, 5, 4]], ['Duarte Pinho', 'M', 'Beatriz Lopes', [5]],
    ['Leonor Matos', 'F', 'Gonçalo Faria', [4]], ['Gonçalo Faria', 'M', 'Leonor Matos', [3, 4]],
    ['Mariana Couto', 'F', 'Rafael Sousa', [5]], ['Rafael Sousa', 'M', 'Mariana Couto', [5, 4]],
    ['Carolina Neves', 'F', 'Martim Alves', [4]], ['Martim Alves', 'M', 'Carolina Neves', [4]],
    ['Sofia Teixeira', 'F', 'Diogo Mendes', [5]], ['Diogo Mendes', 'M', 'Sofia Teixeira', [6, 5]],
    ['Matilde Rocha', 'F', 'André Gomes', [4]], ['André Gomes', 'M', 'Matilde Rocha', [4, 3, 4]],
    ['Clara Pires', 'F', 'Hugo Barros', [5]], ['Hugo Barros', 'M', 'Clara Pires', [5]],
  ]
  const NOTES = ['first night with the group', 'won three nights running', 'steady all season', 'back after a knee injury']

  const at = (daysAgo) => {
    const d = new Date(); d.setDate(d.getDate() - daysAgo)
    return d.toISOString().slice(0, 19).replace('T', ' ')
  }
  const next = (weekday, weeks = 0) => {
    const d = new Date(); d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7) + weeks * 7)
    return todayISO(d)
  }

  // Tonight: started an hour ago, so the TV and !where show a round in progress.
  const now = new Date(); now.setMinutes(0); now.setHours(now.getHours() - 1)
  const startTime = `${String(now.getHours()).padStart(2, '0')}:00`
  const tonight = createTournament({
    level: 'MX-4', play_date: todayISO(), play_time: startTime, courts: 4, duration_min: 120, round_min: 15,
  })
  for (const [name, gender, partner, levels] of ROSTER) {
    const p = ensurePlayer(name, gender)
    levels.forEach((g, i) => {
      setPlayerLevel(p.id, g, i === levels.length - 1 && i > 0 ? NOTES[(p.id + i) % NOTES.length] : (i === 0 ? 'first rating' : ''))
    })
    // Spread the history across the season so the player pages read as a story.
    const rows = db.prepare('SELECT id FROM player_levels WHERE player_id = ? ORDER BY id').all(p.id)
    rows.forEach((r, i) => db.prepare('UPDATE player_levels SET at = ? WHERE id = ?').run(at(150 - i * 55 - (p.id % 9)), r.id))
    addSignup(tonight.id, { name, gender, partner, wa_id: '' })
  }
  const { teams } = buildTeams(listSignups(tonight.id))
  const { matches } = schedule(teams, ['1', '2', '3', 'Center'], { durationMin: 120, roundMin: 15 })
  replaceMatches(tonight.id, matches)
  const SCORES = [[11, 7], [9, 11], [12, 10], [11, 6], [8, 11], [11, 9], [10, 12], [11, 8], [11, 5], [7, 11], [12, 10], [9, 11]]
  listMatches(tonight.id).filter((m) => m.round <= 3).forEach((m, i) => recordScore(m.id, ...SCORES[i % SCORES.length]))
  listMatches(tonight.id).filter((m) => m.round === 4).slice(0, 2).forEach((m, i) => recordScore(m.id, ...SCORES[(i + 5) % SCORES.length]))
  setActiveTournament(tonight.id)

  // Two nights coming up: one open for sign-ups, one away at the second club.
  const friday = createTournament({ level: 'M-3', play_date: next(5, 1), play_time: '20:30', courts: 2, duration_min: 90, round_min: 12 })
  for (const [name, partner] of [['Tomás Ribeiro', 'Gonçalo Faria'], ['Gonçalo Faria', 'Tomás Ribeiro'], ['Rafael Sousa', 'André Gomes'], ['André Gomes', 'Rafael Sousa'], ['Hugo Barros', '']]) {
    addSignup(friday.id, { name, gender: 'M', partner, wa_id: '' })
  }
  createTournament({ level: 'F-4', play_date: next(0, 1), play_time: '10:00', courts: 3, duration_min: 120, round_min: 15, venue: 'Riverside Padel' })

  // A Mexicano night, signed up and ready to draw: partners change every round and
  // each round after the first comes from the table.
  const mexicano = createTournament({ format: 'mexicano', level: 'MX-4', play_date: next(3, 1), play_time: '19:00', courts: 3, duration_min: 90, round_min: 15 })
  for (const [name, gender] of ROSTER.slice(0, 12)) addSignup(mexicano.id, { name, gender, partner: '', wa_id: '' })

  return { tonight: tonight.id, startTime, pairs: teams.length, matches: listMatches(tonight.id).length }
}
