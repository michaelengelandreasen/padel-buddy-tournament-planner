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
import { clock, humanWhen, todayISO } from './dates.js'
import { courtsByTeam, currentRound, roundPlan, roundsOf } from './rounds.js'
import { LANGUAGES, translator } from './i18n.js'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

/**
 * The icon set: one stroke, one weight, one grid, drawn once per page as a
 * sprite and referenced by name. Every icon means one thing across the whole
 * console — a court is always this court, "post" is always the megaphone — so
 * a captain who has learned a screen has learned all of them.
 */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>'
    + '<path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>'
    + '<path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>'
    + '<path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  sliders: '<path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3"/>'
    + '<path d="M14 2v4M8 10v4M16 18v4"/>',
  chats: '<path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z"/>'
    + '<path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/>',
  chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  court: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M12 5v14"/>'
    + '<path d="M2 12h4M18 12h4"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>'
    + '<path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  hourglass: '<path d="M5 22h14M5 2h14"/>'
    + '<path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/>'
    + '<path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
  calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/>'
    + '<path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/>'
    + '<path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  shuffle: '<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/>'
    + '<path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/>'
    + '<path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>'
    + '<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  tv: '<rect width="20" height="15" x="2" y="7" rx="2"/><path d="m17 2-5 5-5-5"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>'
    + '<path d="M2 12h20"/>',
  doc: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>'
    + '<path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8M16 13H8M16 17H8"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  terminal: '<path d="m4 17 6-6-6-6"/><path d="M12 19h8"/>',
  coffee: '<path d="M10 2v2M14 2v2M6 2v2"/>'
    + '<path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
  board: '<rect width="8" height="4" x="8" y="2" rx="1"/>'
    + '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>'
    + '<path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/>',
  compass: '<path d="M3 11 22 2l-9 19-2-8-8-2Z"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>'
    + '<path d="M12 9v4M12 17h.01"/>',
  level: '<path d="M3 20h18"/><path d="M6 16v-4M12 16V8M18 16V4"/>',
  timer: '<path d="M10 2h4"/><path d="M12 14v-4"/><circle cx="12" cy="14" r="8"/>',
}
// `hidden` alone is not enough: the UA stylesheet hides hidden HTML elements, and an
// <svg> is not one, so without the inline style the sprite paints as a blank box.
const SPRITE = `<svg hidden aria-hidden="true" style="display:none">${Object.entries(ICONS).map(([k, d]) =>
  `<symbol id="i-${k}" viewBox="0 0 24 24">${d}</symbol>`).join('')}</svg>`

/** An icon next to a word. Decorative: the word carries the meaning, the icon speeds it up. */
const ic = (name, cls = '') => `<svg class="i${cls ? ` ${cls}` : ''}" aria-hidden="true"><use href="#i-${name}"/></svg>`

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
a{color:var(--brand);text-underline-offset:3px} h1,h2,h3{line-height:1.2;margin:0 0 .5rem}
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
nav a{display:inline-flex;align-items:center;gap:7px;min-height:44px;padding:0 12px;
  border-radius:999px;text-decoration:none;color:var(--muted);font-weight:600;white-space:nowrap}
nav a:hover{color:var(--ink)}
nav a.on{color:var(--ink);background:var(--surface-2)}
nav a.on .i{color:var(--brand)}
form.lang{display:flex;gap:2px;flex:0 0 auto;margin-left:8px}
form.lang button{background:transparent;color:var(--muted);border:1px solid transparent;
  min-height:44px;padding:0 10px;font-size:.82rem;font-weight:800;letter-spacing:.03em}
form.lang button.on{color:var(--brand-ink);background:var(--brand)}

.i{width:1.1em;height:1.1em;flex:0 0 auto;fill:none;stroke:currentColor;stroke-width:2;
  stroke-linecap:round;stroke-linejoin:round;vertical-align:-.18em}
h3 .i,h2 .i{width:20px;height:20px;color:var(--muted);margin-right:.4em;vertical-align:-.22em}
button .i,.btn .i,nav a .i{width:18px;height:18px}
.meta{display:flex;flex-wrap:wrap;gap:6px 16px;align-items:center;color:var(--muted);margin:0 0 .5rem}
.meta>span,.meta>a{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.meta .i{width:16px;height:16px}
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
::selection{background:var(--brand);color:var(--brand-ink)}
input,textarea{caret-color:var(--brand)}
:focus-visible{outline:2px solid var(--brand);outline-offset:2px}
textarea{min-height:120px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.86rem}
button,.btn{appearance:none;border:0;border-radius:999px;padding:11px 20px;font:inherit;
  min-height:44px;font-weight:700;background:var(--brand);color:var(--brand-ink);cursor:pointer;
  text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:8px}
button:disabled{opacity:.45;cursor:not-allowed}
button:not(:disabled):hover,.btn:hover{filter:brightness(1.08)}
button:not(:disabled):active,.btn:active{transform:translateY(1px)}
.btn.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}
.btn.ghost:hover{background:var(--surface-2);filter:none}
/* A secondary action that lives next to a heading: reads as text, taps like a button. */
button.link{background:transparent;color:var(--muted);border:0;padding:0 8px;font-weight:600;
  text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--line)}
button.link:hover{color:var(--ink);filter:none;text-decoration-color:var(--muted)}
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
.note{padding:10px 14px;background:color-mix(in oklab,var(--accent) 8%,var(--surface-2));
  border:1px solid color-mix(in oklab,var(--accent) 28%,var(--line));border-radius:10px;
  color:var(--muted);font-size:.9rem;overflow-wrap:anywhere}
.err{padding:10px 14px;background:color-mix(in oklab,var(--warn) 12%,var(--surface));
  border:1px solid color-mix(in oklab,var(--warn) 40%,var(--line));border-radius:10px;
  color:var(--ink);font-size:.92rem;margin:0 0 8px}
/*
 * What happened when the host pressed "post". The one authored motion on the
 * site: it settles in from just above, because it is the answer to an action
 * the host took a moment ago, and a status that simply appears reads as if it
 * had always been there.
 */
.flash{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline;margin:0 0 12px;
  padding:10px 14px;border-radius:10px;font-size:.9rem;
  background:color-mix(in oklab,var(--brand) 10%,var(--surface-2));
  border:1px solid color-mix(in oklab,var(--brand) 35%,var(--line));
  animation:settle .28s cubic-bezier(.2,.8,.2,1) both}
.flash strong{color:var(--brand)}
.flash.bad{background:color-mix(in oklab,var(--warn) 12%,var(--surface));
  border-color:color-mix(in oklab,var(--warn) 40%,var(--line))}
.flash.bad strong{color:var(--warn)}
@keyframes settle{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.flash{animation:none}}
.hint{color:var(--muted);font-size:.82rem;margin:6px 0 0}
pre.msg{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--surface-2);
  border:1px solid var(--line);border-radius:12px;padding:14px;font-size:.9rem;margin:0}
/*
 * One match, one form. The score box sits on its team's own line rather than
 * beside the other team's — recording 11-5 from the side of a court should not
 * need working out which box is whose. Save spans both lines on the right,
 * because it belongs to the pair of them.
 */
.match{display:grid;grid-template-columns:1fr auto;gap:8px 14px;align-items:center;
  background:var(--surface-2);border:1px solid var(--line);border-radius:12px;
  padding:12px 14px;margin:10px 0}
.match .court{grid-column:1/-1;display:flex;align-items:center;gap:6px;font-weight:800;
  color:var(--accent);font-size:.74rem;text-transform:uppercase;letter-spacing:.05em}
.match .court .i{width:16px;height:16px}
.match .sides{min-width:0}
.match .side{display:flex;align-items:center;gap:12px;padding:7px 0}
.match .side+.side{border-top:1px solid var(--line)}
.match .who{flex:1 1 auto;min-width:0;margin:0;font-size:1rem;font-weight:600;
  color:var(--ink);overflow-wrap:anywhere;cursor:pointer}
/*
 * The score box has to read as a box from arm's length on a phone: it sits on
 * the darkest ground the palette has, inside a border strong enough to be an
 * edge rather than a hairline, and it is the tallest thing on its line. Empty
 * shows a dash so a missing score looks missing; a typed number is big and bold.
 */
.match input{flex:0 0 76px;width:76px;min-height:50px;text-align:center;padding:6px 4px;
  background:var(--bg);border:2px solid color-mix(in oklab,var(--muted) 45%,var(--line));
  border-radius:12px;font-size:1.25rem;font-weight:800;font-variant-numeric:tabular-nums;
  box-shadow:inset 0 1px 2px rgba(0,0,0,.45);transition:border-color .15s ease-out}
.match input::placeholder{color:var(--muted);font-weight:600;opacity:1}
.match input:hover{border-color:var(--muted)}
.match input:focus{border-color:var(--brand);outline:none;
  box-shadow:0 0 0 3px color-mix(in oklab,var(--brand) 30%,transparent),inset 0 1px 2px rgba(0,0,0,.45)}
/* A box that already holds a score wears it plainly; the border no longer needs to shout. */
.match input:not(:placeholder-shown){border-color:color-mix(in oklab,var(--brand) 55%,var(--line))}
.match button{padding:8px 18px}
@media (max-width:480px){
  .match{grid-template-columns:1fr}
  .match button{width:100%}
}
/* A round's heading and its "post to the groups" button share a line, and wrap
   onto two on a phone rather than squeezing the button into an unreadable box. */
.roundhead{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:22px 0 4px}
.roundhead h4{margin:0;flex:1 1 auto;font-size:1rem}
.roundhead form{flex:0 0 auto}
.roundhead button{white-space:nowrap}
.head{display:flex;gap:12px;align-items:center;flex-wrap:wrap;justify-content:space-between}

/*
 * On a phone the nav becomes a tab bar under the thumb. Four labelled items no
 * longer fit across the top of a 390px screen once they carry icons, and a
 * scrolling top strip hides whichever tab you are not on; a bottom bar shows all
 * four, always, and puts them where a hand already is.
 */
@media (max-width:720px){
  .wrap{padding:16px 14px calc(72px + env(safe-area-inset-bottom))}
  header.top{padding:8px 12px}
  nav{position:fixed;left:0;right:0;bottom:0;z-index:6;margin:0;width:auto;gap:0;
    display:grid;grid-template-columns:repeat(4,1fr);overflow:visible;
    background:var(--surface);border-top:1px solid var(--line);
    padding:6px 6px calc(6px + env(safe-area-inset-bottom))}
  nav a{flex-direction:column;justify-content:center;gap:3px;min-height:52px;padding:4px 2px;
    border-radius:10px;font-size:.68rem;font-weight:700;letter-spacing:.01em}
  nav a .i{width:22px;height:22px}
  nav a.on{background:transparent;color:var(--brand)}
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
${SPRITE}
<div class="wrap">${body}</div>${script ? `<script>${script}</script>` : ''}</body></html>`
}

const navFor = (here, t) => [['/', 'navOverview', 'home'], ['/tournaments', 'navTournaments', 'trophy'],
  ['/settings', 'navSettings', 'sliders'], ['/groups', 'navGroups', 'chats']]
  .map(([h, key, icon]) => `<a class="${here === h ? 'on' : ''}" href="${h}"${
    here === h ? ' aria-current="page"' : ''}>${ic(icon)}<span>${esc(t(key))}</span></a>`).join('')

/** Status values are stored in English; only their display is translated. */
const statusLabel = (status, t) => t({
  open: 'statusOpen', scheduled: 'statusScheduled', done: 'statusDone',
}[status] || 'statusOpen')

/** Tables live inside a scroller so a wide one never widens the page itself. */
const wrapTable = (inner, cls = '') =>
  `<div class="tablewrap"><table class="${cls}">${inner}</table></div>`

/**
 * One match as a form: the court, then a line per team with that team's box on
 * it, then Save. Each name is the input's own <label>, so the accessible name is
 * the team rather than "Score", and tapping a name focuses its box.
 */
const matchForm = (m, t) => `<form class="match" method="post" action="/matches/${m.id}/score">
  <div class="court">${ic('court')} ${esc(m.court)}</div>
  <div class="sides">
    ${[['a', m.team_a, m.score_a], ['b', m.team_b, m.score_b]].map(([side, team, score]) => `
    <div class="side">
      <label class="who" for="m${m.id}${side}">${esc(team)}</label>
      <input id="m${m.id}${side}" name="${side}" type="number" min="0" max="99"
        inputmode="numeric" placeholder="–" value="${score ?? ''}">
    </div>`).join('')}
  </div>
  <button class="btn ghost">${ic('check')}${esc(t('save'))}</button>
</form>`

const levelCell = (code, t) => code
  ? `<span class="pill on">${esc(code)}</span> <span class="muted">${esc(levelShort(code, t))}</span>`
  : `<span class="muted">${esc(t('statusOpen'))}</span>`

export function overview({ club, tournaments, courts, live, t }) {
  return page(t('navOverview'), `
    <h1>${esc(club.name)}</h1>
    <p class="meta"><span>${ic('pin')}${esc(club.address) || esc(t('noAddress'))}</span>${
      club.maps_url ? `<a href="${esc(club.maps_url)}">${esc(t('openInMaps'))}${ic('arrow')}</a>` : ''}</p>
    <div class="grid">
      <div class="card"><h3>${ic('court')}${esc(t('courts'))}</h3>
        <p class="muted">${courts.length ? courts.map((c) => esc(c.label)).join(' · ') : esc(t('noneYet'))}</p>
        <div class="actions"><a class="btn ghost" href="/settings">${ic('sliders')}${esc(t('manageCourts'))}</a></div></div>
      <div class="card"><h3>${ic('chats')}${esc(t('navGroups'))}</h3>
        <p><span class="pill ${live ? 'on' : ''}">${esc(live ? t('live') : t('draftMode'))}</span></p>
        <p class="muted">${esc(live ? t('postingToGroup') : t('draftExplain'))}</p>
        <div class="actions"><a class="btn ghost" href="/groups">${esc(t('open'))}${ic('arrow')}</a></div></div>
    </div>
    <div class="card"><h3>${ic('trophy')}${esc(t('tournaments'))}</h3>
      ${tournaments.length ? wrapTable(`<thead><tr><th>${esc(t('when'))}</th><th>${esc(t('level'))}</th>
        <th class="num">${esc(t('courts'))}</th><th>${esc(t('status'))}</th><th></th></tr></thead><tbody>
      ${tournaments.map((x) => `<tr>
        <td class="lead" data-l="">${esc(humanWhen(x, { lang: t.lang }))}</td>
        <td data-l="${esc(t('level'))}">${levelCell(x.level, t)}</td>
        <td class="num" data-l="${esc(t('courts'))}">${x.courts}</td>
        <td data-l="${esc(t('status'))}"><span class="pill">${esc(statusLabel(x.status, t))}</span></td>
        <td class="full"><a class="tap" href="/t/${x.id}">${esc(t('open'))} ${ic('arrow')}</a></td></tr>`).join('')}</tbody>`, 'stack')
        : `<p class="muted">${esc(t('noTournaments'))}</p>`}
      <div class="actions"><a class="btn" href="/tournaments">${ic('plus')}${esc(t('newTournament'))}</a></div>
    </div>`, { nav: navFor('/', t), t, here: '/' })
}

export function settings({ club, courts, t }) {
  return page(t('settings'), `
    <h1>${esc(t('settings'))}</h1>
    <form class="card" method="post" action="/settings">
      <h3>${ic('flag')}${esc(t('club'))}</h3>
      <label for="cname">${esc(t('clubName'))}</label>
      <input id="cname" name="name" value="${esc(club.name)}" required>
      <label for="caddr">${esc(t('address'))}</label>
      <input id="caddr" name="address" value="${esc(club.address)}"
        placeholder="R. Gonçalves Zarco 1813, 4450-685 Matosinhos">
      <label for="cmaps">${esc(t('mapsLink'))}</label>
      <input id="cmaps" name="maps_url" type="url" value="${esc(club.maps_url)}"
        placeholder="https://maps.app.goo.gl/…">
      <div class="actions"><button>${ic('check')}${esc(t('saveClub'))}</button></div>
    </form>

    <form class="card" method="post" action="/settings">
      <h3>${ic('globe')}${esc(t('language'))}</h3>
      <p class="muted">${esc(t('languageHelp'))}</p>
      <label for="lang">${esc(t('language'))}</label>
      <select id="lang" name="language">${LANGUAGES.map((l) => `<option value="${l.code}"
        ${l.code === t.lang ? 'selected' : ''}>${esc(l.label)}</option>`).join('')}</select>
      <div class="actions"><button>${esc(t('save'))}</button></div>
    </form>

    <form class="card" method="post" action="/settings">
      <h3>${ic('doc')}${esc(t('dropoutPolicy'))}</h3>
      <p class="muted">${esc(t('dropoutPolicyHelp'))}</p>
      <label for="rules_en">${esc(t('inEnglish'))}</label>
      <textarea id="rules_en" name="rules_en" style="min-height:96px">${esc(club.rules_en)}</textarea>
      <label for="rules_pt">${esc(t('inPortuguese'))}</label>
      <textarea id="rules_pt" name="rules_pt" style="min-height:96px">${esc(club.rules_pt)}</textarea>
      <div class="actions"><button>${esc(t('save'))}</button></div>
    </form>

    <div class="card">
      <h3>${ic('court')}${esc(t('courts'))}</h3>
      <p class="muted">${esc(t('courtsHelp'))}</p>
      ${wrapTable(`<tbody>${courts.map((c) => `<tr><td>${esc(c.label)}</td>
        <td style="text-align:right;width:1%">
        <form method="post" action="/courts/${c.id}/delete">
          <button class="btn danger">${ic('trash')}${esc(t('remove'))}</button></form>
      </td></tr>`).join('') || `<tr><td class="muted">${esc(t('noCourtsYet'))}</td></tr>`}</tbody>`)}
      <form class="row" method="post" action="/courts" style="margin-top:14px">
        <div><label for="courtlabel">${esc(t('addCourt'))}</label>
          <input id="courtlabel" name="label" placeholder="Court 1 / Center" required></div>
        <div style="flex:0 0 auto"><button>${ic('plus')}${esc(t('add'))}</button></div>
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
      ${error ? `<p class="err">${ic('alert')} ${esc(error)}</p>` : ''}
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
      <div class="actions"><button>${ic('plus')}${esc(t('create'))}</button></div>
      <p class="note" style="margin-top:16px">${
        esc(t('botDoesTheSame', { cmd: '\u0000' })).replace('\u0000',
          `<span class="mono">${esc(cmd)}</span>`)}</p>
    </form>
    ${tournaments.map((x) => `<div class="card"><div class="head">
      <div style="min-width:0"><strong>${esc(x.level) || esc(t('statusOpen'))}</strong>
        <span class="muted"> · ${esc(levelShort(x.level, t))}</span><br>
        <span class="muted">${esc(humanWhen(x, { lang: t.lang }))} · ${
          esc(t('courtsN', { n: x.courts }))}</span></div>
      <a class="btn ghost" href="/t/${x.id}">${esc(t('open'))}${ic('arrow')}</a></div></div>`).join('')}
  `, { nav: navFor('/tournaments', t), script: LEVEL_JS, t, here: '/tournaments' })
}

/**
 * The outcome of a manual post, as the host reads it a second later.
 *
 * Telegram either took it, edited the pinned board, or said why not; WhatsApp is
 * always "in the outbox", because that is all it can ever be. Saying both is the
 * point — "posted" on its own would let a host believe the WhatsApp group heard.
 */
export function flashLine(flash, t) {
  if (!flash) return ''
  const bits = []
  if (flash.tg === 'ok') bits.push(`<strong>${esc(t('sentTelegram'))}</strong>`)
  if (flash.tg === 'edit') bits.push(`<strong>${esc(t('sentTelegramEdited'))}</strong>`)
  if (flash.tg === 'err') bits.push(`<strong>${esc(t('sendFailed', { error: flash.err || '' }))}</strong>`)
  if (flash.tg === 'wait') bits.push(`<strong>${esc(t('telegramWaiting'))}</strong>`)
  bits.push(bits.length
    ? `<span>${esc(t('sentDraft'))}</span>`
    : `<strong>${esc(t('sentDraft'))}</strong><a href="/groups">${esc(t('outbox'))} →</a>`)
  return `<div class="flash ${flash.tg === 'err' ? 'bad' : ''}" role="status">${bits.join('')}</div>`
}

export function tournamentPage({
  tournament: tour, teams, waiting, matches, table, message, roundText, courts, flash, t,
}) {
  const rounds = roundsOf(matches)
  const now = currentRound(matches)
  const flashFor = (what) => (flash && flash.what === what ? flashLine(flash, t) : '')
  // A mixed level asks every pair to be one of each. The host would otherwise
  // find out at the draw, which is too late to fix by messaging anyone.
  const offLevel = isMixedLevel(tour.level) ? teams.filter((x) => !x.mixed) : []

  return page(`${tour.level || ''} ${humanWhen(tour, { lang: t.lang })}`.trim(), `
    <h1>${esc(tour.level) || esc(t('statusOpen'))} · ${esc(humanWhen(tour, { lang: t.lang }))}</h1>
    <p class="muted">${esc(levelLabel(tour.level, t))}</p>
    <p class="meta">
      <span>${ic('court')}${esc(t('courtsN', { n: tour.courts }))}</span>
      <span>${ic('clock')}${esc(t('minutes', { n: tour.duration_min }))}</span>
      <span>${ic('repeat')}${esc(t('minRounds', { n: tour.round_min }))}</span>
      <span class="pill">${esc(statusLabel(tour.status, t))}</span>
      <a href="/t/${tour.id}/tv">${ic('tv')}${esc(t('tvView'))}</a></p>

    <div class="grid">
      <div class="card"><h3>${ic('users')}${esc(t('teams'))} (${teams.length})</h3>
        ${offLevel.length ? `<p class="err">${esc(t('mixedWarning', {
          bad: offLevel.length, total: teams.length,
          verb: t(offLevel.length === 1 ? 'isNotAre' : 'areNotIs'),
          names: offLevel.map((x) => x.name).join(', '),
        }))}</p>` : ''}
        ${wrapTable(`<tbody>${teams.map((x, i) => `<tr><td class="pos">${i + 1}</td>
          <td class="lead">${esc(x.name)}</td>
          <td>${x.mixed ? `<span class="pill on">${esc(t('mixed'))}</span>` : ''}</td></tr>`).join('')
          || `<tr><td class="muted">${esc(t('nobodyYet'))}</td></tr>`}</tbody>`, 'stack')}
        ${waiting.length ? `<h3 style="margin-top:16px">${ic('hourglass')}${esc(t('waiting'))} (${waiting.length})</h3>
          ${wrapTable(`<tbody>${waiting.map((p) => `<tr><td class="lead">${esc(p.name)}</td>
            <td class="muted full">${esc(p.partner ? t('waitingOn', { name: p.partner })
              : t('noPartner'))}</td></tr>`).join('')}</tbody>`, 'stack')}` : ''}
      </div>
      <div class="card"><h3>${ic('board')}${esc(t('signupBoard'))}</h3>
        ${flashFor('board')}
        <pre class="msg">${esc(message)}</pre>
        <div class="actions">
          <form method="post" action="/t/${tour.id}/post">
            <button>${ic('megaphone')}${esc(t('postToGroups'))}</button></form>
          <a class="btn ghost" href="/groups">${ic('inbox')}${esc(t('outbox'))}</a>
        </div>
      </div>
    </div>

    ${roundText ? `<div class="card"><h3>${ic('compass')}${esc(t('roundTitle'))} <span class="pill on">${
      esc(t('roundN', { n: now }))}</span></h3>
      <p class="muted">${esc(t('roundHelp'))}</p>
      ${flashFor(`round-${now}`)}
      <pre class="msg">${esc(roundText)}</pre>
      <div class="actions">
        <form method="post" action="/t/${tour.id}/post">
          <input type="hidden" name="round" value="${now}">
          <button>${ic('megaphone')}${esc(t('postToGroups'))}</button></form>
      </div>
    </div>` : ''}

    <div class="card"><h3>${ic('list')}${esc(t('schedule'))}</h3>
      ${matches.length ? rounds.map((r) => `<div class="roundhead">
        <h4>${esc(t('roundN', { n: r }))}${r === now ? ` <span class="pill on">${esc(t('nowShort'))}</span>` : ''}</h4>
        <form method="post" action="/t/${tour.id}/post">
          <input type="hidden" name="round" value="${r}">
          <button class="link">${esc(t('postRound', { n: r }))}</button></form>
      </div>${
        matches.filter((m) => m.round === r).map((m) => matchForm(m, t)).join('')}`).join('')
        : `<p class="muted">${esc(t('noSchedule'))}</p>
           <form method="post" action="/t/${tour.id}/schedule"><div class="actions">
             <button ${teams.length < 2 ? 'disabled' : ''}>${ic('shuffle')}${esc(t('drawSchedule'))}</button></div></form>
           ${teams.length < 2 ? `<p class="hint">${esc(t('needTwoPairs'))}</p>` : ''}
           ${courts.length ? '' : `<p class="note">${esc(t('addCourtsFirst'))}</p>`}`}
    </div>

    <div class="card"><h3>${ic('trophy')}${esc(t('standings'))}</h3>
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
/**
 * The clubhouse screen: the round being played, court by court, where every
 * pair goes next, and the table.
 *
 * Read from four metres away between points, so the court name is the biggest
 * thing on the line and nothing needs a second glance. It refreshes itself, and
 * it follows the scores: the last result of a round is what moves it on, which
 * is the same signal that sends the round message to the groups.
 */
export function tvPage({ tournament: tour, club, teams, matches, table, t }) {
  const rounds = roundsOf(matches)
  const round = currentRound(matches)
  const plan = rounds.length ? roundPlan({ tournament: tour, matches, teams, round }) : null
  const last = round === rounds[rounds.length - 1]
  const from = plan ? clock(plan.start, { lang: t.lang }) : ''
  const to = plan ? clock(plan.end, { lang: t.lang }) : ''
  const nextCourts = plan && !last ? courtsByTeam(matches, round + 1) : null
  const goes = nextCourts ? teams.map((x) => ({ name: x.name, court: nextCourts.get(x.name) || '' }))
    .sort((a, b) => Number(!a.court) - Number(!b.court)
      || String(a.court).localeCompare(String(b.court), undefined, { numeric: true })
      || a.name.localeCompare(b.name)) : []

  return `<!doctype html><html lang="${t.lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="20">
<title>${esc(club.name)} — ${esc(t('live'))}</title><style>${CSS}
.court .i{width:1em;height:1em;margin-right:.3em;vertical-align:-.12em}
.rest .i,.final .i{width:1.1em;height:1.1em;margin-right:.35em}
.tv h2 .i{width:1em;height:1em}
body{padding:2.5vh 3vw;min-height:100vh}
.tvhead{display:flex;flex-wrap:wrap;align-items:baseline;gap:.4em 1.2em;margin-bottom:2vh}
h1{font-size:clamp(22px,3.2vw,44px);margin:0;overflow-wrap:anywhere}
.sub{font-size:clamp(13px,1.4vw,22px);color:var(--muted)}
.tv{display:grid;grid-template-columns:1.25fr 1fr;gap:2.5vw;align-items:start}
.tv h2{display:flex;flex-wrap:wrap;align-items:center;gap:.3em .6em;
  font-size:clamp(16px,1.8vw,28px);margin:0 0 .5em}
.tv h2 .i{margin:0}
.tv h2 .when{color:var(--muted);font-weight:600;font-size:.72em;font-variant-numeric:tabular-nums}
.tv table{font-size:clamp(14px,1.7vw,26px);margin:0}
.tv td{padding:.45em .6em;border-bottom:1px solid var(--line)}
.court{font-weight:800;color:var(--accent);white-space:nowrap;width:1%}
.vs{color:var(--muted);font-size:.8em;text-align:center;width:1%;padding:0 .2em}
.pos{font-weight:800;color:var(--brand);width:2ch;font-variant-numeric:tabular-nums}
.rest{color:var(--muted);font-size:clamp(13px,1.4vw,22px);margin:.6em 0 0;padding:0 .6em}
.next{margin-top:2.2vh}
.next td.court{color:var(--ink)}
.next tr.off td{color:var(--muted)}
.final{color:var(--muted);font-size:clamp(14px,1.5vw,24px);margin-top:2vh;padding:0 .6em}
/* A phone held up in the clubhouse gets the same board, one panel under the other. */
@media (max-width:760px){.tv{grid-template-columns:1fr;gap:18px}body{padding:14px}}
</style></head><body>
${SPRITE}
<div class="tvhead"><h1>${esc(club.name)} — ${esc(levelShort(tour.level, t))}</h1>
<span class="sub">${esc(humanWhen(tour, { lang: t.lang, tbc: '' }))} · ${
  esc(t('minRounds', { n: tour.round_min }))}</span></div>
<div class="tv">
  <div>
    <h2>${plan ? esc(t('roundOfN', { n: round, total: rounds.length })) : esc(t('nowOnCourt'))}${
      from && to ? `<span class="when">${esc(from)} → ${esc(to)}</span>` : ''}</h2>
    <div class="tablewrap"><table>
    ${plan ? plan.games.map((m) => `<tr>
      <td class="court">${ic('court')}${esc(m.court)}</td><td>${esc(m.team_a)}</td>
      <td class="vs">${esc(t('vsShort'))}</td><td>${esc(m.team_b)}</td></tr>`).join('')
      : `<tr><td class="muted">${esc(t('notDrawn'))}</td></tr>`}
    </table></div>
    ${plan && plan.resting.length
      ? `<p class="rest">${ic('coffee')}${esc(t('sittingOut'))}: ${esc(plan.resting.join(', '))}</p>` : ''}
    ${goes.length ? `<div class="next">
      <h2>${ic('compass')}${esc(t('nextRoundAt', { n: round + 1, at: to || '—' }))}</h2>
      <div class="tablewrap"><table>
      ${goes.map((g) => `<tr class="${g.court ? '' : 'off'}">
        <td class="court">${g.court ? ic('court') : ic('coffee')}${esc(g.court || t('sittingOut'))}</td><td>${esc(g.name)}</td></tr>`).join('')}
      </table></div></div>` : ''}
    ${plan && last ? `<p class="final">${ic('trophy')}${esc(t('lastRoundNote'))}</p>` : ''}
  </div>
  <div><h2>${ic('trophy')}${esc(t('standings'))}</h2><div class="tablewrap"><table>
    ${table.slice(0, 12).map((r, i) => `<tr><td class="pos">${i + 1}</td><td>${esc(r.team)}</td>
      <td class="num"><strong>${r.points}</strong></td></tr>`).join('')
      || `<tr><td class="muted">${esc(t('noResults'))}</td></tr>`}
  </table></div></div>
</div></body></html>`
}

/**
 * Both group chats, side by side, and honest about the difference between them.
 *
 * Telegram posts by itself; WhatsApp cannot, and pretending otherwise would have
 * a host believe a message went out when it is sitting in a list waiting to be
 * pasted. So each channel says what it actually did with the last message.
 */
export function groupsPage({ groups, chat, log, t }) {
  const tg = groups.telegram
  const tgState = !tg ? t('telegramOff') : (chat ? t('telegramOn', { chat }) : t('telegramWaiting'))
  const tgPill = !tg ? t('offline') : (chat ? t('live') : t('waitingForGroup'))

  return page(t('groups'), `
    <h1>${esc(t('groups'))}</h1>

    <div class="grid">
      <div class="card"><h3>${ic('send')}${esc(t('telegramGroup'))}
        <span class="pill ${tg && chat ? 'on' : ''}">${esc(tgPill)}</span></h3>
        <p class="muted">${esc(tgState)}</p>
        <p class="note">${esc(t('telegramHelp'))}</p>
      </div>
      <div class="card"><h3>${ic('chat')}${esc(t('whatsappGroup'))}
        <span class="pill">${esc(t('draftMode'))}</span></h3>
        <p class="note">${esc(t('draftNote'))}</p>
      </div>
    </div>

    <div class="card"><h3>${ic('terminal')}${esc(t('tryCommand'))}</h3>
      <form method="post" action="/groups/simulate">
        <label for="watext">${esc(t('message'))}</label>
        <input id="watext" name="text" class="mono" placeholder="!where Mike" required>
        <label for="waid">${esc(t('fromOptional'))}</label>
        <input id="waid" name="wa_id" inputmode="tel" placeholder="+351…">
        <div class="actions"><button>${ic('send')}${esc(t('sendToBot'))}</button></div>
      </form>
      ${log ? `<h3 style="margin-top:18px">${esc(t('reply'))}</h3><pre class="msg">${esc(log)}</pre>` : ''}
    </div>
    <div class="card"><h3>${ic('inbox')}${esc(t('outboxTitle'))}</h3>
      ${groups.outbox().length
        ? groups.outbox().map((m) => `<pre class="msg" style="margin-bottom:12px">${esc(m.text)}</pre>`).join('')
        : `<p class="muted">${esc(t('nothingWaiting'))}</p>`}
    </div>`, { nav: navFor('/groups', t), t, here: '/groups' })
}

export const _internal = { esc, parseLevel, statusLabel }
