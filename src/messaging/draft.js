/**
 * WhatsApp, by hand — the channel that stops one step short of sending.
 *
 * WhatsApp has no official API for group chats. The Cloud API is 1:1 only, so
 * the `!in` / `!out` flow the club wants can only be done by pairing a phone
 * number as a linked device (Baileys, whatsapp-web.js and friends). That works,
 * and it is also against WhatsApp's terms and gets numbers banned.
 *
 * Nobody authorised burning a number, so this channel does all the parsing, all
 * the state and all the formatting, and hands the finished message to a human to
 * paste into the group. Every message a live bot would send is produced
 * identically — the only thing missing is the last hop.
 *
 * Telegram is the way out of this: it has a real group API, so `src/messaging/
 * telegram.js` posts by itself. The club can run both at once — the same message
 * lands in the Telegram group on its own and waits in the outbox for WhatsApp.
 */

/** Messages the club still has to paste, newest first. Bounded so it can't grow. */
const outbox = []
const MAX_OUTBOX = 50

export const draft = {
  name: 'draft',
  kind: 'whatsapp',
  live: false,
  configured: true,
  async send(text, meta = {}) {
    outbox.unshift({ text, at: new Date().toISOString(), ...meta })
    outbox.length = Math.min(outbox.length, MAX_OUTBOX)
    return { delivered: false, pending: true }
  },
  outbox: () => outbox,
}
