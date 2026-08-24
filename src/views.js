/**
 * The web console and the TV view.
 *
 * Hand-written HTML with one stylesheet, because a padel club's config screen is
 * a dozen fields and a table — a build step and a framework would be more
 * machinery than the thing it renders.
 */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const CSS = `
:root {
  --bg:#0B1220; --surface:#141C2B; --surface-2:#1B2536; --line:#2A3549;
  --ink:#E8EEF7; --muted:#9FB0C6; --brand:#3DDC97; --brand-ink:#04231A;
  --accent:#FFC857; --warn:#FF8A7A; --radius:14px;
}
*{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);
  font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--brand)} h1,h2,h3{line-height:1.2;margin:0 0 .5rem}
.wrap{max-width:1000px;margin:0 auto;padding:24px 20px 64px}
header.top{display:flex;align-items:center;gap:12px;padding:16px 20px;
  border-bottom:1px solid var(--line);background:var(--surface)}
header.top .dot{width:32px;height:32px;border-radius:9px;background:var(--brand);
  color:var(--brand-ink);display:grid;place-items:center;font-weight:800}
nav a{margin-right:16px;text-decoration:none;color:var(--muted);font-weight:600}
nav a.on{color:var(--ink)}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);
  padding:20px;margin:16px 0}
label{display:block;font-size:.82rem;color:var(--muted);margin:12px 0 4px;font-weight:600}
input,select,textarea{width:100%;padding:11px 12px;border-radius:10px;border:1px solid var(--line);
  background:var(--surface-2);color:var(--ink);font:inherit}
textarea{min-height:120px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.86rem}
button,.btn{appearance:none;border:0;border-radius:999px;padding:11px 20px;font:inherit;
  font-weight:700;background:var(--brand);color:var(--brand-ink);cursor:pointer;text-decoration:none;
  display:inline-flex;align-items:center;gap:8px}
.btn.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}
.btn.danger{background:transparent;color:var(--warn);border:1px solid var(--line)}
.row{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end}
.row>*{flex:1 1 160px}
table{width:100%;border-collapse:collapse;margin-top:8px}
th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line)}
th{font-size:.78rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
.pill{display:inline-block;padding:3px 10px;border-radius:999px;background:var(--surface-2);
  color:var(--muted);font-size:.78rem;font-weight:700}
.pill.on{background:#12352A;color:var(--brand)}
.muted{color:var(--muted)} .mono{font-family:ui-monospace,Menlo,monospace}
.grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
.note{border-left:3px solid var(--accent);padding:10px 14px;background:var(--surface-2);
  border-radius:0 10px 10px 0;color:var(--muted);font-size:.9rem}
pre.msg{white-space:pre-wrap;background:var(--surface-2);border:1px solid var(--line);
  border-radius:12px;padding:14px;font-size:.9rem;margin:0}
@media (max-width:640px){.wrap{padding:16px 14px 48px}}
`

export function page(title, body, { nav = '' } = {}) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>${CSS}</style></head><body>
<header class="top"><div class="dot">P</div><strong>Padel Tournament Planner</strong>
<nav style="margin-left:auto">${nav}</nav></header>
<div class="wrap">${body}</div></body></html>`
}

const navFor = (here) => ['/', '/tournaments', '/settings', '/whatsapp']
  .map((h, i) => `<a class="${here === h ? 'on' : ''}" href="${h}">${
    ['Overview', 'Tournaments', 'Settings', 'WhatsApp'][i]}</a>`).join('')

export function overview({ club, tournaments, courts, live }) {
  return page('Overview', `
    <h1>${esc(club.name)}</h1>
    <p class="muted">${esc(club.address) || 'No address set'} ·
      ${club.maps_url ? `<a href="${esc(club.maps_url)}">Map</a>` : 'no map link'}</p>
    <div class="grid">
      <div class="card"><h3>Courts</h3>
        <p class="muted">${courts.length ? courts.map((c) => esc(c.label)).join(' · ') : 'None yet'}</p>
        <a class="btn ghost" href="/settings">Manage courts</a></div>
      <div class="card"><h3>WhatsApp</h3>
        <p><span class="pill ${live ? 'on' : ''}">${live ? 'live' : 'draft mode'}</span></p>
        <p class="muted">${live ? 'Posting to the group.'
          : 'Messages are written for a human to paste.'}</p>
        <a class="btn ghost" href="/whatsapp">Open</a></div>
    </div>
    <div class="card"><h3>Tournaments</h3>
      ${tournaments.length ? `<table><tr><th>When</th><th>Level</th><th>Courts</th><th>Status</th><th></th></tr>
      ${tournaments.map((t) => `<tr><td>${esc(t.play_date) || '—'}</td><td>${esc(t.level) || '—'}</td>
        <td>${t.courts}</td><td><span class="pill">${esc(t.status)}</span></td>
        <td><a href="/t/${t.id}">Open</a></td></tr>`).join('')}</table>`
        : '<p class="muted">None yet — open one from WhatsApp, or below.</p>'}
      <p style="margin-top:14px"><a class="btn" href="/tournaments">New tournament</a></p>
    </div>`, { nav: navFor('/') })
}

export function settings({ club, courts }) {
  return page('Settings', `
    <h1>Settings</h1>
    <form class="card" method="post" action="/settings">
      <h3>Club</h3>
      <label>Club name</label><input name="name" value="${esc(club.name)}" required>
      <label>Address</label><input name="address" value="${esc(club.address)}"
        placeholder="Rua do Padel 12, Lisboa">
      <label>Google Maps link</label><input name="maps_url" value="${esc(club.maps_url)}"
        placeholder="https://maps.app.goo.gl/…">
      <p style="margin-top:16px"><button>Save club</button></p>
    </form>
    <div class="card">
      <h3>Courts</h3>
      <p class="muted">Named, not numbered — the WhatsApp message and the TV view both say these out loud.</p>
      <table>${courts.map((c) => `<tr><td>${esc(c.label)}</td><td style="text-align:right">
        <form method="post" action="/courts/${c.id}/delete"><button class="btn danger">Remove</button></form>
      </td></tr>`).join('') || '<tr><td class="muted">No courts yet</td></tr>'}</table>
      <form class="row" method="post" action="/courts" style="margin-top:14px">
        <div><label>Add a court</label><input name="label" placeholder="Court 1 / Center" required></div>
        <div style="flex:0 0 auto"><button>Add</button></div>
      </form>
    </div>`, { nav: navFor('/settings') })
}

export function tournamentsPage({ tournaments }) {
  return page('Tournaments', `
    <h1>New tournament</h1>
    <form class="card" method="post" action="/tournaments">
      <div class="row">
        <div><label>Level</label><input name="level" placeholder="MX-4" required></div>
        <div><label>Date</label><input name="play_date" placeholder="Friday 5 Sep, 19:00"></div>
      </div>
      <div class="row">
        <div><label>Courts</label><input name="courts" type="number" min="1" value="3"></div>
        <div><label>Duration (min)</label><input name="duration_min" type="number" min="10" value="90"></div>
        <div><label>Round (min)</label><input name="round_min" type="number" min="5" value="12"></div>
      </div>
      <p style="margin-top:16px"><button>Create</button></p>
      <p class="note">The same thing happens from the group with
        <span class="mono">!tournament non-stop level MX-4 date Friday courts 3 duration 90</span></p>
    </form>
    ${tournaments.map((t) => `<div class="card"><strong>${esc(t.level) || 'open'}</strong>
      <span class="muted"> · ${esc(t.play_date) || 'date TBC'} · ${t.courts} courts</span>
      <a class="btn ghost" style="float:right" href="/t/${t.id}">Open</a></div>`).join('')}
  `, { nav: navFor('/tournaments') })
}

export function tournamentPage({ t, teams, waiting, matches, table, message, courts }) {
  const rounds = [...new Set(matches.map((m) => m.round))]
  return page(`Tournament ${t.id}`, `
    <h1>${esc(t.level) || 'Open'} · ${esc(t.play_date) || 'date TBC'}</h1>
    <p class="muted">${t.courts} courts · ${t.duration_min} min · ${t.round_min} min rounds
      · <span class="pill">${esc(t.status)}</span>
      · <a href="/t/${t.id}/tv">TV view</a></p>

    <div class="grid">
      <div class="card"><h3>Teams (${teams.length})</h3>
        <table>${teams.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.name)}</td>
          <td>${x.mixed ? '<span class="pill on">mixed</span>' : ''}</td></tr>`).join('')
          || '<tr><td class="muted">Nobody yet</td></tr>'}</table>
        ${waiting.length ? `<h3 style="margin-top:16px">Waiting (${waiting.length})</h3>
          <table>${waiting.map((p) => `<tr><td>${esc(p.name)}</td>
            <td class="muted">${p.partner ? `waiting on ${esc(p.partner)}` : 'no partner'}</td></tr>`).join('')}</table>` : ''}
      </div>
      <div class="card"><h3>WhatsApp message</h3>
        <pre class="msg">${esc(message)}</pre>
        <p style="margin-top:12px"><a class="btn ghost" href="/whatsapp">Outbox</a></p>
      </div>
    </div>

    <div class="card"><h3>Schedule</h3>
      ${matches.length ? rounds.map((r) => `<h4>Round ${r}</h4><table>
        <tr><th>Court</th><th>Home</th><th>Away</th><th style="width:170px">Score</th></tr>
        ${matches.filter((m) => m.round === r).map((m) => `<tr>
          <td>${esc(m.court)}</td><td>${esc(m.team_a)}</td><td>${esc(m.team_b)}</td>
          <td><form class="row" method="post" action="/matches/${m.id}/score" style="gap:6px">
            <input name="a" type="number" min="0" value="${m.score_a ?? ''}" style="max-width:64px">
            <input name="b" type="number" min="0" value="${m.score_b ?? ''}" style="max-width:64px">
            <button class="btn ghost" style="padding:8px 12px">Save</button>
          </form></td></tr>`).join('')}</table>`).join('')
        : `<p class="muted">No schedule yet.</p>
           <form method="post" action="/t/${t.id}/schedule"><button ${teams.length < 2 ? 'disabled' : ''}>
             Draw the schedule</button></form>
           ${courts.length ? '' : '<p class="note">Add courts in Settings first — the draw needs somewhere to put the matches.</p>'}`}
    </div>

    <div class="card"><h3>Standings</h3>
      <table><tr><th>#</th><th>Team</th><th>Played</th><th>Won</th><th>Points</th><th>Against</th></tr>
      ${table.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.team)}</td><td>${r.played}</td>
        <td>${r.won}</td><td><strong>${r.points}</strong></td><td class="muted">${r.against}</td></tr>`).join('')
        || '<tr><td class="muted" colspan="6">No results yet</td></tr>'}</table>
    </div>`, { nav: navFor('/tournaments') })
}

/** Full-screen, high-contrast, self-refreshing — this one is read from ten metres. */
export function tvPage({ t, club, matches, table }) {
  const rounds = [...new Set(matches.map((m) => m.round))]
  const live = rounds.length ? rounds[0] : null
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="20">
<title>${esc(club.name)} — live</title><style>${CSS}
body{padding:2vh 3vw}
h1{font-size:clamp(28px,4vw,56px);margin:0}
.sub{font-size:clamp(14px,1.6vw,24px);color:var(--muted);margin-bottom:2vh}
.tv{display:grid;grid-template-columns:1.2fr 1fr;gap:2vw}
.tv table{font-size:clamp(14px,1.7vw,26px)}
.tv th{font-size:clamp(11px,1vw,15px)}
.court{font-weight:800;color:var(--accent)}
.pos{font-weight:800;color:var(--brand);width:2ch}
</style></head><body>
<h1>${esc(club.name)} — ${esc(t.level) || 'Non-stop smash'}</h1>
<div class="sub">${esc(t.play_date) || ''} · ${t.round_min} min rounds${
  live ? ` · Round ${live}` : ''}</div>
<div class="tv">
  <div><h2>Now on court</h2><table>
    ${matches.filter((m) => m.round === live).map((m) => `<tr>
      <td class="court">${esc(m.court)}</td><td>${esc(m.team_a)}</td>
      <td class="muted">v</td><td>${esc(m.team_b)}</td></tr>`).join('')
      || '<tr><td class="muted">Schedule not drawn yet</td></tr>'}
  </table></div>
  <div><h2>Standings</h2><table>
    ${table.slice(0, 10).map((r, i) => `<tr><td class="pos">${i + 1}</td><td>${esc(r.team)}</td>
      <td style="text-align:right"><strong>${r.points}</strong></td></tr>`).join('')
      || '<tr><td class="muted">No results yet</td></tr>'}
  </table></div>
</div></body></html>`
}

export function whatsappPage({ live, outbox, log }) {
  return page('WhatsApp', `
    <h1>WhatsApp</h1>
    <p><span class="pill ${live ? 'on' : ''}">${live ? 'live' : 'draft mode'}</span></p>
    ${live ? '' : `<p class="note">Draft mode: the bot does the parsing, the state and the
      formatting, and leaves the last hop to a human. WhatsApp has no official group API —
      posting into a group means pairing a number as a linked device, which is against their
      terms and gets numbers banned. Nobody has authorised that, so nothing is connected.</p>`}
    <div class="card"><h3>Try a command</h3>
      <form method="post" action="/whatsapp/simulate">
        <label>Message</label>
        <input name="text" class="mono" placeholder="!in Mike M partner Sofia" required>
        <label>From (optional)</label><input name="wa_id" placeholder="+351…">
        <p style="margin-top:14px"><button>Send to the bot</button></p>
      </form>
      ${log ? `<h3 style="margin-top:18px">Reply</h3><pre class="msg">${esc(log)}</pre>` : ''}
    </div>
    <div class="card"><h3>Outbox — paste these into the group</h3>
      ${outbox.length ? outbox.map((m) => `<pre class="msg" style="margin-bottom:12px">${esc(m.text)}</pre>`).join('')
        : '<p class="muted">Nothing waiting.</p>'}
    </div>`, { nav: navFor('/whatsapp') })
}
