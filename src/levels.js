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

/**
 * The ladder itself is language-free — `MX-4` means the same in both — so only
 * the words that describe it come from the string table.
 */
import { translator } from './i18n.js'

export const CATEGORIES = [
  { code: 'MX', key: 'catMixed', hintKey: 'catMixedHint' },
  { code: 'M', key: 'catMens', hintKey: '' },
  { code: 'F', key: 'catWomens', hintKey: '' },
]

export const GRADES = [1, 2, 3, 4, 5, 6, 7].map((grade) => ({
  grade, key: `grade${grade}`, blurbKey: `blurb${grade}`,
}))

const CAT_BY_CODE = new Map(CATEGORIES.map((c) => [c.code, c]))
const GRADE_BY_N = new Map(GRADES.map((g) => [g.grade, g]))

/** The categories and grades with their words filled in, for a picker. */
export const categories = (t) => CATEGORIES.map((c) => ({
  code: c.code, label: t(c.key), hint: c.hintKey ? t(c.hintKey) : '',
}))
export const grades = (t) => GRADES.map((g) => ({
  grade: g.grade, label: t(g.key), blurb: t(g.blurbKey),
}))

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
export function parseLevel(input, { lang } = {}) {
  const t = translator(lang)
  const raw = String(input ?? '').trim()
  if (!raw) return { ok: false, error: t('levelWhich') }
  // Angle brackets from the spec, and the digit glued to the category in "MX4",
  // both have to go before word boundaries mean anything.
  const s = raw.replace(/[<>()]/g, ' ').toUpperCase()
    .replace(/([A-Z])(\d)/g, '$1 $2').replace(/(\d)([A-Z])/g, '$1 $2')

  const hit = CAT_PATTERNS.find(([re]) => re.test(s))
  const category = hit?.[1]
  const digits = s.match(/\d+/g) || []

  if (!category && !digits.length) {
    return { ok: false, error: t('levelUnknown', { raw, examples: EXAMPLES }) }
  }
  if (!category) return { ok: false, error: t('levelNoCategory', { raw, n: digits[0] }) }
  if (!digits.length) {
    return { ok: false, error: t('levelNoGrade', { raw, max: GRADES.length, cat: category }) }
  }
  const grade = Number(digits[0])
  if (!GRADE_BY_N.has(grade)) {
    return { ok: false, error: t('levelBadGrade', { n: grade, max: GRADES.length }) }
  }
  return { ok: true, code: `${category}-${grade}`, category, grade }
}

/** True when a stored value is a level this app can still render. */
export const isLevel = (code) => parseLevel(code).code === code

/** `MX-4` → `Mixed · level 4, upper intermediate`. Unknown codes pass through. */
export function levelLabel(code, t = translator()) {
  const p = parseLevel(code)
  if (!p.ok) return String(code || t('statusOpen'))
  return `${t(CAT_BY_CODE.get(p.category).key)} · ${t('level').toLowerCase()} ${p.grade}, ${
    t(GRADE_BY_N.get(p.grade).key).toLowerCase()}`
}

/** `MX-4` → `Mixed 4` — the short form for a headline or a TV screen. */
export function levelShort(code, t = translator()) {
  const p = parseLevel(code)
  return p.ok ? `${t(CAT_BY_CODE.get(p.category).key)} ${p.grade}` : String(code || t('statusOpen'))
}

/** `MX-4` → `MX4` — how the group writes it on the board. */
export const levelTight = (code) => String(code || '').replace(/-/g, '')

/** True when this level asks every pair to be one of each. */
export const isMixedLevel = (code) => parseLevel(code).category === 'MX'

const EXAMPLES = 'MX-4, M-3, F-5'

/** The full list, spelled out — what the bot sends when someone gets it wrong. */
export function levelHelp(t = translator()) {
  return [
    `*${t('levelsTitle')}*`,
    ...categories(t).map((c) => `${c.code} — ${c.label.toLowerCase()}`),
    ...grades(t).map((g) => `${g.grade} — ${g.label.toLowerCase()}, ${g.blurb.toLowerCase()}`),
    '',
    t('levelsPutTogether', { examples: '`MX-4`, `M-3`, `F-5`' }),
  ].join('\n')
}
