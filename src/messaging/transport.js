/**
 * One message, every group the club runs.
 *
 * A club does not have "a WhatsApp bot" and "a Telegram bot" — it has a night,
 * and some of the players are in one group and some in the other. So the bot
 * formats a message once and this hands it to every channel that is configured:
 * Telegram posts it, WhatsApp queues it for a human to paste, and neither knows
 * about the other.
 *
 * A channel that throws does not stop the others. The Telegram API being down at
 * 19:04 on a Friday must not also stop the WhatsApp draft from being written —
 * that is the whole reason the club has two groups.
 */

import { draft } from './draft.js'
import { telegram } from './telegram.js'

/**
 * Which channels are on, in the order a result should be read.
 *
 * `MESSAGING_CHANNELS` names them explicitly; left unset, the club gets the
 * draft outbox plus Telegram if and only if a bot token exists. Adding a token
 * is therefore the entire setup — there is no second switch to forget.
 */
export function buildChannels(env = process.env) {
  const want = String(env.MESSAGING_CHANNELS || env.WHATSAPP_TRANSPORT || '')
    .split(/[,\s]+/).filter(Boolean)
  const tg = telegram({ token: env.TELEGRAM_BOT_TOKEN || '' })

  if (!want.length) return [draft, tg].filter(Boolean)

  return want.map((name) => {
    if (name === 'draft' || name === 'whatsapp') return draft
    if (name === 'telegram') {
      // Naming a channel that cannot run is a configuration mistake worth
      // hearing about at boot, not a bot that silently posts nowhere.
      if (!tg) throw new Error('MESSAGING_CHANNELS names telegram, but TELEGRAM_BOT_TOKEN is unset.')
      return tg
    }
    throw new Error(`Unknown messaging channel "${name}". Known: draft, telegram.`)
  })
}

export function bus(channels = buildChannels()) {
  const byKind = (kind) => channels.find((c) => c.kind === kind) || null

  return {
    channels,
    /** True once at least one channel puts messages in front of people by itself. */
    live: channels.some((c) => c.live),
    name: channels.map((c) => c.name).join('+') || 'none',
    telegram: byKind('telegram'),
    draft: byKind('whatsapp'),

    /**
     * Send to everything. Returns one result per channel, failures included —
     * the console shows them, because "the bot posted" and "the bot tried" are
     * different things to a host watching a group that stayed empty.
     */
    async send(text, meta = {}) {
      return Promise.all(channels.map(async (c) => {
        try {
          return { channel: c.name, ...(await c.send(text, meta)) }
        } catch (err) {
          console.error(`[${c.name}] ${err.message}`)
          return { channel: c.name, delivered: false, error: err.message }
        }
      }))
    },

    /** Everything still waiting for a human, newest first. */
    outbox: () => channels.flatMap((c) => (c.outbox ? c.outbox() : [])),
  }
}

/**
 * Feed a live channel's incoming messages to the bot, forever.
 *
 * Long polling in a plain loop rather than a library: one `await`, one offset,
 * and a sleep on failure so a network blip backs off instead of hammering
 * Telegram from a restart loop. Returns a stop function, which the tests use and
 * a graceful shutdown would.
 */
export function listen(channel, onMessage, { log = console } = {}) {
  if (!channel?.updates) return () => {}
  let running = true
  let offset

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  ;(async () => {
    while (running) {
      try {
        const updates = await channel.updates(offset)
        for (const u of updates) {
          offset = u.update_id + 1
          if (!running) break
          try { await onMessage(u) } catch (err) { log.error(`[${channel.name}] ${err.message}`) }
        }
      } catch (err) {
        log.error(`[${channel.name}] ${err.message}`)
        await sleep(5000)
      }
    }
  })()

  return () => { running = false }
}
