/**
 * Sending a sign-in code to a person: WhatsApp, SMS or email.
 *
 * Each channel is on when its keys are in the environment, and off otherwise —
 * the sign-in page only offers what can actually be delivered:
 *
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN   both phone channels, through Twilio
 *   TWILIO_SMS_FROM                          the number SMS comes from
 *   TWILIO_WHATSAPP_FROM                     the WhatsApp sender, e.g. +14155238886
 *   RESEND_API_KEY, EMAIL_FROM               email, through Resend
 *
 * `SHOW_CODES=1` is for a demo or a first install with nothing connected: the
 * code is shown on the page instead of being sent. Never on a real club.
 */
import { translator } from './i18n.js'

const env = (k) => String(process.env[k] || '').trim()
export const showCodes = () => /^(1|true|yes|on)$/i.test(env('SHOW_CODES'))

export const channels = () => ({
  whatsapp: !!(env('TWILIO_ACCOUNT_SID') && env('TWILIO_AUTH_TOKEN') && env('TWILIO_WHATSAPP_FROM')),
  sms: !!(env('TWILIO_ACCOUNT_SID') && env('TWILIO_AUTH_TOKEN') && env('TWILIO_SMS_FROM')),
  email: !!(env('RESEND_API_KEY') && env('EMAIL_FROM')),
})

/** Which channels a person can be reached on, given what they registered with. */
export function channelsFor(account) {
  const on = channels()
  const out = []
  if (account.phone && (on.whatsapp || showCodes())) out.push('whatsapp')
  if (account.phone && (on.sms || showCodes())) out.push('sms')
  if (account.email && (on.email || showCodes())) out.push('email')
  return out
}

async function twilio(to, body, from) {
  const sid = env('TWILIO_ACCOUNT_SID')
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${sid}:${env('TWILIO_AUTH_TOKEN')}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  })
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${(await res.text()).slice(0, 160)}`)
}

async function resend(to, subject, text) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env('RESEND_API_KEY')}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env('EMAIL_FROM'), to, subject, text }),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 160)}`)
}

/**
 * Deliver a code. Resolves to `{sent: true}`, or `{shown: code}` when the code
 * goes on the page (SHOW_CODES with that channel not connected). Throws when a
 * connected channel refuses it.
 */
export async function sendCode(account, channel, { code, link }, { lang, base }) {
  const t = translator(lang)
  const on = channels()
  const url = link ? `${base}/login/link?token=${encodeURIComponent(link)}` : ''
  if (!on[channel]) {
    if (showCodes()) return { shown: code, link: url }
    throw new Error(t('channelOff'))
  }
  const text = t('codeMessage', { code })
  if (channel === 'whatsapp') await twilio(`whatsapp:${account.phone}`, text, `whatsapp:${env('TWILIO_WHATSAPP_FROM')}`)
  else if (channel === 'sms') await twilio(account.phone, text, env('TWILIO_SMS_FROM'))
  else await resend(account.email, t('codeEmailSubject'), `${text}\n\n${t('codeEmailLink')}\n${url}`)
  return { sent: true }
}
