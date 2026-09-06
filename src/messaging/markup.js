/**
 * The two pure translations between the club's chat conventions and Telegram's.
 * Kept apart from the channel so they can be tested without a database or a
 * bot token — they are the part of Telegram support most likely to be wrong in
 * a way nobody notices until a name with an underscore breaks a whole board.
 */

/**
 * WhatsApp markup out, Telegram HTML in.
 *
 * The messages are written once, in the conventions the club's WhatsApp group
 * already uses (`*bold*`, `_italic_`, `` `code` ``). Telegram's own legacy
 * Markdown parser looks close enough to be tempting and is not: one underscore
 * in a name and the API rejects the whole message. HTML has exactly three
 * characters to escape, so it can be produced deterministically from any name a
 * human types.
 */
export function toHtml(text) {
  const esc = String(text ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // Code first: a backtick span is literal, and markup found inside it is not
  // markup. Each pattern stays on one line, so an asterisk used as an asterisk
  // three paragraphs down can't pair up with one up here.
  return esc
    .replace(/`([^`\n]+)`/g, (_, s) => `<code>${s}</code>`)
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=$|[\s.,;:!?)])/g, (_, p, s) => `${p}<b>${s}</b>`)
    .replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s.,;:!?)])/g, (_, p, s) => `${p}<i>${s}</i>`)
}

/**
 * Telegram writes commands with a slash and, in a group, often with the bot's
 * own name stuck on the end. The club's syntax is `!in`; both spellings mean the
 * same thing and nobody should have to know which group they are typing in.
 */
export function normalizeCommand(text, botName = '') {
  const s = String(text ?? '').trim()
  const m = s.match(/^\/([a-z_]+)(?:@(\S+))?\b(.*)$/is)
  if (!m) return s
  if (m[2] && botName && m[2].toLowerCase() !== botName.toLowerCase()) return ''
  // /start is Telegram's own doorbell; the club's equivalent is the help text.
  const cmd = m[1].toLowerCase() === 'start' ? 'help' : m[1].toLowerCase()
  return `!${cmd}${m[3]}`
}

