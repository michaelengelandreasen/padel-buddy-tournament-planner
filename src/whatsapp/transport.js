/**
 * How messages get to WhatsApp — deliberately behind a seam.
 *
 * WhatsApp has no official API for group chats. The Cloud API is 1:1 only, so
 * the `!in` / `!out` flow the club wants can only be done by pairing a phone
 * number as a linked device (Baileys, whatsapp-web.js and friends). That works,
 * and it is also against WhatsApp's terms and gets numbers banned.
 *
 * Nobody authorised burning a number, so the default transport is `draft`: the
 * bot does all the parsing, all the state and all the formatting, and hands the
 * finished message to a human to paste into the group. Every message the live
 * bot would send is produced identically — the only thing missing is the last
 * hop.
 *
 * To go live, add `linked-device.js` implementing the same two methods and set
 * WHATSAPP_TRANSPORT=linked-device. Nothing else in the codebase changes.
 */

/** Messages the club still has to paste, newest first. Bounded so it can't grow. */
const outbox = []
const MAX_OUTBOX = 50

export const draft = {
  name: 'draft',
  live: false,
  async send(text, meta = {}) {
    outbox.unshift({ text, at: new Date().toISOString(), ...meta })
    outbox.length = Math.min(outbox.length, MAX_OUTBOX)
    return { delivered: false, pending: true }
  },
  outbox: () => outbox,
}

export function transport() {
  const want = process.env.WHATSAPP_TRANSPORT || 'draft'
  if (want === 'draft') return draft
  // A live transport is opt-in and must be added deliberately; failing loudly
  // beats silently pretending messages were delivered.
  throw new Error(
    `WHATSAPP_TRANSPORT=${want} is not implemented. ` +
    'Add src/whatsapp/linked-device.js exporting { name, live, send, outbox }.')
}
