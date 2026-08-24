/**
 * The web console and the TV view.
 *
 * Hand-written HTML with one stylesheet, because a padel club's config screen is
 * a dozen fields and a table — a build step and a framework would be more
 * machinery than the thing it renders.
 *
 * The stylesheet is phone-first in the one way that matters: nothing is allowed
 * to make the page scroll sideways. The nav scrolls inside itself, tables scroll
 * inside their card or collapse into rows of labelled chips (`table.stack`), and
 * every tap target clears 44px. A club captain reads this standing on court 3
 * with one hand.
 */

import { categories, grades, isMixedLevel, levelLabel, levelShort, parseLevel } from './levels.js'
import { humanWhen, todayISO } from './dates.js'
import { LANGUAGES, translator } from './i18n.js'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const CSS = `
:root {
  --bg:#0B1220; --surface:#141C2B; --surface-2:#1B2536; --line:#2A3549;
  --ink:#E8EEF7; --muted:#9FB0C6; --brand:#3DDC97; --brand-ink:#04231A;
  --accent:#FFC857; --warn:#FF8A7A; --radius:14px;
  /* Native date and time pickers, the caret and the scrollbars all read this. */
  color-scheme: dark;
}
*{box-sizing:border-box} html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);overflow-x:hidden;
  font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--brand)} h1,h2,h3{line-height:1.2;margin:0 0 .5rem}
/* An action that happens to be a link still needs a thumb-sized box around it. */
a.tap{display:inline-flex;align-items:center;min-height:44px;font-weight:600}
h1{font-size:clamp(1.4rem,5vw,2rem);overflow-wrap:anywhere}
.wrap{max-width:1000px;margin:0 auto;padding:24px 20px 64px}

header.top{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;
  padding:10px 16px;border-bottom:1px solid var(--line);background:var(--surface);
  position:sticky;top:0;z-index:5}
header.top .brand{display:flex;align-items:center;gap:10px;min-width:0;flex:1 1 auto;
  min-height:44px;color:inherit;text-decoration:none}
header.top .brand strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
header.top .dot{width:32px;height:32px;flex:0 0 32px;border-radius:9px;background:var(--brand);
  color:var(--brand-ink);display:grid;place-items:center;font-weight:800}
nav{margin-left:auto;display:flex;gap:2px;max-width:100%;overflow-x:auto;
  scrollbar-width:none;-ms-overflow-style:none}
nav::-webkit-scrollbar{display:none}
nav a{display:inline-flex;align-items:center;min-height:44px;padding:0 12px;border-radius:999px;
  text-decoration:none;color:var(--muted);font-weight:600;white-space:nowrap}
nav a.on{color:var(--ink);background:var(--surface-2)}
form.lang{display:flex;gap:2px;flex:0 0 auto;margin-left:8px}
form.lang button{background:transparent;color:var(--muted);border:1px solid transparent;
  min-height:44px;padding:0 10px;font-size:.82rem;font-weight:800;letter-spacing:.03em}
form.lang button.on{color:var(--brand-ink);background:var(--brand)}

.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);
  padding:20px;margin:16px 0;min-width:0}
label{display:block;font-size:.82rem;color:var(--muted);margin:12px 0 4px;font-weight:600}
input,select,textarea{width:100%;min-width:0;min-height:44px;padding:10px 12px;border-radius:10px;
  border:1px solid var(--line);background:var(--surface-2);color:var(--ink);font:inherit;font-size:16px}
select{appearance:none;background-image:linear-gradient(45deg,transparent 50%,var(--muted) 50%),
  linear-gradient(135deg,var(--muted) 50%,transparent 50%);
  background-position:calc(100% - 18px) 50%,calc(100% - 13px) 50%;
  background-size:5px 5px,5px 5px;background-repeat:no-repeat;padding-right:36px}
input:focus,select:focus,textarea:focus{outline:2px solid var(--brand);outline-offset:1px;border-color:transparent}
textarea{min-height:120px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.86rem}
button,.btn{appearance:none;border:0;border-radius:999px;padding:11px 20px;font:inherit;
  min-height:44px;font-weight:700;background:var(--brand);color:var(--brand-ink);cursor:pointer;
  text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:8px}
button:disabled{opacity:.45;cursor:not-allowed}
.btn.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}
.btn.danger{background:transparent;color:var(--warn);border:1px solid var(--line)}
.row{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end}
.row>*{flex:1 1 160px;min-width:0}
.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}

.tablewrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 -2px}
table{width:100%;border-collapse:collapse;margin-top:8px}
th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:middle}
th{font-size:.78rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;white-space:nowrap}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
.pill{display:inline-block;padding:3px 10px;border-radius:999px;background:var(--surface-2);
  color:var(--muted);font-size:.78rem;font-weight:700;white-space:nowrap}
.pill.on{background:#12352A;color:var(--brand)}
.muted{color:var(--muted)} .mono{font-family:ui-monospace,Menlo,monospace}
.grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr))}
.note{border-left:3px solid var(--accent);padding:10px 14px;background:var(--surface-2);
  border-radius:0 10px 10px 0;color:var(--muted);font-size:.9rem;overflow-wrap:anywhere}
.err{border-left:3px solid var(--warn);padding:10px 14px;background:#2A1A1C;
  border-radius:0 10px 10px 0;color:var(--ink);font-size:.92rem;margin:0 0 8px}
.hint{color:var(--muted);font-size:.82rem;margin:6px 0 0}
pre.msg{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--surface-2);
  border:1px solid var(--line);border-radius:12px;padding:14px;font-size:.9rem;margin:0}
.score{display:flex;gap:6px;align-items:center;flex-wrap:nowrap}
.score input{width:64px;flex:0 0 64px;text-align:center;padding:8px 4px}
.score button{padding:8px 14px;flex:0 0 auto}
.head{display:flex;gap:12px;align-items:center;flex-wrap:wrap;justify-content:space-between}

@media (max-width:720px){
  .wrap{padding:16px 14px 56px}
  header.top{padding:8px 12px}
  nav{margin-left:0;width:100%;order:3;padding-bottom:2px}
  nav a{padding:0 10px}
  .card{padding:16px}
}

/*
 * Below this width a six-column table is a sideways scroll nobody performs. The
 * row becomes its own little block: the position and the name on the first line,
 * then every other cell as a labelled chip that wraps. Labels come from data-l,
 * so the desktop <thead> stays the single source of the column names.
 */
@media (max-width:560px){
  table.stack, table.stack tbody, table.stack tr, table.stack td{display:block}
  table.stack thead{display:none}
  table.stack tr{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 14px;
    padding:12px 2px;border-bottom:1px solid var(--line)}
  table.stack tr:last-child{border-bottom:0}
  table.stack td{border:0;padding:0;display:inline-flex;gap:6px;align-items:baseline;
    font-variant-numeric:tabular-nums;text-align:left}
  table.stack td::before{content:attr(data-l);color:var(--muted);font-size:.7rem;font-weight:700;
    text-transform:uppercase;letter-spacing:.04em}
  table.stack td:not([data-l])::before,table.stack td[data-l=""]::before{content:none}
  table.stack td:empty{display:none}
  table.stack td.pos{order:-2;flex:0 0 auto;font-weight:800;color:var(--brand);font-size:1.05rem}
  /* The title keeps the line to itself. Left to grow naturally, a short team
     name leaves room for the first chip and every row wraps differently. */
  table.stack td.lead{order:-1;flex:1 1 auto;min-width:calc(100% - 3.5rem);
    font-weight:700;font-size:1.05rem;overflow-wrap:anywhere}
  table.stack td.full{flex:1 1 100%}
}
`

/** Progressive enhancement only: the two level selects already say what they mean. */
const LEVEL_JS = `
(function(){
  var c=document.getElementById('level_category'),g=document.getElementById('level_grade'),
      o=document.getElementById('level_preview');
  if(!c||!g||!o)return;
  function paint(){
    var gr=g.options[g.selectedIndex];
    o.textContent=c.value+'-'+g.value+' — '+c.options[c.selectedIndex].dataset.label+
      ', '+gr.dataset.label.toLowerCase()+'. '+gr.dataset.blurb+'.';
  }
  c.addEventListener('change',paint);g.addEventListener('change',paint);paint();
})();`

/**
 * The language switch lives in the header because it is the one setting someone
 * changes mid-task. It POSTs — switching language rewrites the club row, and a
 * link that mutates state is a link a crawler or a prefetch can pull.
 */
const langToggle = (lang, here) => `<form class="lang" method="post" action="/language">${
  here ? `<input type="hidden" name="back" value="${esc(here)}">` : ''}${
  LANGUAGES.map((l) => `<button name="language" value="${l.code}"
    class="${l.code === lang ? 'on' : ''}" aria-label="${esc(l.label)}"
    ${l.code === lang ? 'aria-current="true"' : ''}>${l.short}</button>`).join('')}</form>`

export function page(title, body, { nav = '', script = '', t = translator(), here = '' } = {}) {
  return `<!doctype html><html lang="${t.lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="dark">
<title>${esc(title)}</title><style>${CSS}</style></head><body>
<header class="top"><a class="brand" href="/"><span class="dot">P</span>
<strong>${esc(t('appName'))}</strong></a>
<nav>${nav}</nav>${langToggle(t.lang, here)}</header>
<div class="wrap">${body}</div>${script ? `<script>${script}</script>` : ''}</body></html>`
}

const navFor = (here, t) => [['/', 'navOverview'], ['/tournaments', 'navTournaments'],
  ['/settings', 'navSettings'], ['/whatsapp', 'navWhatsapp']]
  .map(([h, key]) => `<a class="${here === h ? 'on' : ''}" href="${h}">${esc(t(key))}</a>`).join('')

/** Status values are stored in English; only their display is translated. */
const statusLabel = (status, t) => t({
  open: 'statusOpen', scheduled: 'statusScheduled', done: 'statusDone',
}[status] || 'statusOpen')

/** Tables live inside a scroller so a wide one never widens the page itself. */
const wrapTable = (inner, cls = '') =>
  `<div class="tablewrap"><table class="${cls}">${inner}</table></div>`

const levelCell = (code, t) => code
  ? `<span class="pill on">${esc(code)}</span> <span class="muted">${esc(levelShort(code, t))}</span>`
  : `<span class="muted">${esc(t('statusOpen'))}</span>`

export function overview({ club, tournaments, courts, live, t }) {
  return page(t('navOverview'), `
    <h1>${esc(club.name)}</h1>
    <p class="muted">${esc(club.address) || esc(t('noAddress'))}${
      club.maps_url ? ` · <a href="${esc(club.maps_url)}">${esc(t('openInMaps'))}</a>` : ''}</p>
    <div class="grid">
      <div class="card"><h3>${esc(t('courts'))}</h3>
        <p class="muted">${courts.length ? courts.map((c) => esc(c.label)).join(' · ') : esc(t('noneYet'))}</p>
        <div class="actions"><a class="btn ghost" href="/settings">${esc(t('manageCourts'))}</a></div></div>
      <div class="card"><h3>${esc(t('navWhatsapp'))}</h3>
        <p><span class="pill ${live ? 'on' : ''}">${esc(live ? t('live') : t('draftMode'))}</span></p>
        <p class="muted">${esc(live ? t('postingToGroup') : t('draftExplain'))}</p>
        <div class="actions"><a class="btn ghost" href="/whatsapp">${esc(t('open'))}</a></div></div>
    </div>
    <div class="card"><h3>${esc(t('tournaments'))}</h3>
      ${tournaments.length ? wrapTable(`<thead><tr><th>${esc(t('when'))}</th><th>${esc(t('level'))}</th>
        <th class="num">${esc(t('courts'))}</th><th>${esc(t('status'))}</th><th></th></tr></thead><tbody>
      ${tournaments.map((x) => `<tr>
        <td class="lead" data-l="">${esc(humanWhen(x, { lang: t.lang }))}</td>
        <td data-l="${esc(t('level'))}">${levelCell(x.level, t)}</td>
        <td class="num" data-l="${esc(t('courts'))}">${x.courts}</td>
        <td data-l="${esc(t('status'))}"><span class="pill">${esc(statusLabel(x.status, t))}</span></td>
        <td class="full"><a class="tap" href="/t/${x.id}">${esc(t('open'))}</a></td></tr>`).join('')}</tbody>`, 'stack')
        : `<p class="muted">${esc(t('noTournaments'))}</p>`}
      <div class="actions"><a class="btn" href="/tournaments">${esc(t('newTournament'))}</a></div>
    </div>`, { nav: navFor('/', t), t, here: '/' })
}

export function settings({ club, courts, t }) {
  return page(t('settings'), `
    <h1>${esc(t('settings'))}</h1>
    <form class="card" method="post" action="/settings">
      <h3>${esc(t('club'))}</h3>
      <label for="cname">${esc(t('clubName'))}</label>
      <input id="cname" name="name" value="${esc(club.name)}" required>
      <label for="caddr">${esc(t('address'))}</label>
      <input id="caddr" name="address" value="${esc(club.address)}"
        placeholder="R. Gonçalves Zarco 1813, 4450-685 Matosinhos">
      <label for="cmaps">${esc(t('mapsLink'))}</label>
      <input id="cmaps" name="maps_url" type="url" value="${esc(club.maps_url)}"
        placeholder="https://maps.app.goo.gl/…">
      <div class="actions"><button>${esc(t('saveClub'))}</button></div>
    </form>

    <form class="card" method="post" action="/settings">
      <h3>${esc(t('language'))}</h3>
      <p class="muted">${esc(t('languageHelp'))}</p>
      <label for="lang">${esc(t('language'))}</label>
      <select id="lang" name="language">${LANGUAGES.map((l) => `<option value="${l.code}"
        ${l.code === t.lang ? 'selected' : ''}>${esc(l.label)}</option>`).join('')}</select>
      <div class="actions"><button>${esc(t('save'))}</button></div>
    </form>

    <form class="card" method="post" action="/settings">
      <h3>${esc(t('dropoutPolicy'))}</h3>
      <p class="muted">${esc(t('dropoutPolicyHelp'))}</p>
      <label for="rules_en">${esc(t('inEnglish'))}</label>
      <textarea id="rules_en" name="rules_en" style="min-height:96px">${esc(club.rules_en)}</textarea>
      <label for="rules_pt">${esc(t('inPortuguese'))}</label>
      <textarea id="rules_pt" name="rules_pt" style="min-height:96px">${esc(club.rules_pt)}</textarea>
      <div class="actions"><button>${esc(t('save'))}</button></div>
    </form>

    <div class="card">
      <h3>${esc(t('courts'))}</h3>
      <p class="muted">${esc(t('courtsHelp'))}</p>
      ${wrapTable(`<tbody>${courts.map((c) => `<tr><td>${esc(c.label)}</td>
        <td style="text-align:right;width:1%">
        <form method="post" action="/courts/${c.id}/delete">
          <button class="btn danger">${esc(t('remove'))}</button></form>
      </td></tr>`).join('') || `<tr><td class="muted">${esc(t('noCourtsYet'))}</td></tr>`}</tbody>`)}
      <form class="row" method="post" action="/courts" style="margin-top:14px">
        <div><label for="courtlabel">${esc(t('addCourt'))}</label>
          <input id="courtlabel" name="label" placeholder="Court 1 / Center" required></div>
        <div style="flex:0 0 auto"><button>${esc(t('add'))}</button></div>
      </form>
    </div>`, { nav: navFor('/settings', t), t, here: '/settings' })
}

/**
 * The new-tournament form.
 *
 * The level is two pickers rather than a text box, so an invalid one cannot be
 * typed in the first place; the server re-checks anyway, because a form is not a
 * validator, it is a suggestion. The date is a real date input with `min` set to
 * today, and a time beside it — the pair is what the whole app stores now.
 */
export function tournamentsPage({ tournaments, form = {}, error = '', t }) {
  const today = todayISO()
  const cat = form.level_category || 'MX'
  const grade = String(form.level_grade || 4)
  const catOpts = categories(t).map((c) => `<option value="${c.code}" data-label="${esc(c.label)}"
    ${c.code === cat ? 'selected' : ''}>${esc(c.label)} (${c.code})</option>`).join('')
  const gradeOpts = grades(t).map((g) => `<option value="${g.grade}" data-label="${esc(g.label)}"
    data-blurb="${esc(g.blurb)}" ${String(g.grade) === grade ? 'selected' : ''}
    >${g.grade} — ${esc(g.label)}</option>`).join('')
  const cmd = '!tournament non-stop level MX-4 date 2026-09-05 11:00 courts 3 duration 120'

  return page(t('newTournament'), `
    <h1>${esc(t('newTournament'))}</h1>
    <form class="card" method="post" action="/tournaments">
      ${error ? `<p class="err">⚠️ ${esc(error)}</p>` : ''}
      <div class="row">
        <div><label for="level_category">${esc(t('category'))}</label>
          <select id="level_category" name="level_category">${catOpts}</select></div>
        <div><label for="level_grade">${esc(t('skillLevel'))}</label>
          <select id="level_grade" name="level_grade">${gradeOpts}</select></div>
      </div>
      <p class="hint" id="level_preview">${esc(t('levelHintFallback', { n: grades(t).length }))}</p>
      <div class="row">
        <div><label for="play_date">${esc(t('date'))}</label>
          <input id="play_date" name="play_date" type="date" required
            min="${today}" value="${esc(form.play_date || today)}"></div>
        <div><label for="play_time">${esc(t('startTime'))}</label>
          <input id="play_time" name="play_time" type="time"
            value="${esc(form.play_time ?? '19:00')}"></div>
      </div>
      <div class="row">
        <div><label for="courts">${esc(t('courts'))}</label>
          <input id="courts" name="courts" type="number" min="1" max="20"
            value="${esc(form.courts || 3)}"></div>
        <div><label for="duration_min">${esc(t('durationMin'))}</label>
          <input id="duration_min" name="duration_min" type="number" min="10" max="600"
            value="${esc(form.duration_min || 90)}"></div>
        <div><label for="round_min">${esc(t('roundMin'))}</label>
          <input id="round_min" name="round_min" type="number" min="5" max="120"
            value="${esc(form.round_min || 12)}"></div>
      </div>
      <div class="actions"><button>${esc(t('create'))}</button></div>
      <p class="note" style="margin-top:16px">${
        esc(t('botDoesTheSame', { cmd: '\u0000' })).replace('\u0000',
          `<span class="mono">${esc(cmd)}</span>`)}</p>
    </form>
    ${tournaments.map((x) => `<div class="card"><div class="head">
      <div style="min-width:0"><strong>${esc(x.level) || esc(t('statusOpen'))}</strong>
        <span class="muted"> · ${esc(levelShort(x.level, t))}</span><br>
        <span class="muted">${esc(humanWhen(x, { lang: t.lang }))} · ${
          esc(t('courtsN', { n: x.courts }))}</span></div>
      <a class="btn ghost" href="/t/${x.id}">${esc(t('open'))}</a></div></div>`).join('')}
  `, { nav: navFor('/tournaments', t), script: LEVEL_JS, t, here: '/tournaments' })
}

export function tournamentPage({ tournament: tour, teams, waiting, matches, table, message, courts, t }) {
  const rounds = [...new Set(matches.map((m) => m.round))]
  // A mixed level asks every pair to be one of each. The host would otherwise
  // find out at the draw, which is too late to fix by messaging anyone.
  const offLevel = isMixedLevel(tour.level) ? teams.filter((x) => !x.mixed) : []

  return page(`${tour.level || ''} ${humanWhen(tour, { lang: t.lang })}`.trim(), `
    <h1>${esc(tour.level) || esc(t('statusOpen'))} · ${esc(humanWhen(tour, { lang: t.lang }))}</h1>
    <p class="muted">${esc(levelLabel(tour.level, t))}</p>
    <p class="muted">${esc(t('courtsN', { n: tour.courts }))} · ${
      esc(t('minutes', { n: tour.duration_min }))} · ${esc(t('minRounds', { n: tour.round_min }))}
      · <span class="pill">${esc(statusLabel(tour.status, t))}</span>
      · <a href="/t/${tour.id}/tv">${esc(t('tvView'))}</a></p>

    <div class="grid">
      <div class="card"><h3>${esc(t('teams'))} (${teams.length})</h3>
        ${offLevel.length ? `<p class="err">${esc(t('mixedWarning', {
          bad: offLevel.length, total: teams.length,
          verb: t(offLevel.length === 1 ? 'isNotAre' : 'areNotIs'),
          names: offLevel.map((x) => x.name).join(', '),
        }))}</p>` : ''}
        ${wrapTable(`<tbody>${teams.map((x, i) => `<tr><td class="pos">${i + 1}</td>
          <td class="lead">${esc(x.name)}</td>
          <td>${x.mixed ? `<span class="pill on">${esc(t('mixed'))}</span>` : ''}</td></tr>`).join('')
          || `<tr><td class="muted">${esc(t('nobodyYet'))}</td></tr>`}</tbody>`, 'stack')}
        ${waiting.length ? `<h3 style="margin-top:16px">${esc(t('waiting'))} (${waiting.length})</h3>
          ${wrapTable(`<tbody>${waiting.map((p) => `<tr><td class="lead">${esc(p.name)}</td>
            <td class="muted full">${esc(p.partner ? t('waitingOn', { name: p.partner })
              : t('noPartner'))}</td></tr>`).join('')}</tbody>`, 'stack')}` : ''}
      </div>
      <div class="card"><h3>${esc(t('whatsappMessage'))}</h3>
        <pre class="msg">${esc(message)}</pre>
        <div class="actions"><a class="btn ghost" href="/whatsapp">${esc(t('outbox'))}</a></div>
      </div>
    </div>

    <div class="card"><h3>${esc(t('schedule'))}</h3>
      ${matches.length ? rounds.map((r) => `<h4>${esc(t('roundN', { n: r }))}</h4>${wrapTable(
        `<thead><tr><th>${esc(t('court'))}</th><th>${esc(t('home'))}</th><th>${esc(t('away'))}</th>
          <th style="width:180px">${esc(t('score'))}</th></tr></thead>
        <tbody>${matches.filter((m) => m.round === r).map((m) => `<tr>
          <td class="pos full">${esc(m.court)}</td>
          <td class="lead full" data-l="">${esc(m.team_a)}</td>
          <td class="full" data-l="v">${esc(m.team_b)}</td>
          <td class="full"><form class="score" method="post" action="/matches/${m.id}/score">
            <input name="a" type="number" min="0" max="99" inputmode="numeric"
              aria-label="${esc(t('score'))} — ${esc(m.team_a)}" value="${m.score_a ?? ''}">
            <input name="b" type="number" min="0" max="99" inputmode="numeric"
              aria-label="${esc(t('score'))} — ${esc(m.team_b)}" value="${m.score_b ?? ''}">
            <button class="btn ghost">${esc(t('save'))}</button>
          </form></td></tr>`).join('')}</tbody>`, 'stack')}`).join('')
        : `<p class="muted">${esc(t('noSchedule'))}</p>
           <form method="post" action="/t/${tour.id}/schedule"><div class="actions">
             <button ${teams.length < 2 ? 'disabled' : ''}>${esc(t('drawSchedule'))}</button></div></form>
           ${teams.length < 2 ? `<p class="hint">${esc(t('needTwoPairs'))}</p>` : ''}
           ${courts.length ? '' : `<p class="note">${esc(t('addCourtsFirst'))}</p>`}`}
    </div>

    <div class="card"><h3>${esc(t('standings'))}</h3>
      ${wrapTable(`<thead><tr><th>#</th><th>${esc(t('team'))}</th><th class="num">${esc(t('played'))}</th>
        <th class="num">${esc(t('won'))}</th><th class="num">${esc(t('points'))}</th>
        <th class="num">${esc(t('against'))}</th></tr></thead>
      <tbody>${table.map((r, i) => `<tr><td class="pos">${i + 1}</td>
        <td class="lead">${esc(r.team)}</td>
        <td class="num" data-l="${esc(t('played'))}">${r.played}</td>
        <td class="num" data-l="${esc(t('won'))}">${r.won}</td>
        <td class="num" data-l="${esc(t('points'))}"><strong>${r.points}</strong></td>
        <td class="num muted" data-l="${esc(t('against'))}">${r.against}</td></tr>`).join('')
        || `<tr><td class="muted" colspan="6">${esc(t('noResults'))}</td></tr>`}</tbody>`, 'stack')}
    </div>`, { nav: navFor('/tournaments', t), t, here: '/tournaments' })
}

/** Full-screen, high-contrast, self-refreshing — this one is read from ten metres. */
export function tvPage({ tournament: tour, club, matches, table, t }) {
  const rounds = [...new Set(matches.map((m) => m.round))]
  const live = rounds.length ? rounds[0] : null
  return `<!doctype html><html lang="${t.lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="20">
<title>${esc(club.name)} — ${esc(t('live'))}</title><style>${CSS}
body{padding:2vh 3vw}
h1{font-size:clamp(24px,4vw,56px);margin:0;overflow-wrap:anywhere}
.sub{font-size:clamp(13px,1.6vw,24px);color:var(--muted);margin-bottom:2vh}
.tv{display:grid;grid-template-columns:1.2fr 1fr;gap:2vw}
.tv table{font-size:clamp(14px,1.7vw,26px)}
.tv th{font-size:clamp(11px,1vw,15px)}
.court{font-weight:800;color:var(--accent)}
.pos{font-weight:800;color:var(--brand);width:2ch}
/* A phone held up in the clubhouse gets the same board, one panel under the other. */
@media (max-width:760px){.tv{grid-template-columns:1fr;gap:12px}body{padding:14px}}
</style></head><body>
<h1>${esc(club.name)} — ${esc(levelShort(tour.level, t))}</h1>
<div class="sub">${esc(humanWhen(tour, { lang: t.lang, tbc: '' }))} · ${
  esc(t('minRounds', { n: tour.round_min }))}${live ? ` · ${esc(t('roundN', { n: live }))}` : ''}</div>
<div class="tv">
  <div><h2>${esc(t('nowOnCourt'))}</h2><div class="tablewrap"><table>
    ${matches.filter((m) => m.round === live).map((m) => `<tr>
      <td class="court">${esc(m.court)}</td><td>${esc(m.team_a)}</td>
      <td class="muted">v</td><td>${esc(m.team_b)}</td></tr>`).join('')
      || `<tr><td class="muted">${esc(t('notDrawn'))}</td></tr>`}
  </table></div></div>
  <div><h2>${esc(t('standings'))}</h2><div class="tablewrap"><table>
    ${table.slice(0, 10).map((r, i) => `<tr><td class="pos">${i + 1}</td><td>${esc(r.team)}</td>
      <td class="num"><strong>${r.points}</strong></td></tr>`).join('')
      || `<tr><td class="muted">${esc(t('noResults'))}</td></tr>`}
  </table></div></div>
</div></body></html>`
}

export function whatsappPage({ live, outbox, log, t }) {
  return page(t('navWhatsapp'), `
    <h1>${esc(t('navWhatsapp'))}</h1>
    <p><span class="pill ${live ? 'on' : ''}">${esc(live ? t('live') : t('draftMode'))}</span></p>
    ${live ? '' : `<p class="note">${esc(t('draftNote'))}</p>`}
    <div class="card"><h3>${esc(t('tryCommand'))}</h3>
      <form method="post" action="/whatsapp/simulate">
        <label for="watext">${esc(t('message'))}</label>
        <input id="watext" name="text" class="mono" placeholder="!in Mike M partner Sofia" required>
        <label for="waid">${esc(t('fromOptional'))}</label>
        <input id="waid" name="wa_id" inputmode="tel" placeholder="+351…">
        <div class="actions"><button>${esc(t('sendToBot'))}</button></div>
      </form>
      ${log ? `<h3 style="margin-top:18px">${esc(t('reply'))}</h3><pre class="msg">${esc(log)}</pre>` : ''}
    </div>
    <div class="card"><h3>${esc(t('outboxTitle'))}</h3>
      ${outbox.length ? outbox.map((m) => `<pre class="msg" style="margin-bottom:12px">${esc(m.text)}</pre>`).join('')
        : `<p class="muted">${esc(t('nothingWaiting'))}</p>`}
    </div>`, { nav: navFor('/whatsapp', t), t, here: '/whatsapp' })
}

export const _internal = { esc, parseLevel, statusLabel }
