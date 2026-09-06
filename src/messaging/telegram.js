/**
 * Telegram — the group channel that can actually send.
 *
 * Everything WhatsApp refuses to do, Telegram does with a documented API and no
 * terms to break: a bot can be added to the club's group, read the commands
 * addressed to it, post, and edit what it already posted. That last one is why
 * this exists. A sign-up board that is re-posted on every `!in` buries the group
 * in twenty near-identical messages; a board that is posted once, pinned, and
 * edited in place stays one message at the top of the chat that is always right.
 *
 * Round messages are the opposite and are posted fresh every time, because a
 * round message that quietly edited itself would never reach the phone of
 * somebody standing on court waiting to be told where to go.
 *
 * Configuration is one environment variable, `TELEGRAM_BOT_TOKEN`, from
 * @BotFather. The group is learned rather than configured: the first command the
 * bot sees in a group tells it which chat it lives in, and that is remembered.
 * A club should not have to find out what a numeric chat id is.
 */

import { getPost, savePost, telegramChat } from '../db.js'
import { normalizeCommand, toHtml } from './markup.js'

export { normalizeCommand, toHtml }

const API = 'https://api.telegram.org'

async function call(token, method, payload) {
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(payload?.timeout ? (payload.timeout + 10) * 1000 : 20000),
  })
  const body = await res.json().catch(() => ({}))
  if (!body.ok) {
    // Telegram says why in `description`, and the reason is nearly always
    // actionable ("bot was blocked", "chat not found"). Losing it would leave
    // the club with a silent bot and nothing to search for.
    throw new Error(`telegram ${method}: ${body.description || res.status}`)
  }
  return body.result
}

/**
 * Build the channel. Returns null when no token is set, which is the normal
 * state of a fresh checkout — the club runs on `draft` until it makes a bot.
 */
export function telegram({ token = process.env.TELEGRAM_BOT_TOKEN || '' } = {}) {
  if (!token) return null

  const sent = []
  const MAX_SENT = 50
  let me = null
  // Group admin lists, briefly. Asking Telegram who runs the group on every
  // `!in` would triple the API traffic of a busy sign-up evening; a few minutes
  // of staleness only ever delays somebody's promotion to host.
  const admins = new Map()
  const ADMIN_TTL_MS = 5 * 60 * 1000

  const chatFor = (meta) => meta.chat || telegramChat() || process.env.TELEGRAM_CHAT_ID || ''

  return {
    name: 'telegram',
    kind: 'telegram',
    live: true,
    configured: true,

    /** Who the bot is, so `/list@padeltribebot` can be told apart from someone else's. */
    async whoami() {
      if (!me) me = await call(token, 'getMe', {})
      return me
    },

    /**
     * Post a message. `meta.pin` pins it and `meta.key` remembers its id, which
     * together are how the sign-up board becomes one living message instead of a
     * thread of them: the next send under the same key edits rather than posts.
     */
    async send(text, meta = {}) {
      const chat = chatFor(meta)
      if (!chat) return { delivered: false, pending: true, reason: 'no chat yet' }
      const html = toHtml(text)
      const known = meta.key ? getPost(meta.key) : null

      if (known && known.chat_id === String(chat)) {
        try {
          await call(token, 'editMessageText', {
            chat_id: chat, message_id: known.message_id, text: html,
            parse_mode: 'HTML', link_preview_options: { is_disabled: true },
          })
          return { delivered: true, edited: true, message_id: known.message_id }
        } catch (err) {
          // "message is not modified" means the board already says this; every
          // other failure means the message is gone and a new one is right.
          if (/not modified/i.test(err.message)) {
            return { delivered: true, edited: false, unchanged: true }
          }
        }
      }

      const msg = await call(token, 'sendMessage', {
        chat_id: chat, text: html, parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      })
      sent.unshift({ text, at: new Date().toISOString(), ...meta })
      sent.length = Math.min(sent.length, MAX_SENT)
      if (meta.key) savePost(meta.key, String(chat), msg.message_id)
      // Pinning is best-effort: a bot without the right in the group can still
      // post, and a night that runs is worth more than a pinned board.
      if (meta.pin) await call(token, 'pinChatMessage', {
        chat_id: chat, message_id: msg.message_id, disable_notification: true,
      }).catch(() => {})
      return { delivered: true, message_id: msg.message_id }
    },

    /**
     * Whether this person runs the group.
     *
     * Opening a tournament is a host's job, and in a Telegram group that is a
     * question with a real answer rather than a default of "sure, why not".
     * A failed lookup says no: quietly letting anyone open a night because the
     * API blipped is the wrong way to be wrong.
     */
    async isAdmin(chatId, userId) {
      if (!chatId || !userId) return false
      const key = String(chatId)
      const hit = admins.get(key)
      const fresh = hit && Date.now() - hit.at < ADMIN_TTL_MS
      if (!fresh) {
        try {
          const list = await call(token, 'getChatAdministrators', { chat_id: chatId })
          admins.set(key, { at: Date.now(), ids: new Set(list.map((a) => String(a.user.id))) })
        } catch {
          return false
        }
      }
      return admins.get(key).ids.has(String(userId))
    },

    /**
     * Long polling, not a webhook.
     *
     * A webhook would need this server to be publicly reachable, with a URL and
     * a secret registered out of band — one more thing to get wrong on a home
     * box behind a tunnel. `getUpdates` needs the token and nothing else, and it
     * keeps working the day the club's DNS moves.
     */
    async updates(offset, { timeoutSec = 30 } = {}) {
      return call(token, 'getUpdates', {
        offset, timeout: timeoutSec, allowed_updates: ['message'],
      })
    },

    outbox: () => sent,
  }
}
