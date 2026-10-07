/**
 * Every tournament format, behind one door.
 *
 * The rest of the app asks four questions and never which format it is:
 * who the entrants are ({@link entrants}), what to put on court when the night
 * is drawn ({@link draw}), what comes next once a round is scored
 * ({@link advance}), and how the table reads ({@link standings}). A fifth,
 * {@link checkScore}, is how a club's rules are enforced at the score box.
 *
 *  - **Non-stop**: fixed pairs, every pair meets every other, ranked on points.
 *  - **Americano**: everyone plays with everyone. Partners and opponents change
 *    every round, each player keeps their own points.
 *  - **Mexicano**: like Americano, but only round 1 is drawn in advance. After
 *    that the table decides: players are grouped by rank, four to a court, so
 *    every round is closer than the last.
 *  - **Up and Down**: a ladder of courts. Winners move up a court, losers down;
 *    court 1 is the one to hold.
 *
 * A side of the net is stored as text, "Ana & Rui", in every format. In an
 * individual format the entrant is a player and a side is two of them for one
 * match; src/rounds.js reads both shapes.
 */
import { buildTeams, schedule as nonstopSchedule, standings as pairStandings } from './nonstop.js'
import { members, onSide, roundComplete, roundsOf } from '../rounds.js'
import { shuffle } from '../pairs.js'

export const FORMATS = ['non-stop', 'americano', 'mexicano', 'up-down']
export const isFormat = (f) => FORMATS.includes(f)

/**
 * What a club can decide, per format, and what it gets if it decides nothing.
 * `points` is the total a match is played to (21, 24, 32…; 0 means the round
 * is timed and any score stands).
 */
export const DEFAULT_RULES = {
  'non-stop': {},
  americano: { points: 24, rest: 'average', tiebreak: 'wins' },
  mexicano: { points: 24, seeding: 'level', pattern: '14-23', rest: 'average', tiebreak: 'wins' },
  'up-down': { points: 0, seeding: 'level', partners: 'rotate', ties: 'golden' },
}
export const RULE_CHOICES = {
  points: [0, 16, 21, 24, 32],
  seeding: ['level', 'random', 'signup'],
  pattern: ['14-23', '13-24', '12-34'],
  rest: ['average', 'half', 'none'],
  tiebreak: ['wins', 'diff'],
  partners: ['rotate', 'fixed'],
  ties: ['golden', 'stay'],
}

/** A format's rules from whatever was stored: unknown keys dropped, bad values defaulted. */
export function cleanRules(format, raw) {
  const base = DEFAULT_RULES[isFormat(format) ? format : 'non-stop']
  let given = raw
  if (typeof raw === 'string') { try { given = JSON.parse(raw || '{}') } catch { given = {} } }
  const out = {}
  for (const [k, def] of Object.entries(base)) {
    const v = given?.[k]
    if (k === 'points') {
      const n = Number.parseInt(v, 10)
      out[k] = Number.isInteger(n) && n >= 0 && n <= 99 ? n : def
    } else out[k] = RULE_CHOICES[k].includes(v) ? v : def
  }
  return out
}

/** The rules a night plays by: its own copy, taken from the club when it was created. */
export const rulesOf = (tour) => cleanRules(tour.format, tour.rules)

/** Partners change every round: entrants are players, not pairs. */
export const individual = (tour) => tour.format === 'americano' || tour.format === 'mexicano'
  || (tour.format === 'up-down' && rulesOf(tour).partners !== 'fixed')

/** Only round 1 exists in advance; each next round is drawn from the last one's scores. */
export const dynamic = (tour) => tour.format === 'mexicano' || tour.format === 'up-down'

/** How many rounds the clock allows. */
export const plannedRounds = (tour) =>
  Math.max(1, Math.floor((Number(tour.duration_min) || 90) / Math.max(1, Number(tour.round_min) || 12)))

/** Each format's entrants: pairs from the sign-ups, or every player on their own. */
export function entrants(tour, signups) {
  if (!individual(tour)) return buildTeams(signups)
  return { teams: signups.map((s) => ({ name: s.name, players: [s], mixed: false })), waiting: [] }
}

/** Fewest needed to draw: two pairs, or four players. */
export const minimum = (tour) => (individual(tour) ? 4 : 2)

// ---- helpers ----

const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`)
const bump = (map, k) => map.set(k, (map.get(k) || 0) + 1)
const side = (players) => players.join(' & ')

/** Seeding for round 1: by level (1 is strongest, unrated last), at random, or as signed up. */
function seeded(teams, how, random) {
  const list = teams.slice()
  if (how === 'signup') return list
  const mixed = shuffle(list, random)
  if (how === 'random') return mixed
  const grade = (x) => {
    const g = x.players.map((p) => Number(p.grade) || 0).filter(Boolean)
    return g.length ? g.reduce((a, b) => a + b, 0) / g.length : 99
  }
  return mixed.sort((a, b) => grade(a) - grade(b))
}

/** Four ranked players onto two sides, in the club's pattern. */
function split(four, pattern) {
  const [p1, p2, p3, p4] = four
  if (pattern === '13-24') return [[p1, p3], [p2, p4]]
  if (pattern === '12-34') return [[p1, p2], [p3, p4]]
  return [[p1, p4], [p2, p3]]
}

/** How many times each entrant has sat out in the rounds so far. */
function restCounts(names, matches) {
  const rests = new Map(names.map((n) => [n, 0]))
  for (const r of roundsOf(matches)) {
    const playing = new Set(matches.filter((m) => m.round === r).flatMap((m) => [...members(m.team_a), ...members(m.team_b), m.team_a, m.team_b]))
    for (const n of names) if (!playing.has(n)) rests.set(n, rests.get(n) + 1)
  }
  return rests
}

/**
 * Who sits this round. Whoever has sat least so far goes first — the night is
 * shared out — and among them `prefer` breaks the tie (the lowest-ranked, in
 * Mexicano; anyone, in Americano).
 */
function sitters(names, count, rests, prefer = (a, b) => 0) {
  if (count <= 0) return new Set()
  return new Set(names.slice().sort((a, b) => rests.get(a) - rests.get(b) || prefer(a, b)).slice(0, count))
}

// ---- Americano ----

/**
 * Every round drawn at once, as close to "everyone partners everyone once" as
 * the numbers allow. A perfect design exists only for some player counts, so
 * this searches instead: for each round it tries a few hundred groupings of the
 * players on court and keeps the one that repeats fewest partners (weighted
 * four times) and opponents. It works for any count, including those with
 * somebody sitting out.
 */
function americanoDraw(players, courts, rounds, random) {
  const names = players.map((p) => p.name)
  const perRound = Math.min(courts.length, Math.floor(names.length / 4))
  if (perRound < 1) return []
  const partner = new Map()
  const against = new Map()
  const rests = new Map(names.map((n) => [n, 0]))
  const matches = []
  const sitN = names.length - perRound * 4
  for (let r = 1; r <= rounds; r++) {
    const order = shuffle(names, random).sort((a, b) => rests.get(a) - rests.get(b))
    const sit = order.slice(0, sitN)
    sit.forEach((n) => rests.set(n, rests.get(n) + 1))
    const playing = order.slice(sitN)
    let best = null
    for (let tries = 0; tries < 300; tries++) {
      const pool = shuffle(playing, random)
      const games = []
      let cost = 0
      for (let g = 0; g < perRound; g++) {
        const four = pool.slice(g * 4, g * 4 + 4)
        let pick = null
        for (const pattern of RULE_CHOICES.pattern) {
          const [a, b] = split(four, pattern)
          const c = 4 * ((partner.get(key(a[0], a[1])) || 0) + (partner.get(key(b[0], b[1])) || 0))
            + a.reduce((s, x) => s + b.reduce((t, y) => t + (against.get(key(x, y)) || 0), 0), 0)
          if (!pick || c < pick.c) pick = { a, b, c }
        }
        games.push(pick)
        cost += pick.c
      }
      if (!best || cost < best.cost) best = { games, cost }
      if (cost === 0) break
    }
    best.games.forEach(({ a, b }, i) => {
      bump(partner, key(a[0], a[1])); bump(partner, key(b[0], b[1]))
      for (const x of a) for (const y of b) bump(against, key(x, y))
      matches.push({ round: r, court: courts[i], teamA: side(a), teamB: side(b) })
    })
  }
  return matches
}

// ---- Mexicano ----

/** One Mexicano round from a ranked list of players. */
function mexicanoRound(ranked, courts, round, rules, rests) {
  const perRound = Math.min(courts.length, Math.floor(ranked.length / 4))
  const rank = new Map(ranked.map((n, i) => [n, i]))
  const sit = sitters(ranked, ranked.length - perRound * 4, rests, (a, b) => rank.get(b) - rank.get(a))
  const playing = ranked.filter((n) => !sit.has(n))
  const out = []
  for (let g = 0; g < perRound; g++) {
    const [a, b] = split(playing.slice(g * 4, g * 4 + 4), rules.pattern)
    out.push({ round, court: courts[g], teamA: side(a), teamB: side(b) })
  }
  return out
}

// ---- Up and Down ----

/** Winners and losers of one game; null when it was tied and ties stay. */
function result(m) {
  if (m.score_a == null || m.score_b == null || m.score_a === m.score_b) return null
  return m.score_a > m.score_b ? { win: m.team_a, lose: m.team_b } : { win: m.team_b, lose: m.team_a }
}

/**
 * The next rung of the ladder. Court 1 keeps its winners and gains court 2's;
 * every other court gets the losers from above and the winners from below; the
 * bottom court keeps its losers — or, when people are sitting out, swaps them
 * for whoever has waited longest. With partners rotating, the two who arrive
 * together are split up, so nobody climbs the ladder on someone else's back.
 */
function upDownNext(tour, teams, matches, courts) {
  const rules = rulesOf(tour)
  const last = Math.max(...roundsOf(matches))
  const games = courts.map((c) => matches.find((m) => m.round === last && m.court === c)).filter(Boolean)
  const units = (s) => (individual(tour) ? members(s) : [s])
  const names = teams.map((x) => x.name)
  const rests = restCounts(names, matches)
  const onCourt = new Set(games.flatMap((m) => [...units(m.team_a), ...units(m.team_b)]))
  const waiting = names.filter((n) => !onCourt.has(n))
  // Per court: who goes up, who goes down. A tie (when ties stay) moves nobody.
  const moves = games.map((m) => {
    const r = result(m)
    return r ? { up: units(r.win), down: units(r.lose), stay: [] } : { up: [], down: [], stay: [...units(m.team_a), ...units(m.team_b)] }
  })
  const k = games.length
  const groups = games.map(() => [])
  moves.forEach((mv, i) => {
    groups[i].push(...mv.stay)
    groups[Math.max(0, i - 1)].push(...mv.up)
    groups[Math.min(k - 1, i + 1)].push(...mv.down)
  })
  // The bottom court: its own losers and anyone waiting share the places.
  if (waiting.length && k) {
    const bottom = groups[k - 1]
    const pool = [...waiting, ...moves[k - 1].down]
    const need = pool.length - waiting.length
    const keep = new Set(bottom.filter((n) => !moves[k - 1].down.includes(n)))
    const chosen = pool.slice().sort((a, b) => rests.get(b) - rests.get(a)).slice(0, need)
    groups[k - 1] = [...keep, ...chosen]
  }
  const round = last + 1
  return groups.map((g, i) => {
    let a; let b
    if (individual(tour)) {
      // Two arrivals per direction: split each pair across the net's two sides.
      const [p1, p2, p3, p4] = g
      ;[a, b] = [[p1, p3], [p2, p4]]
    } else {
      [a, b] = [[g[0]], [g[1]]]
    }
    return { round, court: courts[i], teamA: side(a.filter(Boolean)), teamB: side(b.filter(Boolean)) }
  }).filter((m) => m.teamA && m.teamB)
}

function upDownFirst(tour, teams, courts, random) {
  const rules = rulesOf(tour)
  const order = seeded(teams, rules.seeding, random).map((x) => x.name)
  const out = []
  if (individual(tour)) {
    const perRound = Math.min(courts.length, Math.floor(order.length / 4))
    for (let g = 0; g < perRound; g++) {
      const [a, b] = split(order.slice(g * 4, g * 4 + 4), '14-23')
      out.push({ round: 1, court: courts[g], teamA: side(a), teamB: side(b) })
    }
  } else {
    const perRound = Math.min(courts.length, Math.floor(order.length / 2))
    for (let g = 0; g < perRound; g++) out.push({ round: 1, court: courts[g], teamA: order[g * 2], teamB: order[g * 2 + 1] })
  }
  return out
}

// ---- the four questions ----

/** What goes on court when the night is drawn. Dynamic formats draw round 1 only. */
export function draw(tour, teams, courts, { random = Math.random } = {}) {
  const rounds = plannedRounds(tour)
  const rules = rulesOf(tour)
  if (tour.format === 'americano') return americanoDraw(teams.map((x) => x.players[0]), courts, rounds, random)
  if (tour.format === 'mexicano') {
    const order = seeded(teams, rules.seeding, random).map((x) => x.name)
    return mexicanoRound(order, courts, 1, rules, new Map(order.map((n) => [n, 0])))
  }
  if (tour.format === 'up-down') return upDownFirst(tour, teams, courts, random)
  return nonstopSchedule(teams, courts, { durationMin: tour.duration_min, roundMin: tour.round_min }).matches
}

/**
 * After a save: the round that should follow the last complete one, or null.
 *
 * Only dynamic formats have one to give. If it already exists and nobody has
 * scored it yet, it is drawn again — a corrected score upstream must reach the
 * pairings it decided. Once anyone has a score in it, it stays as it is.
 */
export function advance(tour, teams, matches, courts) {
  if (!dynamic(tour) || !matches.length) return null
  const rounds = roundsOf(matches)
  const done = rounds.filter((r) => roundComplete(matches, r))
  if (!done.length) return null
  const last = Math.max(...done)
  if (last >= plannedRounds(tour)) return null
  const following = matches.filter((m) => m.round === last + 1)
  if (following.some((m) => m.score_a != null || m.score_b != null)) return null
  const upTo = matches.filter((m) => m.round <= last)
  const next = tour.format === 'mexicano'
    ? mexicanoRound(standings(tour, teams, upTo).map((r) => r.team), courts, last + 1, rulesOf(tour),
      restCounts(teams.map((x) => x.name), upTo))
    : upDownNext(tour, teams, upTo, courts)
  return { round: last + 1, matches: next }
}

/**
 * The table. Pair formats keep the non-stop table. Individual formats credit a
 * side's score to both its players; a round sat out earns what the club's rule
 * says (the player's own average, half the match, or nothing), so sitting out
 * is never the reason somebody wins or loses. Up and Down ranks by the ladder:
 * the higher the court in the last scored round, the higher the place.
 */
export function standings(tour, teams, matches) {
  const rules = rulesOf(tour)
  if (!individual(tour) && tour.format !== 'up-down') return pairStandings(teams, matches)
  const units = (s) => (individual(tour) ? members(s) : [s])
  const rows = new Map(teams.map((x) => [x.name, { team: x.name, played: 0, won: 0, points: 0, against: 0, rested: 0 }]))
  const row = (n) => {
    if (!rows.has(n)) rows.set(n, { team: n, played: 0, won: 0, points: 0, against: 0, rested: 0 })
    return rows.get(n)
  }
  const scoredRounds = roundsOf(matches).filter((r) => roundComplete(matches, r))
  for (const m of matches) {
    if (m.score_a == null || m.score_b == null) continue
    for (const [mine, theirs, us, them] of [[m.team_a, m.team_b, m.score_a, m.score_b], [m.team_b, m.team_a, m.score_b, m.score_a]]) {
      for (const n of units(mine)) {
        const r = row(n)
        r.played++; r.points += us; r.against += them
        if (us > them) r.won++
        void theirs
      }
    }
  }
  for (const r of scoredRounds) {
    const playing = new Set(matches.filter((m) => m.round === r).flatMap((m) => [...units(m.team_a), ...units(m.team_b)]))
    for (const n of rows.keys()) if (!playing.has(n)) row(n).rested++
  }
  if (tour.format !== 'up-down') {
    for (const r of rows.values()) {
      if (!r.rested) continue
      if (rules.rest === 'average' && r.played) r.points += Math.round((r.points / r.played) * r.rested)
      else if (rules.rest === 'half' && rules.points) r.points += Math.round(rules.points / 2) * r.rested
    }
    const tie = rules.tiebreak === 'diff'
      ? (x, y) => (y.points - y.against) - (x.points - x.against) || y.won - x.won
      : (x, y) => y.won - x.won || (y.points - y.against) - (x.points - x.against)
    return [...rows.values()].sort((x, y) => y.points - x.points || tie(x, y) || x.team.localeCompare(y.team))
  }
  // The ladder: where each entrant stood after the last scored round.
  const last = scoredRounds.length ? Math.max(...scoredRounds) : 0
  const place = new Map()
  const courtsInOrder = [...new Set(matches.filter((m) => m.round === last).map((m) => m.court))]
  const order = matches.filter((m) => m.round === last)
    .sort((a, b) => courtsInOrder.indexOf(a.court) - courtsInOrder.indexOf(b.court))
  let pos = 0
  for (const m of order) {
    const r = result(m)
    const first = r ? r.win : m.team_a
    const second = r ? r.lose : m.team_b
    for (const n of units(first)) place.set(n, pos)
    pos++
    for (const n of units(second)) place.set(n, pos)
    pos++
  }
  return [...rows.values()].sort((x, y) => (place.get(x.team) ?? 999) - (place.get(y.team) ?? 999)
    || y.won - x.won || y.points - x.points || x.team.localeCompare(y.team))
}

/**
 * A score the club's rules allow, or the translation key saying why not.
 * Played to a total (24, 32…): the two sides must add up to it. Up and Down with
 * golden-point ties: someone has to have won.
 */
export function checkScore(tour, a, b) {
  const rules = rulesOf(tour)
  if (rules.points && (tour.format === 'americano' || tour.format === 'mexicano' || tour.format === 'up-down') && a + b !== rules.points) {
    return { key: 'scoreMustTotal', vars: { n: rules.points } }
  }
  if (tour.format === 'up-down' && rules.ties === 'golden' && a === b) return { key: 'scoreNeedsWinner', vars: {} }
  return null
}

export { onSide }
