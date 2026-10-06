// The organizer deck: what Padel Buddy Tournaments does for a club's admin,
// shown with the real app (a demo copy with invented players).
//
//   docker run --rm -v "$PWD":/w padel-deck-tools node docs/deck/build-deck.mjs
//
// Writes docs/deck/out/padel-buddy-for-organizers.pptx.
import { createRequire } from 'node:module'
import { readFileSync, mkdirSync } from 'node:fs'
const require = createRequire(import.meta.url)
const pptxgen = require('pptxgenjs')
const sharp = require('sharp')
const { applyTheme } = require('/w/docs/deck/render/skill/scripts/apply_theme.js')

const ROOT = '/w'
const MEDIA = `${ROOT}/docs/deck/media`
const OUT = `${ROOT}/docs/deck/out`
mkdirSync(OUT, { recursive: true })

// ---------- Padel Buddy's own palette (src/views.js :root) ----------
const HEX = {
  navy: '0B1120', surface: '121A2B', surface2: '1B2437', line: '263247',
  ink: 'E7EDF5', muted: '9AA4B2', emerald: '34D399', emeraldDeep: '065F46',
  court: '60A5FA', amber: 'FCD34D', coral: 'FFB4AB',
}
const THEME = {
  name: 'Padel Buddy',
  headFontFace: 'Calibri',
  bodyFontFace: 'Calibri',
  colors: {
    dk1: HEX.navy, lt1: HEX.ink, dk2: HEX.surface, lt2: HEX.muted,
    accent1: HEX.emerald, accent2: HEX.court, accent3: HEX.amber, accent4: HEX.emeraldDeep,
    accent5: HEX.surface2, accent6: HEX.coral, hlink: HEX.emerald, folHlink: HEX.court,
  },
}

// ---------- the app's own icons and mark, rasterised ----------
const views = readFileSync(`${ROOT}/src/views.js`, 'utf8')
const iconsSrc = views.slice(views.indexOf('const ICONS = {') + 'const ICONS = '.length, views.indexOf('\n}\n', views.indexOf('const ICONS = {')) + 2)
// eslint-disable-next-line no-new-func
const ICONS = new Function(`return ${iconsSrc}`)()
const logoSrc = views.slice(views.indexOf('const LOGO = `') + 'const LOGO = `'.length, views.indexOf('</svg>`', views.indexOf('const LOGO = `')) + 6)

const png = async (svg, size) => 'image/png;base64,' + (await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()).toString('base64')
const icon = (name, color) => png(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="256" height="256" fill="none" stroke="#${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`, 256)
const logo = await png(logoSrc.replace('<svg class="mark"', '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"').replace(' aria-hidden="true"', ''), 512)
const file = (name) => `${MEDIA}/${name}`
const poster = (name) => 'image/png;base64,' + readFileSync(file(name)).toString('base64')

// ---------- deck ----------
const pres = new pptxgen()
pres.layout = 'LAYOUT_WIDE' // 13.333 x 7.5
pres.title = 'Padel Buddy Tournaments for organizers'
pres.author = 'Padel Buddy'
pres.company = 'Padel Buddy'
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace }
const C = pres.SchemeColor
const W = 13.333, H = 7.5, M = 0.6

pres.defineSlideMaster({
  title: 'TITLE',
  background: { color: HEX.navy },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: M, y: 2.05, w: 6.6, h: 2.2, fontSize: 44, bold: true, color: HEX.ink, align: 'left', valign: 'bottom', margin: 0 }, text: '' } },
    { placeholder: { options: { name: 'body', type: 'body', x: M, y: 4.4, w: 6.2, h: 1.4, fontSize: 18, color: HEX.muted, align: 'left', valign: 'top', margin: 0 }, text: '' } },
  ],
})
pres.defineSlideMaster({
  title: 'CONTENT',
  background: { color: HEX.navy },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: M, y: 0.42, w: W - 2 * M, h: 0.8, fontSize: 34, bold: true, color: HEX.ink, align: 'left', valign: 'top', margin: 0 }, text: '' } },
    { text: { text: 'Padel Buddy Tournaments', options: { x: M, y: H - 0.48, w: 4, h: 0.3, fontSize: 10, color: HEX.muted, margin: 0 } } },
  ],
  slideNumber: { x: W - M - 0.6, y: H - 0.48, w: 0.6, h: 0.3, fontSize: 10, color: HEX.muted, align: 'right' },
})

const kicker = (s, text, y = 1.22) => s.addText(text, { x: M, y, w: W - 2 * M, h: 0.45, fontSize: 16, color: HEX.muted, margin: 0, isTextBox: true, objectName: 'lede' })
// The motif: the app's icons in emerald circles.
const dot = async (s, name, x, y, d = 0.62, fill = HEX.emeraldDeep, stroke = HEX.emerald) => {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill }, objectName: `icon-bg-${name}` })
  s.addImage({ data: await icon(name, stroke), x: x + d * 0.22, y: y + d * 0.22, w: d * 0.56, h: d * 0.56, objectName: `icon-${name}` })
}
const card = (s, x, y, w, h, name) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
  x, y, w, h, rectRadius: 0.12, fill: { color: HEX.surface }, line: { color: HEX.line, width: 1 }, objectName: name,
})
const frame = (s, path, x, y, w, h, name) => {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x - 0.06, y: y - 0.06, w: w + 0.12, h: h + 0.12, rectRadius: 0.1, fill: { color: HEX.surface2 }, line: { color: HEX.line, width: 1 },
    shadow: { type: 'outer', color: '000000', opacity: 0.45, blur: 14, offset: 4, angle: 90 }, objectName: `${name}-frame` })
  s.addImage({ path, x, y, w, h, objectName: name })
}
const video = (s, name, x, y, w) => {
  const h = w * 960 / 1360
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x - 0.06, y: y - 0.06, w: w + 0.12, h: h + 0.12, rectRadius: 0.1, fill: { color: HEX.surface2 }, line: { color: HEX.emerald, width: 1.25 },
    shadow: { type: 'outer', color: '000000', opacity: 0.45, blur: 14, offset: 4, angle: 90 }, objectName: `${name}-frame` })
  s.addMedia({ type: 'video', path: file(`${name}.mp4`), cover: poster(`${name}-poster.png`), x, y, w, h, objectName: `${name}-video` })
  return h
}
const bullets = (s, items, x, y, w, h, size = 16) => s.addText(items.map(([head, body], i) => [
  { text: head, options: { bold: true, color: HEX.ink, breakLine: true } },
  { text: body, options: { color: HEX.muted, breakLine: i < items.length - 1, paraSpaceAfter: 14 } },
]).flat(), { x, y, w, h, fontSize: size, valign: 'top', margin: 0, isTextBox: true, objectName: 'points' })
const step = async (s, n, label) => {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 1.28, w: 1.55, h: 0.4, rectRadius: 0.2, fill: { color: HEX.emeraldDeep }, line: { color: HEX.emeraldDeep }, objectName: 'step-pill' })
  s.addText(`STEP ${n} · ${label}`, { x: M, y: 1.28, w: 1.55, h: 0.4, fontSize: 11, bold: true, color: HEX.emerald, align: 'center', valign: 'middle', margin: 0, charSpacing: 1, isTextBox: true, objectName: 'step-label' })
}

// 1 — Title
pres.addSection({ title: 'Why' })
{
  const s = pres.addSlide({ masterName: 'TITLE', sectionTitle: 'Why' })
  s.addImage({ data: logo, x: M, y: 0.9, w: 0.95, h: 0.95, objectName: 'logo' })
  s.addText('Padel Buddy', { x: M + 1.15, y: 0.98, w: 4, h: 0.45, fontSize: 22, bold: true, color: HEX.ink, margin: 0, isTextBox: true, objectName: 'brand' })
  s.addText('Tournaments', { x: M + 1.15, y: 1.42, w: 4, h: 0.35, fontSize: 15, color: HEX.muted, margin: 0, isTextBox: true, objectName: 'brand-sub' })
  s.addText('Run your padel nights from the group chat', { placeholder: 'title' })
  s.addText('No more printed sheets, PDFs or re-typed WhatsApp lists. Paste the club\'s message, and every player knows where to go next, on their own phone.', { placeholder: 'body' })
  frame(s, file('tv.png'), 7.55, 1.55, 5.2, 5.2 * 959 / 1920, 'tv-shot')
  frame(s, file('phone-scores.png'), 10.9, 3.15, 1.75, 1.75 * 954 / 441, 'phone-shot')
  s.addNotes('Padel Buddy Tournaments runs a club\'s tournament nights: sign-ups, pairs, the schedule, scores, standings, and the messages to the group. Everything in this deck is the real app; the players are invented.')
}

// 2 — The problem
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Why' })
  s.addText('Every night, the same admin', { placeholder: 'title' })
  kicker(s, 'What a nonstop or Americano night costs the organizer today')
  const rows = [
    ['board', 'Re-typing the list', 'The group fills the slots in WhatsApp; someone copies sixteen names into a spreadsheet.'],
    ['users', 'Pairs on paper', 'Partners, the odd player out, a pair that cancels at 18:55.'],
    ['court', '"Which court am I on?"', 'Twenty people at the wall between rounds, squinting at a printed grid.'],
    ['trophy', 'Scores and the table by hand', 'Adding up points after the night, then a PDF in the group the next day.'],
  ]
  for (const [i, [ic, head, body]] of rows.entries()) {
    const x = M + (i % 2) * 6.15, y = 2.05 + Math.floor(i / 2) * 2.2
    card(s, x, y, 5.85, 1.95, `pain-${i}`)
    await dot(s, ic, x + 0.3, y + 0.35)
    s.addText(head, { x: x + 1.15, y: y + 0.32, w: 4.45, h: 0.45, fontSize: 20, bold: true, color: HEX.ink, margin: 0, isTextBox: true, objectName: `pain-head-${i}` })
    s.addText(body, { x: x + 1.15, y: y + 0.82, w: 4.45, h: 0.95, fontSize: 15, color: HEX.muted, margin: 0, valign: 'top', isTextBox: true, objectName: `pain-body-${i}` })
  }
  s.addNotes('This is the reality at most clubs: WhatsApp for sign-ups, paper or a spreadsheet for the draw, a printed sheet on the wall, and a PDF of results afterwards. Every step is manual and repeated every week.')
}

// 3 — How a night runs
pres.addSection({ title: 'How it works' })
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'How it works' })
  s.addText('A night in four steps', { placeholder: 'title' })
  kicker(s, 'The organizer does the first two from a phone; the app does the rest')
  const steps = [
    ['chat', 'Paste', 'The club\'s usual WhatsApp sign-up message. Date, time, level, club and every name are read from it.'],
    ['users', 'Pair', 'Drag players into pairs, pair the rest at random, or balance them by level.'],
    ['list', 'Play', 'Type scores on the phone between points. The schedule and the table keep themselves.'],
    ['megaphone', 'Post', 'Each round goes to the group by itself: who plays where now, and where everyone goes next.'],
  ]
  const w = (W - 2 * M - 3 * 0.35) / 4
  for (const [i, [ic, head, body]] of steps.entries()) {
    const x = M + i * (w + 0.35), y = 2.15
    card(s, x, y, w, 4.2, `step-${i}`)
    await dot(s, ic, x + 0.35, y + 0.4, 0.8)
    s.addText(String(i + 1), { x: x + w - 0.85, y: y + 0.35, w: 0.55, h: 0.7, fontSize: 36, bold: true, color: HEX.line, align: 'right', margin: 0, isTextBox: true, objectName: `step-n-${i}` })
    s.addText(head, { x: x + 0.35, y: y + 1.45, w: w - 0.7, h: 0.55, fontSize: 24, bold: true, color: HEX.emerald, margin: 0, isTextBox: true, objectName: `step-head-${i}` })
    s.addText(body, { x: x + 0.35, y: y + 2.1, w: w - 0.7, h: 1.9, fontSize: 15, color: HEX.muted, margin: 0, valign: 'top', isTextBox: true, objectName: `step-body-${i}` })
  }
  s.addNotes('Four steps. Paste and Pair happen before the night; Play and Post happen during it, and Post is automatic: the last score of a round sends the next round to the group.')
}

// 4 — Paste
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'How it works' })
  s.addText('Paste the message you already send', { placeholder: 'title' })
  await step(s, 1, 'PASTE')
  video(s, 'v1-import', M, 1.95, 7.0)
  bullets(s, [
    ['Your format, as it is', 'The date line, the time line and the numbered list the group already uses. Copied from a phone or from WhatsApp Desktop.'],
    ['Read, then checked by you', 'Date, start, duration, level and club fill the form. Anything it could not read is named, not guessed.'],
    ['One tap creates the night', 'Every player signed up at once; "(dupla)" pairs stay together.'],
  ], 8.1, 1.95, 4.6, 4.9)
  s.addNotes('Clip: the organizer pastes the club\'s usual WhatsApp message, presses Read the message, checks what was understood, and creates the night with all eight players signed up.')
}

// 5 — Pair
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'How it works' })
  s.addText('Make the pairs in seconds', { placeholder: 'title' })
  await step(s, 2, 'PAIR')
  video(s, 'v3-pairs', M, 1.95, 7.0)
  bullets(s, [
    ['Drag, or tap two players', 'Works with a thumb on a phone as well as a mouse.'],
    ['Pair up the rest at random', 'Fills every empty seat; on a mixed night, one of each per pair.'],
    ['Balance by level', 'Strongest with weakest, so every pair adds up to about the same.'],
  ], 8.1, 1.95, 4.6, 4.9)
  s.addNotes('Clip: one player is placed by hand, the rest are paired at random, and the pairs are saved. Balance by level uses each player\'s saved level.')
}

// 6 — Play
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'How it works' })
  s.addText('Scores in, next round out', { placeholder: 'title' })
  await step(s, 3, 'PLAY')
  video(s, 'v2-scores', M, 1.95, 7.0)
  bullets(s, [
    ['Type the score, press Save', 'Big score boxes made for a phone at the side of the court. Save one match, or Save all.'],
    ['Saved means saved', 'A saved match shows its result; Edit fixes a typo, Cancel puts it back.'],
    ['The round posts itself', 'The last score of a round sends the next round\'s message to the group.'],
  ], 8.1, 1.95, 4.6, 4.9)
  s.addNotes('Clip: two scores are entered, the round completes, one saved score is corrected with Edit, and the round message for the next round is ready to post.')
}

// 7 — Where do I go next
pres.addSection({ title: 'For players' })
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'For players' })
  s.addText('Everyone knows where to go next', { placeholder: 'title' })
  await step(s, 4, 'POST')
  const round = readFileSync(file('msg-round.txt'), 'utf8').trim().split('\n')
  const keep = [...round.slice(0, 10), '…', ...round.slice(round.findIndex((l) => l.includes('Next round'))).slice(0, 5), '…']
  const bubble = (lines, x, y, w, h, name) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.16, fill: { color: '163A2C' }, line: { color: '163A2C' }, objectName: `${name}-bubble` })
    s.addText(lines.map((l, i) => {
      const bold = /^\*.*\*/.test(l.replace(/^[^*]*/, '')) && l.includes('*')
      return { text: l.replace(/🆚\s*/gu, 'vs ').replace(/\*/g, '').replace(/[\u{1F300}-\u{1FAFF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}]\uFE0F?\s*/gu, ''), options: { bold, breakLine: i < lines.length - 1 } }
    }), { x: x + 0.25, y: y + 0.2, w: w - 0.5, h: h - 0.4, fontSize: 13, color: HEX.ink, valign: 'top', margin: 0, isTextBox: true, objectName: `${name}-text` })
  }
  bubble(keep, M, 1.95, 5.6, 4.55, 'round')
  s.addText('Posted by the app after the last score of round 4', { x: M, y: 6.6, w: 5.6, h: 0.3, fontSize: 11, color: HEX.muted, margin: 0, isTextBox: true, objectName: 'round-caption' })
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 6.75, y: 1.95, w: 1.9, h: 0.6, rectRadius: 0.16, fill: { color: HEX.surface2 }, line: { color: HEX.surface2 }, objectName: 'ask-bubble' })
  s.addText('!where ines', { x: 6.75, y: 1.95, w: 1.9, h: 0.6, fontSize: 14, color: HEX.ink, align: 'center', valign: 'middle', margin: 0, fontFace: 'Courier New', isTextBox: true, objectName: 'ask-text' })
  bubble(readFileSync(file('msg-where.txt'), 'utf8').trim().split('\n'), 6.75, 2.75, 5.95, 1.75, 'where')
  bullets(s, [
    ['In WhatsApp and Telegram', 'Telegram posts by itself and keeps one pinned sign-up list up to date. For WhatsApp the message is ready to paste.'],
    ['Anyone can ask', '"!where" with their name answers for one player: court now, court next.'],
  ], 6.75, 4.75, 5.95, 2.2, 15)
  s.addNotes('This is the message players see between rounds. The "Next round" block is one line per pair, sorted by court, so a player finds their name and the court is already next to it.')
}

// 8 — TV
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'For players' })
  s.addText('A screen in the clubhouse that answers "which court?"', { placeholder: 'title' })
  const w = 9.2, h = w * 959 / 1920
  frame(s, file('tv.png'), M, 1.5, w, h, 'tv-board')
  bullets(s, [
    ['Every pair, every round', 'One row per pair: where they played, where they are now, where they go next.'],
    ['Refreshes itself', 'Put a tablet or a TV by the courts and leave it. Scores entered on a phone appear in seconds.'],
    ['Readable from the court', 'Big type, the live round highlighted, the leaders on the side.'],
  ], 10.15, 1.5, 2.6, 5.4, 14)
  s.addNotes('The TV view. It runs on old tablets too: it was tested on a Galaxy Tab 2 browser.')
}

// 9 — Players and levels
pres.addSection({ title: 'For the club' })
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'For the club' })
  s.addText('Know your players, and how they are improving', { placeholder: 'title' })
  const w = 7.3, h = w * 959 / 1300
  frame(s, file('player.png'), 5.43, 1.45, w, h, 'player-shot')
  bullets(s, [
    ['Every player, kept', 'Everyone who ever signed up, filled in from sign-ups and pasted messages.'],
    ['Levels with a history', 'A 1 to 7 level per player. Each change is kept with its date and a note: "won three nights running".'],
    ['Used on the night', 'Levels show on the pairs board and drive Balance by level.'],
  ], M, 1.55, 4.4, 5.3)
  s.addNotes('The player register. Levels are the same 1 to 7 ladder the tournaments use; the history makes level decisions explainable to players.')
}

// 10 — Built for clubs
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'For the club' })
  s.addText('Made for the way clubs actually run', { placeholder: 'title' })
  const tiles = [
    ['globe', 'Four languages', 'English, Português, Español and Українська, for the console and the group messages.'],
    ['phone', 'Phone first', 'Everything works one-handed on a phone; the desktop is a bonus.'],
    ['chats', 'WhatsApp and Telegram', 'One message, both groups. Copy buttons everywhere for WhatsApp.'],
    ['flag', 'Several clubs', 'Play at home or away. Each club with its own address and map link.'],
    ['court', 'Courts per night', 'Name them, add or remove them for one night without touching the next.'],
    ['trophy', 'Standings ready to share', 'A real table on screen, and the same table as a message for the group.'],
  ]
  const tw = (W - 2 * M - 2 * 0.35) / 3, th = 2.25
  for (const [i, [ic, head, body]] of tiles.entries()) {
    const x = M + (i % 3) * (tw + 0.35), y = 1.6 + Math.floor(i / 3) * (th + 0.3)
    card(s, x, y, tw, th, `tile-${i}`)
    await dot(s, ic === 'phone' ? 'tv' : ic, x + 0.3, y + 0.32, 0.58)
    s.addText(head, { x: x + 1.05, y: y + 0.3, w: tw - 1.3, h: 0.6, fontSize: 18, bold: true, color: HEX.ink, margin: 0, valign: 'middle', isTextBox: true, objectName: `tile-head-${i}` })
    s.addText(body, { x: x + 0.3, y: y + 1.05, w: tw - 0.6, h: 1.05, fontSize: 14, color: HEX.muted, margin: 0, valign: 'top', isTextBox: true, objectName: `tile-body-${i}` })
  }
  s.addNotes('The details that make it fit a real club: languages, phones, both chat apps, several venues, courts that change from night to night, and standings ready to share.')
}

// 11 — Coming next
pres.addSection({ title: 'Next' })
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Next' })
  s.addText('Coming next', { placeholder: 'title' })
  kicker(s, 'In development. Tell us what your club needs first')
  const cols = [
    ['shuffle', 'More formats', ['Americano', 'Mexicano, with rules your club sets', 'Up and Down']],
    ['user', 'Players on the app', ['Log in with a code by WhatsApp, SMS or email', 'Avatars and club logos', 'Phone, Instagram, left or right handed']],
    ['home', 'Run it your way', ['Open source: host it at your club', 'Or hosted for you, on your club\'s own address', 'Roles for players, organizers and clubs']],
  ]
  const cw = (W - 2 * M - 2 * 0.35) / 3
  for (const [i, [ic, head, items]] of cols.entries()) {
    const x = M + i * (cw + 0.35), y = 2.05
    card(s, x, y, cw, 4.6, `next-${i}`)
    await dot(s, ic, x + 0.35, y + 0.4, 0.7, HEX.surface2, HEX.amber)
    s.addText(head, { x: x + 0.35, y: y + 1.3, w: cw - 0.7, h: 0.55, fontSize: 22, bold: true, color: HEX.amber, margin: 0, isTextBox: true, objectName: `next-head-${i}` })
    s.addText(items.map((t, k) => ({ text: t, options: { bullet: true, breakLine: k < items.length - 1, paraSpaceAfter: 10 } })),
      { x: x + 0.35, y: y + 2.0, w: cw - 0.7, h: 2.4, fontSize: 15, color: HEX.ink, margin: 0, valign: 'top', isTextBox: true, objectName: `next-list-${i}` })
  }
  s.addNotes('Roadmap, not yet available: Americano, Mexicano with club-defined rules, Up and Down; player logins by one-time code; avatars and logos; open-source self-hosting or a hosted version on the club\'s own address.')
}

// 12 — Close
{
  const s = pres.addSlide({ masterName: 'TITLE', sectionTitle: 'Next' })
  s.addImage({ data: logo, x: M, y: 0.9, w: 0.95, h: 0.95, objectName: 'logo' })
  s.addText('Your next night, without the paper', { placeholder: 'title' })
  s.addText('We set up your club and courts. You paste your usual message. Your players get every round on their phones.', { placeholder: 'body' })
  frame(s, file('phone-board.png'), 8.0, 0.95, 2.35, 2.35 * 954 / 441, 'phone-board')
  frame(s, file('phone-pairs.png'), 10.55, 1.45, 2.15, 2.15 * 954 / 441, 'phone-pairs')
  s.addNotes('Close: setting a club up takes minutes; the organizer keeps using the group chat they already have.')
}

await pres.writeFile({ fileName: `${OUT}/padel-buddy-for-organizers.pptx` })
await applyTheme(`${OUT}/padel-buddy-for-organizers.pptx`, THEME)
console.log('written')
