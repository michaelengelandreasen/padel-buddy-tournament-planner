/**
 * Which court a pair is on, this round and the next one.
 *
 * The club runs its nights off a printed sheet and a PDF in the group chat, so
 * the question every player asks between rounds — "where do I go now?" — is
 * answered by walking to the wall and squinting. Everything here exists to make
 * that question answerable from a phone in the two seconds between points.
 *
 * It reads stored matches rather than the draw, because the draw is a plan and
 * the matches are what happened: a court renamed, a match rescheduled or a score
 * typed in all change the answer, and only the rows know about them.
 */

import { addMinutes } from './dates.js'

/** The rounds that actually exist, in order. Byes mean a round can be sparse. */
export const roundsOf = (matches) =>
  [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b)

/**
 * The round being played right now: the first one still missing a score.
 *
 * Scores are how this system learns time has passed — nobody is going to press
 * "next round" on a phone while holding a racket. A fully scored tournament
 * stays pointing at its last round rather than falling off the end, so the
 * closing message still has something to say.
 */
export function currentRound(matches) {
  const rounds = roundsOf(matches)
  const open = rounds.find((r) => matches.some(
    (m) => m.round === r && (m.score_a == null || m.score_b == null)))
  return open ?? rounds[rounds.length - 1] ?? 0
}

/**
 * When a round runs, on the clock on the wall.
 *
 * Rounds are back to back by definition of the format — everyone starts and
 * stops together on one whistle — so round N starts at the tournament's start
 * plus N-1 round lengths. A tournament with no start time gets blanks, and the
 * message drops the line rather than inventing an hour.
 */
export function roundWindow({ play_time, round_min }, round) {
  const len = Number(round_min) || 0
  return {
    start: addMinutes(play_time, (round - 1) * len),
    end: addMinutes(play_time, round * len),
  }
}

/** Courts in the order the club posts them, not the order SQLite returns them. */
const byCourt = (a, b) => String(a.court).localeCompare(String(b.court), undefined, { numeric: true })

/**
 * One round, whole: who is on which court, and who is sitting it out.
 *
 * Resting pairs are named, not omitted. An odd number of pairs means somebody
 * rests every round, and a pair that can see it is resting goes and gets a drink
 * instead of standing on a court that already has four people on it.
 */
export function roundPlan({ tournament, matches, teams, round }) {
  const games = matches.filter((m) => m.round === round).sort(byCourt)
  const playing = new Set(games.flatMap((m) => [m.team_a, m.team_b]))
  return {
    round,
    rounds: roundsOf(matches),
    ...roundWindow(tournament, round),
    games,
    resting: teams.map((x) => x.name).filter((n) => !playing.has(n)),
  }
}

/**
 * Pair name → court for one round: the "where do I go next" lookup itself.
 *
 * A Map rather than a search, because the next-round block prints one line per
 * pair and doing it by scanning the matches once per pair is quadratic in the
 * one place a phone renders it.
 */
export function courtsByTeam(matches, round) {
  const map = new Map()
  for (const m of matches) {
    if (m.round !== round) continue
    map.set(m.team_a, m.court)
    map.set(m.team_b, m.court)
  }
  return map
}

/**
 * The pairs a person belongs to, matched the way somebody types their own name
 * into a group chat: no accents, no case, first name is enough.
 *
 * Returns every match rather than the first, because two people called Maria is
 * a real Saturday and picking one of them silently is worse than saying so.
 */
export function teamsNamed(teams, query) {
  const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim()
  const q = norm(query)
  if (!q) return []
  const words = (name) => norm(name).split(/[^a-z0-9]+/).filter(Boolean)
  const hits = teams.filter((x) => words(x.name).some((w) => w === q))
  // Only fall back to "starts with" when nothing matched a whole name, so
  // "Ana" never quietly means "Ana Rita" while a plain Ana is standing there.
  return hits.length ? hits : teams.filter((x) => words(x.name).some((w) => w.startsWith(q)))
}

/** Where one pair is in a round: their match and their court, or null if resting. */
export function findGame(matches, round, team) {
  return matches.find((m) => m.round === round && (m.team_a === team || m.team_b === team)) || null
}

/** The pair on the other side of the net. */
export const opponentIn = (game, team) => (game ? (game.team_a === team ? game.team_b : game.team_a) : '')

/** Every match in a round has both scores — the signal that the round is over. */
export const roundComplete = (matches, round) => {
  const games = matches.filter((m) => m.round === round)
  return games.length > 0 && games.every((m) => m.score_a != null && m.score_b != null)
}

/**
 * A court label as people read it. Courts are stored as what the club calls
 * them — "1", "2", "Center" — and only a bare number gets the word put back:
 * "Court 1" in a message, "1" in the box you rename it in.
 */
export const courtName = (label, t, { always = false } = {}) => {
  const l = String(label ?? '').trim()
  if (/^\d+$/.test(l)) return t('courtN', { n: l })
  // In a group message every court is written out — "Court Center" — so the
  // line reads as a place even to someone who has never seen the club's names.
  // Unless the name already carries the word, in either language.
  if (always && !/^(court|campo)\b/i.test(l)) return t('courtN', { n: l })
  return l
}
