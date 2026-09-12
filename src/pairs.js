/**
 * Turning a list of names into pairs, and back.
 *
 * Sign-ups store a partner per player; a pair is two players who name each
 * other. The pairs board edits that as seats — pair 1, pair 2, … and a tray of
 * whoever is still unpaired — and this is the arithmetic between the two
 * shapes. Pure, so the randomiser and the save route can be tested without a
 * browser or a database.
 */

/** Fisher–Yates, with an injectable random for tests. */
export function shuffle(list, random = Math.random) {
  const out = list.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Fill the empty seats from the tray at random.
 *
 * Existing pairs are kept — the host has already decided those. For a mixed
 * level the tray is dealt woman/man where genders are known, so a random draw
 * still respects the one-of-each the level asks for; unknown genders fall
 * through to plain random, which is what an imported roster is.
 */
export function pairUp(pairs, tray, { mixed = false, random = Math.random } = {}) {
  const seats = pairs.map((p) => p.slice(0, 2))
  let pool = shuffle(tray, random)
  if (mixed) {
    const f = pool.filter((p) => p.gender === 'F')
    const m = pool.filter((p) => p.gender === 'M')
    const x = pool.filter((p) => p.gender !== 'F' && p.gender !== 'M')
    // Alternate F/M while both last, then whatever is left in draw order.
    const dealt = []
    while (f.length && m.length) dealt.push(f.pop(), m.pop())
    pool = dealt.concat(f, m, x)
  }
  for (const seat of seats) {
    while (seat.length < 2 && pool.length) seat.push(pool.shift())
  }
  while (pool.length) seats.push(pool.splice(0, 2))
  return { pairs: seats, tray: [] }
}

/** Every seated player back in the tray, then dealt again. */
export const reshuffle = (pairs, tray, opts) =>
  pairUp([], pairs.flat().concat(tray), opts)

/**
 * Seats → the partner each sign-up should hold. Names not on the sign-up list
 * are dropped rather than invented, and a name seated twice keeps its first
 * seat — the board is a hidden form field, and hidden fields say what the
 * browser was told to say.
 */
export function partnersFromSeats(seats, names) {
  const known = new Set(names)
  const partner = new Map(names.map((n) => [n, '']))
  const seen = new Set()
  for (const seat of seats) {
    const pair = []
    for (const raw of seat) {
      const n = String(raw ?? '').trim()
      if (!known.has(n) || seen.has(n) || pair.includes(n)) continue
      pair.push(n)
      if (pair.length === 2) break
    }
    pair.forEach((n) => seen.add(n))
    if (pair.length === 2) { partner.set(pair[0], pair[1]); partner.set(pair[1], pair[0]) }
  }
  return partner
}
