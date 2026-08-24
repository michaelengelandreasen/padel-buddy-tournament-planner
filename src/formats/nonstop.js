/**
 * Non-stop smash: fixed pairs, timed rounds, everyone plays at once.
 *
 * **This is an assumption, and it is the one worth checking first.** Nobody
 * confirmed the format, so it is inferred from the sign-up syntax: `!in` names a
 * partner, so pairs are fixed for the night. From there the format is the one
 * padel clubs actually run under that name — every court starts and stops
 * together on a short timer, pairs rotate to a new opponent each round, and the
 * ranking is total points scored, not matches won.
 *
 * Everything format-specific lives behind {@link schedule} and {@link standings}.
 * If the club plays an Americano (partners rotate) or a king-of-the-court ladder
 * instead, that is a sibling file and a different `format` value on the
 * tournament row — no other part of the system needs to know.
 */

/**
 * Pair up the sign-ups.
 *
 * Two people who name each other are a pair. Someone who names a partner who
 * hasn't signed up yet is held, not dropped — they are half a team and the
 * message says so, because "you're not in" is the wrong answer to "my partner
 * hasn't messaged yet".
 */
export function buildTeams(signups) {
  const byName = new Map(signups.map((s) => [s.name.toLowerCase(), s]))
  const used = new Set()
  const teams = []
  const waiting = []

  for (const s of signups) {
    if (used.has(s.id)) continue
    const partner = s.partner ? byName.get(s.partner.toLowerCase()) : null
    if (partner && !used.has(partner.id) && partner.id !== s.id) {
      used.add(s.id); used.add(partner.id)
      teams.push({
        name: `${s.name} & ${partner.name}`,
        players: [s, partner],
        // A pair with one of each is what an MX level needs; the host sees it
        // rather than counting names.
        mixed: s.gender && partner.gender && s.gender !== partner.gender,
      })
    } else {
      used.add(s.id)
      waiting.push(s)
    }
  }
  return { teams, waiting }
}

/**
 * Round-robin over pairs, laid onto the courts available.
 *
 * The classic circle method: fix one team, rotate the rest. With an odd number
 * of teams one sits out each round, which is a real outcome the schedule should
 * name rather than hide — a pair that knows it is resting round 3 can get a
 * drink instead of standing on a court waiting.
 *
 * Rounds are capped by the clock: a 90-minute tournament of 12-minute rounds is
 * seven rounds, however many the round-robin would otherwise want.
 */
export function schedule(teams, courts, { durationMin = 90, roundMin = 12 } = {}) {
  if (teams.length < 2) return { matches: [], rounds: 0, byes: [] }

  const names = teams.map((t) => t.name)
  if (names.length % 2 === 1) names.push(null)          // the bye slot

  const perRound = Math.max(1, courts.length)
  const maxRounds = Math.max(1, Math.floor(durationMin / Math.max(1, roundMin)))
  const fullRounds = names.length - 1
  const rounds = Math.min(fullRounds, maxRounds)

  const matches = []
  const byes = []
  const rota = names.slice()

  for (let r = 1; r <= rounds; r++) {
    const half = rota.length / 2
    const pairings = []
    for (let i = 0; i < half; i++) {
      const a = rota[i]
      const b = rota[rota.length - 1 - i]
      if (a === null || b === null) { byes.push({ round: r, team: a ?? b }); continue }
      pairings.push([a, b])
    }
    // More pairings than courts means the extra pairs wait; they are recorded as
    // byes for this round so the schedule stays honest about who is playing.
    pairings.slice(perRound).forEach(([a, b]) => {
      byes.push({ round: r, team: a }); byes.push({ round: r, team: b })
    })
    pairings.slice(0, perRound).forEach(([a, b], i) => {
      matches.push({ round: r, court: courts[i], teamA: a, teamB: b })
    })
    // Rotate everything except the first entry.
    rota.splice(1, 0, rota.pop())
  }
  return { matches, rounds, byes }
}

/**
 * Standings by points scored.
 *
 * Points, not wins: in a timed format a pair that loses 11-9 every round has had
 * a better night than one that loses 11-1, and the ranking should say so. Wins
 * break ties, then points conceded — the pair that defended better goes above.
 */
export function standings(teams, matches) {
  const table = new Map(teams.map((t) => [t.name, {
    team: t.name, played: 0, won: 0, points: 0, against: 0,
  }]))
  const touch = (name) => {
    if (!table.has(name)) table.set(name, { team: name, played: 0, won: 0, points: 0, against: 0 })
    return table.get(name)
  }

  for (const m of matches) {
    if (m.score_a == null || m.score_b == null) continue
    const a = touch(m.team_a)
    const b = touch(m.team_b)
    a.played++; b.played++
    a.points += m.score_a; a.against += m.score_b
    b.points += m.score_b; b.against += m.score_a
    if (m.score_a > m.score_b) a.won++
    else if (m.score_b > m.score_a) b.won++
  }

  return [...table.values()].sort((x, y) =>
    y.points - x.points || y.won - x.won || x.against - y.against || x.team.localeCompare(y.team))
}
