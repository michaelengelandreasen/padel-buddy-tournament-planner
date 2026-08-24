/**
 * Padel skill levels — the one field the whole night is advertised on.
 *
 * A level is a *category* (men's, women's, mixed) plus a *grade* 1–7, written
 * `MX-4`. It was free text, which meant `!tournament level asdf` opened a
 * tournament nobody could self-select into and the web console had no way to
 * offer a choice. Both ends now go through {@link parseLevel}, so the column
 * only ever holds a code the rest of the app can render.
 *
 * Grade 1 is the best players and 7 the newest — the direction Portuguese clubs
 * advertise in, where a "4" night means the same thing at every club in the
 * city. Adding an 8th grade or a new category is a line in these two tables and
 * nothing else.
 */

export const CATEGORIES = [
  { code: 'MX', label: 'Mixed', hint: 'One of each on every pair' },
  { code: 'M', label: "Men's", hint: '' },
  { code: 'F', label: "Women's", hint: '' },
]

export const GRADES = [
  { grade: 1, label: 'Competition', blurb: 'Federated, plays ranked tournaments' },
  { grade: 2, label: 'Advanced +', blurb: 'Regional competition, on court weekly' },
  { grade: 3, label: 'Advanced', blurb: 'Works the walls, builds the point' },
  { grade: 4, label: 'Upper intermediate', blurb: 'Dependable serve, volley and lob' },
  { grade: 5, label: 'Intermediate', blurb: 'Rallies hold up, still learning the glass' },
  { grade: 6, label: 'Improver', blurb: 'A season or two in' },
  { grade: 7, label: 'Beginner', blurb: 'First racket nights' },
]

const CAT_BY_CODE = new Map(CATEGORIES.map((c) => [c.code, c]))
const GRADE_BY_N = new Map(GRADES.map((g) => [g.grade, g]))

/** Every valid code, best grade first — what the console's picker is built from. */
export const ALL_LEVELS = CATEGORIES.flatMap((c) => GRADES.map((g) => `${c.code}-${g.grade}`))

/**
 * The spellings people actually type. Mixed is tested first so the bare `M` of
 * "men's" can never swallow the `M` of `MX` — and `\bM\b` would not match inside
 * "MX" anyway, but the order says so out loud rather than relying on it.
 */
const CAT_PATTERNS = [
  [/\b(MX|MIX|MIXED|MISTO|MISTA)\b/, 'MX'],
  [/\b(F|FEM|FEMALE|FEMININO|FEMININA|W|WOMEN|WOMENS|LADIES)\b/, 'F'],
  [/\b(M|MALE|MASC|MASCULINO|MEN|MENS)\b/, 'M'],
]

/**
 * Read a level out of whatever was typed.
 *
 * Accepts `MX-4`, `mx4`, `MX 4`, `mixed 4`, `4 misto`, `<MX-4>` — the same
 * tolerance the rest of the command language has, because the level arrives from
 * a group chat as often as from a form. Returns `{ok, code, category, grade}` or
 * `{ok:false, error}` with a message that is safe to send straight back to
 * WhatsApp or render above the form.
 */
export function parseLevel(input) {
  const raw = String(input ?? '').trim()
  if (!raw) {
    return { ok: false, error: 'Which level? Pick one like `MX-4` — mixed, upper intermediate.' }
  }
  // Angle brackets from the spec, and the digit glued to the category in "MX4",
  // both have to go before word boundaries mean anything.
  const s = raw.replace(/[<>()]/g, ' ').toUpperCase()
    .replace(/([A-Z])(\d)/g, '$1 $2').replace(/(\d)([A-Z])/g, '$1 $2')

  const hit = CAT_PATTERNS.find(([re]) => re.test(s))
  const category = hit?.[1]
  const digits = s.match(/\d+/g) || []

  if (!category && !digits.length) {
    return { ok: false, error: `I don't know the level "${raw}". Levels look like ${examples()}.` }
  }
  if (!category) {
    return { ok: false, error: `"${raw}" is missing the category — M for men's, F for women's, MX for mixed. Try MX-${digits[0]}.` }
  }
  if (!digits.length) {
    return { ok: false, error: `"${raw}" is missing the grade — 1 (competition) to ${GRADES.length} (beginner). Try ${category}-4.` }
  }
  const grade = Number(digits[0])
  if (!GRADE_BY_N.has(grade)) {
    return { ok: false, error: `Grade ${grade} doesn't exist — they run 1 (competition) to ${GRADES.length} (beginner).` }
  }
  return { ok: true, code: `${category}-${grade}`, category, grade }
}

/** True when a stored value is a level this app can still render. */
export const isLevel = (code) => parseLevel(code).ok === true && parseLevel(code).code === code

/** `MX-4` → `Mixed · level 4, upper intermediate`. Unknown codes pass through. */
export function levelLabel(code) {
  const p = parseLevel(code)
  if (!p.ok) return String(code || 'open')
  const g = GRADE_BY_N.get(p.grade)
  return `${CAT_BY_CODE.get(p.category).label} · level ${p.grade}, ${g.label.toLowerCase()}`
}

/** `MX-4` → `Mixed 4` — the short form for a headline or a TV screen. */
export function levelShort(code) {
  const p = parseLevel(code)
  return p.ok ? `${CAT_BY_CODE.get(p.category).label} ${p.grade}` : String(code || 'open')
}

/** True when this level asks every pair to be one of each. */
export const isMixedLevel = (code) => parseLevel(code).category === 'MX'

const examples = () => 'MX-4, M-3 or F-5'

/** The full list, spelled out — what the bot sends when someone gets it wrong. */
export function levelHelp() {
  return [
    '*Levels*',
    ...CATEGORIES.map((c) => `${c.code} — ${c.label.toLowerCase()}`),
    ...GRADES.map((g) => `${g.grade} — ${g.label.toLowerCase()}, ${g.blurb.toLowerCase()}`),
    '',
    'Put them together: `MX-4`, `M-3`, `F-5`.',
  ].join('\n')
}
