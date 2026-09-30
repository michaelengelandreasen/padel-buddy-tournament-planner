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
import { clock, humanWhen, todayISO, humanDate } from './dates.js'
import { courtName, courtsByTeam, currentRound, roundComplete, roundPlan, roundsOf } from './rounds.js'
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
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  up: '<path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/>',
  down: '<path d="M22 17 13.5 8.5 8.5 13.5 2 7"/><path d="M16 17h6v-6"/>',
  scale: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/>'
    + '<path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
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
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  grip: '<circle cx="9" cy="5" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="9" cy="19" r="1.6"/>'
    + '<circle cx="15" cy="5" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="15" cy="19" r="1.6"/>',
}
// `hidden` alone is not enough: the UA stylesheet hides hidden HTML elements, and an
// <svg> is not one, so without the inline style the sprite paints as a blank box.
const SPRITE = `<svg hidden aria-hidden="true" style="display:none">${Object.entries(ICONS).map(([k, d]) =>
  `<symbol id="i-${k}" viewBox="0 0 24 24">${d}</symbol>`).join('')}</svg>`

/**
 * Padel Buddy's mark, transcribed from the app's own ic_logo.xml on the same
 * 108-unit grid: the emerald tile, the racket, the chat bubble, the sound waves.
 */
const LOGO = `<svg class="mark" viewBox="0 0 108 108" aria-hidden="true">
<defs>
  <linearGradient id="pb-tile" x1="0" y1="0" x2="108" y2="108" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#34D399"/><stop offset=".55" stop-color="#10B981"/><stop offset="1" stop-color="#047857"/>
  </linearGradient>
  <linearGradient id="pb-face" x1="24" y1="24" x2="62" y2="72" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#60A5FA"/><stop offset="1" stop-color="#1D4ED8"/>
  </linearGradient>
</defs>
<rect width="108" height="108" rx="24" fill="url(#pb-tile)"/>
<g transform="translate(54 55) scale(.86) translate(-54 -55)">
  <path transform="translate(42 70) rotate(24)" d="M-5.5,2a5.5,5.5 0 0 1 11,0l0,16a5.5,5.5 0 0 1 -11,0z" fill="#1E293B"/>
  <g transform="rotate(24 42 48)">
    <path d="M20,48a22,26 0 1 0 44,0a22,26 0 1 0 -44,0z" fill="url(#pb-face)" stroke="#BFDBFE" stroke-opacity=".5" stroke-width="2.4"/>
    <g fill="#0B1120" fill-opacity=".5">
      <circle cx="38.4" cy="38" r="2.4"/><circle cx="46.4" cy="38" r="2.4"/>
      <circle cx="34.4" cy="47" r="2.4"/><circle cx="42.4" cy="47" r="2.4"/><circle cx="50.4" cy="47" r="2.4"/>
      <circle cx="38.4" cy="56" r="2.4"/><circle cx="46.4" cy="56" r="2.4"/>
    </g>
  </g>
  <path d="M73.5,19L85.5,19A8,8 0 0 1 93.5,27L93.5,31A8,8 0 0 1 85.5,39L74,39A8,8 0 0 1 66,31L66,27A8,8 0 0 1 73.5,19Z" fill="#fff"/>
  <path d="M72,37L69,47L79,39Z" fill="#fff"/>
  <g fill="#047857"><circle cx="73.5" cy="29" r="2.3"/><circle cx="79.8" cy="29" r="2.3"/><circle cx="86.1" cy="29" r="2.3"/></g>
  <g fill="none" stroke="#fff" stroke-linecap="round">
    <path d="M65.5,60.7A13,13 0 0 1 65.5,83.3" stroke-width="3.4" stroke-opacity=".95"/>
    <path d="M68.5,55.5A19,19 0 0 1 68.5,88.5" stroke-width="3.3" stroke-opacity=".62"/>
    <path d="M71.5,50.3A25,25 0 0 1 71.5,93.7" stroke-width="3.2" stroke-opacity=".36"/>
  </g>
</g></svg>`

/**
 * The tab strip. Progressive enhancement: the server marks the default panel
 * `on`, the URL hash overrides it (so a save that redirects to #rounds lands
 * back on Rounds), arrows move between tabs, and with no script every panel is
 * simply visible.
 */
const TABS_JS = `pbInit.push(function(){
var tabs=[].slice.call(document.querySelectorAll('.tabs [role=tab]'));if(!tabs.length)return;
function show(id,push){tabs.forEach(function(b){var on=b.dataset.tab===id;b.setAttribute('aria-selected',on?'true':'false');
b.tabIndex=on?0:-1;var p=document.getElementById('tab-'+b.dataset.tab);if(p)p.classList.toggle('on',on)});
if(push)history.replaceState(null,'','#'+id)}
tabs.forEach(function(b){if(!pbOnce(b,'tab'))return;
b.addEventListener('click',function(){show(b.dataset.tab,true)});
b.addEventListener('keydown',function(e){if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;e.preventDefault();
var i=tabs.indexOf(b),n=tabs[(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length];n.focus();show(n.dataset.tab,true)})});
function fromHash(){var h=location.hash.slice(1);return tabs.some(function(b){return b.dataset.tab===h})?h:''}
show(fromHash()||document.body.dataset.tab||tabs[0].dataset.tab,false);
if(!window.__pbHash){window.__pbHash=1;window.addEventListener('hashchange',function(){var h=location.hash.slice(1);var b=document.querySelector('.tabs [data-tab="'+h+'"]');if(b)b.click()})}
});`

/**
 * The pairs board, in the browser. Pointer events rather than HTML5 drag and
 * drop, because the latter does not exist on a phone and a host pairs people up
 * standing at the desk with one thumb. Tap-then-tap and Enter/Space do the same
 * moves for anyone who can't drag. The board is only a picture until Save.
 */
const PAIRS_JS = `pbInit.push(function(){
var board=document.getElementById('pairs');if(!board)return;
if(!pbOnce(board,'pairs'))return;
var form=board.closest('form'),field=form.querySelector('[name=seats]');
var seatsOf=function(){return [].slice.call(board.querySelectorAll('.seat'))};
var tray=board.querySelector('.tray');
function chipsIn(el){return [].slice.call(el.querySelectorAll('.chip'))}
function place(chip,target){
  if(!target)return;
  if(target.classList.contains('chip')){
    var a=chip.parentNode,b=target.parentNode;if(a===b&&a===tray)return;
    var nb=target.nextSibling;a.insertBefore(target,chip.nextSibling);
    if(b===tray)b.appendChild(chip);else b.insertBefore(chip,nb);
    if(a===tray){a.appendChild(target)}
    return}
  if(target.classList.contains('seat')){if(chipsIn(target).length)return;target.appendChild(chip);return}
  if(target===tray){tray.appendChild(chip)}
}
var sel=null;
function select(chip){if(sel)sel.classList.remove('sel');sel=chip===sel?null:chip;if(sel)sel.classList.add('sel');
  board.querySelectorAll('.pick').forEach(function(e){e.classList.remove('pick')});
  if(sel){seatsOf().forEach(function(s){if(!chipsIn(s).length)s.classList.add('pick')});if(sel.parentNode!==tray)tray.classList.add('pick')}}
board.addEventListener('click',function(e){
  var chip=e.target.closest('.chip');
  if(chip){if(sel&&sel!==chip){place(sel,chip);select(null)}else select(chip);return}
  var seat=e.target.closest('.seat,.tray');
  if(seat&&sel){place(sel,seat);select(null)}
});
board.addEventListener('keydown',function(e){
  var chip=e.target.closest('.chip');if(!chip)return;
  if(e.key==='Enter'||e.key===' '){e.preventDefault();chip.click()}
});
var drag=null;
board.addEventListener('pointerdown',function(e){
  var chip=e.target.closest('.chip');if(!chip||e.button)return;
  drag={chip:chip,x:e.clientX,y:e.clientY,on:false,ghost:null,over:null};
  chip.setPointerCapture(e.pointerId);
});
function targetAt(x,y){var el=document.elementFromPoint(x,y);if(!el)return null;
  var c=el.closest('.chip');if(c&&c!==drag.ghost)return c;return el.closest('.seat,.tray')}
board.addEventListener('pointermove',function(e){
  if(!drag)return;
  if(!drag.on){if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<6)return;
    drag.on=true;var r=drag.chip.getBoundingClientRect();
    drag.ghost=drag.chip.cloneNode(true);drag.ghost.classList.add('lift');
    drag.ghost.style.left=r.left+'px';drag.ghost.style.top=r.top+'px';drag.ghost.style.width=r.width+'px';
    drag.dx=e.clientX-r.left;drag.dy=e.clientY-r.top;document.body.appendChild(drag.ghost);
    drag.chip.classList.add('ghost');select(null)}
  drag.ghost.style.left=(e.clientX-drag.dx)+'px';drag.ghost.style.top=(e.clientY-drag.dy)+'px';
  var t=targetAt(e.clientX,e.clientY);if(t!==drag.over){if(drag.over)drag.over.classList.remove('over');
    drag.over=t;if(t)t.classList.add('over')}
});
function endDrag(e){
  if(!drag)return;var d=drag;drag=null;
  if(!d.on)return;
  d.chip.classList.remove('ghost');if(d.ghost)d.ghost.remove();if(d.over)d.over.classList.remove('over');
  var t=targetAt(e.clientX,e.clientY);if(t&&t!==d.chip)place(d.chip,t);
}
board.addEventListener('pointerup',endDrag);board.addEventListener('pointercancel',endDrag);
function shuffle(list){for(var i=list.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=list[i];list[i]=list[j];list[j]=t}return list}
function deal(all){
  var seats=seatsOf(),pool=all?shuffle(chipsIn(board)):shuffle(chipsIn(tray));
  if(all)seats.forEach(function(s){chipsIn(s).forEach(function(c){tray.appendChild(c)})});
  seats.forEach(function(s){if(!chipsIn(s).length&&pool.length)s.appendChild(pool.shift())});
  pool.forEach(function(c){tray.appendChild(c)});select(null)}
form.querySelector('[data-act=rest]').addEventListener('click',function(){deal(false)});
form.querySelector('[data-act=all]').addEventListener('click',function(){deal(true)});
// Level-balanced: best with weakest, so every pair adds up to about the same.
// On a mixed level with genders known, the best woman goes with the weakest man.
function balance(){
  var seats=seatsOf(),all=chipsIn(board),g=function(c){return +c.dataset.grade||4};
  var byBest=function(a,b){return g(a)-g(b)},pairs=[];
  var mixed=board.querySelector('.pairs').dataset.mixed;
  var F=all.filter(function(c){return c.dataset.gender==='F'}).sort(byBest);
  var M=all.filter(function(c){return c.dataset.gender==='M'}).sort(byBest).reverse();
  var rest=all;
  if(mixed&&F.length&&M.length){while(F.length&&M.length)pairs.push([F.shift(),M.shift()]);rest=F.concat(M.reverse(),all.filter(function(c){return c.dataset.gender!=='F'&&c.dataset.gender!=='M'}))}
  else rest=all.slice();
  rest.sort(byBest);while(rest.length>1)pairs.push([rest.shift(),rest.pop()]);
  seats.forEach(function(s){chipsIn(s).forEach(function(c){tray.appendChild(c)})});
  var ps=[].slice.call(board.querySelectorAll('.pair'));
  pairs.forEach(function(p,i){if(!ps[i])return;var st=ps[i].querySelectorAll('.seat');st[0].appendChild(p[0]);st[1].appendChild(p[1])});
  select(null)}
var bal=form.querySelector('[data-act=balance]');if(bal)bal.addEventListener('click',balance);
form.addEventListener('submit',function(){
  var pairs=[],ps=[].slice.call(board.querySelectorAll('.pair'));
  ps.forEach(function(p){pairs.push(chipsIn(p).map(function(c){return c.dataset.name}))});
  field.value=JSON.stringify(pairs)});
});`

/**
 * Copy buttons: whatever `data-copy` points at goes to the clipboard, and the
 * button says so for a moment. The old execCommand path stays for a browser
 * that refuses the clipboard API off a secure context.
 */
const COPY_JS = `pbInit.push(function(){
document.querySelectorAll('[data-copy]').forEach(function(b){
  if(!pbOnce(b,'copy'))return;
  b.addEventListener('click',function(){
    var el=document.querySelector(b.dataset.copy);if(!el)return;var text=el.textContent;
    var done=function(){var was=b.innerHTML;b.classList.add('done');b.querySelector('span').textContent=b.dataset.done;
      setTimeout(function(){b.classList.remove('done');b.innerHTML=was},1600)};
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(done,function(){fallback()})}
    else fallback();
    function fallback(){var r=document.createRange();r.selectNodeContents(el);var s=getSelection();s.removeAllRanges();s.addRange(r);
      try{document.execCommand('copy');done()}catch(e){}s.removeAllRanges()}
  })});
});`

/**
 * A list of courts you edit in place: each row is its field, its Save, its
 * Remove; an add form underneath. `base` is where the rows post — the club's
 * defaults or one night's own. A court with `locked` set can be renamed but
 * not removed, because a schedule already names it.
 */
const courtList = (courts, base, t, { fixed = false } = {}) => `
  <form class="courtlist" method="post" action="${base}/save">
    ${courts.map((c) => `<div class="courtrow" data-key="court-${c.id}">
      ${ic('court')}
      <input name="label${c.id}" value="${esc(c.label)}" maxlength="40" required aria-label="${esc(t('courtName'))}">
      <button class="btn save" name="only" value="${c.id}">${ic('check')}${esc(t('save'))}</button>
      ${c.locked ? '' : `<button class="btn danger" formaction="${base}/${c.id}/delete" formnovalidate
        aria-label="${esc(t('remove'))} ${esc(c.label)}">${ic('trash')}<span>${esc(t('remove'))}</span></button>`}
    </div>`).join('') || `<p class="muted">${esc(t('noCourtsYet'))}</p>`}
    ${courts.length > 1 ? `<div class="actions"><button>${ic('check')}${esc(t('saveAll'))}</button></div>` : ''}
  </form>
  ${fixed ? '' : `<form class="row" method="post" action="${base}" style="margin-top:14px">
    <div><label for="courtlabel-${base.replace(/\W/g, '')}">${esc(t('addCourt'))}</label>
      <input id="courtlabel-${base.replace(/\W/g, '')}" name="label" placeholder="5 / Center" required></div>
    <div style="flex:0 0 auto"><button>${ic('plus')}${esc(t('add'))}</button></div>
  </form>`}`

/** A Copy button for the message in `#id`. */
const copyBtn = (id, t) => `<button type="button" class="btn ghost" data-copy="#${id}" data-done="${esc(t('copied'))}">${
  ic('board')}<span>${esc(t('copy'))}</span></button>`

/**
 * Saves that leave the page where it is.
 *
 * Every POST form is fetched rather than navigated, and the answer is *morphed*
 * into the live DOM rather than replacing it. The server is untouched: it still
 * replies with a redirect back to the page it just changed, and that page is
 * still the whole truth. What changed is that a node whose markup did not
 * change is not touched at all — so the box the host is typing in keeps its
 * focus and its caret, nothing repaints, and the scroll is never "restored"
 * because it never moved.
 *
 * Replacing the page wholesale is what made saving a score jump: fifteen match
 * blocks were destroyed and rebuilt on every press, focus fell back to the
 * document, and the status line arriving at the top of the card pushed the
 * court the host was reading fifty pixels down the screen.
 *
 * Two things still move the page on their own. Content appearing above the fold
 * shifts everything below it, so the element nearest the top of the viewport is
 * measured before and after and the scroll corrected by the difference. And a
 * redirect to a *different* page (create, delete) is a real navigation, so it is
 * followed as one. Anything unexpected falls back to a plain submit, so
 * scripting off still works and the server routes stay the one source of truth.
 */
const AJAX_JS = `window.pbInit=window.pbInit||[];
function pbBoot(){window.pbInit.forEach(function(f){try{f()}catch(e){console.error(e)}})}
// Bind once per node. A morphed page keeps its nodes, so an init that already
// ran on an element must not run again and listen to it twice.
function pbOnce(el,key){var k='__pb_'+key;if(el[k])return false;el[k]=1;return true}
(function(){
  // The two regions the server re-renders. The header is in because the
  // language toggle lives there and switching language rewrites the nav — left
  // out, that one form was the only control on the site still reloading.
  var ROOTS=['header.top','.wrap'];
  var wrap=document.querySelector('.wrap');if(!wrap)return;
  var inRoots=function(el){return ROOTS.some(function(sel){
    var r=document.querySelector(sel);return r&&r.contains(el)})};

  // ---- morphing -----------------------------------------------------------
  // A key makes a node recognisable across a render: an id where there is one,
  // an explicit data-key on repeated rows. Keyed children are matched by key
  // and moved; the rest are matched by position and tag.
  var keyOf=function(n){return n.nodeType===1?(n.id||n.getAttribute('data-key')||''):''};
  var alike=function(a,b){return a.nodeType===b.nodeType&&(a.nodeType!==1||a.tagName===b.tagName)};
  var isField=function(n){return /^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName)};

  function morphAttrs(cur,next){
    var i,a,na=next.attributes,ca=cur.attributes;
    for(i=na.length-1;i>=0;i--){a=na[i];if(cur.getAttribute(a.name)!==a.value)cur.setAttribute(a.name,a.value)}
    for(i=ca.length-1;i>=0;i--){a=ca[i];if(!next.hasAttribute(a.name))cur.removeAttribute(a.name)}
  }
  function morphField(cur,next){
    // What the host is typing is theirs until they leave the box. The server
    // echoes the value it stored, which mid-keystroke is the one before this.
    if(cur===document.activeElement)return;
    if(cur.type==='checkbox'||cur.type==='radio'){cur.checked=next.hasAttribute('checked');return}
    if(cur.tagName==='SELECT'){morphChildren(cur,next);if(cur.value!==next.value)cur.value=next.value;return}
    var v=next.getAttribute('value')||'';
    if(cur.value!==v)cur.value=v;
  }
  function morph(cur,next){
    if(cur.nodeType!==1){if(cur.nodeValue!==next.nodeValue)cur.nodeValue=next.nodeValue;return}
    morphAttrs(cur,next);
    if(isField(cur))return morphField(cur,next);
    morphChildren(cur,next);
  }
  function morphChildren(cur,next){
    var keyed=Object.create(null),n,k;
    for(n=cur.firstChild;n;n=n.nextSibling){k=keyOf(n);if(k)keyed[k]=n}
    var at=cur.firstChild;
    for(var want=next.firstChild;want;want=want.nextSibling){
      k=keyOf(want);
      var use=k?(keyed[k]||null):(at&&!keyOf(at)&&alike(at,want)?at:null);
      if(!use){cur.insertBefore(document.importNode(want,true),at);continue}
      if(k)delete keyed[k];
      if(use===at)at=at.nextSibling;else cur.insertBefore(use,at);
      if(alike(use,want))morph(use,want);
      else use.replaceWith(document.importNode(want,true));
    }
    // Whatever the answer did not ask for is gone. Anything still unconsumed
    // sits at or after the cursor, including keys the new page dropped.
    while(at){var nx=at.nextSibling;cur.removeChild(at);at=nx}
  }

  // ---- holding the viewport still ----------------------------------------
  // The element nearest the top of the viewport, and where it sits. After the
  // patch the page is scrolled so that it sits there still.
  function anchor(){
    // At the top of the page there is nothing to hold: a status line arriving
    // should settle in where the host can read it, not be scrolled past.
    if(scrollY<=4)return null;
    var els=wrap.querySelectorAll('[id]'),best=null,bestAt=Infinity;
    for(var i=0;i<els.length;i++){
      var r=els[i].getBoundingClientRect();
      if(!r.width&&!r.height)continue;
      if(r.bottom<0||r.top>innerHeight)continue;
      var d=Math.abs(r.top);
      if(d<bestAt){bestAt=d;best=els[i]}
    }
    return best?{id:best.id,top:best.getBoundingClientRect().top}:null
  }
  function hold(a){
    if(!a)return;
    var el=document.getElementById(a.id);if(!el)return;
    var d=el.getBoundingClientRect().top-a.top;
    if(d)scrollBy(0,d);
  }

  // A press that changes nothing visible still needs an answer.
  function tick(btn){
    if(!btn||!btn.isConnected)return;
    btn.classList.add('done');
    setTimeout(function(){btn.classList.remove('done')},1200);
  }

  // Presses overlap — a host taps Save on one court while the last one is still
  // in the air. Every press reaches the server; only the newest answer paints,
  // because an older one would paint the page as it was before the last save.
  var seq=0;
  // Which button was pressed. SubmitEvent.submitter is Chrome 81 / Firefox 75;
  // a Galaxy Tab 2 runs Chrome 71 or Firefox 68, where it is missing and every
  // per-match Save saved every box, and "Post round" or "Remove" did a save.
  var pressed=null;
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('button,input[type=submit]');
    pressed=b&&b.form&&(b.type||'submit')==='submit'?b:null;
  },true);
  document.addEventListener('submit',function(e){
    var form=e.target;if(!(form instanceof HTMLFormElement)||e.defaultPrevented)return;
    if((form.method||'get').toLowerCase()!=='post'||!inRoots(form))return;
    if(!window.fetch||!window.DOMParser)return;
    e.preventDefault();
    var btn=e.submitter||(pressed&&pressed.form===form?pressed:null);pressed=null;
    var action=(btn&&btn.getAttribute('formaction'))||form.getAttribute('action')||location.pathname;
    // The pressed button's own name=value, added by hand: FormData's second
    // argument is newer still (Chrome 112), and older engines ignore it.
    var data=new FormData(form);
    if(btn&&btn.name)data.append(btn.name,btn.value);
    var mine=++seq;
    form.setAttribute('aria-busy','true');
    // Not disabled: disabling the pressed button moves focus off it, and on a
    // phone that closes the keyboard the host is typing the next score with.
    if(btn)btn.classList.add('busy');
    fetch(action,{method:'POST',body:new URLSearchParams(data),credentials:'same-origin',
      headers:{'Accept':'text/html'},redirect:'follow'}).then(function(res){
      var to=new URL(res.url,location.href);
      // Only a redirect elsewhere is a navigation. A page rendered straight
      // back to the POST (an import readout, a validation error) is this
      // page's next state, and the address stays where it was.
      if(res.redirected&&to.pathname!==location.pathname){location.assign(to.href);return}
      if(!res.redirected)to=new URL(location.href);
      return res.text().then(function(html){
        if(mine!==seq)return;
        var doc=new DOMParser().parseFromString(html,'text/html');
        if(!doc.querySelector('.wrap'))throw new Error('no page');
        var a=anchor();
        ROOTS.forEach(function(sel){
          var cur=document.querySelector(sel),nx=doc.querySelector(sel);
          if(cur&&nx)morph(cur,nx);
        });
        document.title=doc.title;
        document.documentElement.lang=doc.documentElement.lang;
        var tab=doc.body.getAttribute('data-tab');if(tab)document.body.setAttribute('data-tab',tab);
        history.replaceState(null,'',to.pathname+to.search+(to.hash||location.hash));
        pbBoot();
        hold(a);
        form.removeAttribute('aria-busy');
        if(btn){btn.classList.remove('busy');tick(btn)}
      })
    }).catch(function(err){
      console.error(err);
      form.removeAttribute('aria-busy');if(btn)btn.classList.remove('busy');
      if(mine===seq)form.submit();
    });
  });
})();`

/** A tab strip + its panels. `tabs` is [{id, icon, label, count?, body}]. */
function tabbed(tabs, active) {
  const strip = `<div class="tabs" role="tablist">${tabs.map((x) => `<button type="button" role="tab"
    id="tabbtn-${x.id}" data-tab="${x.id}" aria-controls="tab-${x.id}" aria-selected="${x.id === active}"
    tabindex="${x.id === active ? 0 : -1}">${ic(x.icon)}<span>${esc(x.label)}</span>${
      x.count != null ? `<span class="n">${x.count}</span>` : ''}</button>`).join('')}</div>`
  const panels = tabs.map((x) => `<section class="panel${x.id === active ? ' on' : ''}" id="tab-${x.id}"
    role="tabpanel" aria-labelledby="tabbtn-${x.id}">${x.body}</section>`).join('')
  return strip + panels
}

/** The same mark as the tab icon — a data URI, so no request and no 404. */
const FAVICON = `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${
  encodeURIComponent(LOGO.replace(' class="mark"', ' xmlns="http://www.w3.org/2000/svg"').replace(' aria-hidden="true"', ''))}">`

/** An icon next to a word. Decorative: the word carries the meaning, the icon speeds it up. */
const ic = (name, cls = '') => `<svg class="i${cls ? ` ${cls}` : ''}" aria-hidden="true"><use href="#i-${name}"/></svg>`

const CSS = `
:root {
  /*
   * Padel Buddy's palette, read out of its own theme: navy ground, emerald
   * primary (the launcher tile), blue for anything that is a court (the
   * racket), amber for "needs another look", coral for errors. The console
   * is the same product as the phone app, and should look like it.
   */
  --bg:#0B1120; --surface:#121A2B; --surface-2:#1B2437; --line:#263247;
  --ink:#E7EDF5; --muted:#9AA4B2;
  --brand:#34D399; --brand-ink:#00281B; --brand-deep:#065F46; --brand-soft:#A7F3D0;
  --court:#60A5FA; --court-ink:#04213F;
  --accent:#FCD34D; --warn:#FFB4AB; --warn-bg:#5C1D18; --radius:14px;
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
header.top .mark{width:34px;height:34px;flex:0 0 34px;display:block}
header.top .brand small{color:var(--muted);font-weight:600;margin-left:6px;white-space:nowrap}
nav{margin-left:auto;display:flex;gap:2px;max-width:100%;overflow-x:auto;
  scrollbar-width:none;-ms-overflow-style:none}
nav::-webkit-scrollbar{display:none}
nav a{display:inline-flex;align-items:center;gap:7px;min-height:44px;padding:0 12px;
  border-radius:999px;text-decoration:none;color:var(--muted);font-weight:600;white-space:nowrap}
nav a:hover{color:var(--ink)}
nav a.on{color:var(--ink);background:var(--surface-2)}
nav a.on .i{color:var(--brand)}
form.lang{display:flex;align-items:center;flex:0 0 auto;margin:0 0 0 8px}
form.lang label{position:relative;display:flex;align-items:center;margin:0;color:var(--muted)}
form.lang label>.i{position:absolute;left:10px;width:16px;height:16px;pointer-events:none}
form.lang select{width:auto;min-height:40px;padding:6px 32px 6px 32px;font-size:.85rem;font-weight:700;
  border-radius:999px;background-color:var(--surface-2)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
/* On a phone the nav lives at the bottom, so the header is brand + language on
   one line: the "Tournaments" subtitle gives way before the dropdown does. */
@media (max-width:720px){header.top{flex-wrap:nowrap}header.top .brand{flex:1 1 0}}
@media (max-width:480px){header.top .brand small{display:none}
  form.lang select{padding-right:26px;max-width:8.5rem}}

.i{width:1.1em;height:1.1em;flex:0 0 auto;fill:none;stroke:currentColor;stroke-width:2;
  stroke-linecap:round;stroke-linejoin:round;vertical-align:-.18em}
h3 .i,h2 .i{width:20px;height:20px;color:var(--muted);margin-right:.4em;vertical-align:-.22em}
button .i,.btn .i,nav a .i{width:18px;height:18px}
.meta{display:flex;flex-wrap:wrap;gap:6px 16px;align-items:center;color:var(--muted);margin:0 0 .5rem}
.meta>span,.meta>a{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
/* The pin opens the map, the name opens the venue's nights: two links, one item. */
/* The home picker: one select, saves as it changes, sits with the address line. */
form.home{display:flex;align-items:center;gap:8px;margin:0 0 16px;max-width:520px}
form.home>.i{width:18px;height:18px;color:var(--muted);flex:0 0 auto}
form.home label{margin:0;flex:0 0 auto}
form.home select{flex:1 1 auto;min-width:0}
.meta .place{display:inline-flex;align-items:center;gap:2px}
.meta .pinlink{display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;
  margin-left:-12px;border-radius:999px;color:var(--brand)}
.meta .pinlink:hover{background:var(--surface-2)}
.meta .pinlink.off{color:var(--muted)}
.meta .pinlink .i{width:18px;height:18px}
/* Links in the meta line are tapped on a phone: thumb-sized, whatever their text. */
.meta>a,.meta a.tap{min-height:44px}
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
/* A secondary Save is still a Save: the brand colour on its outline says so. */
.btn.save{background:transparent;color:var(--brand);border:1.5px solid var(--brand)}
.btn.save:hover{background:color-mix(in oklab,var(--brand) 12%,transparent);filter:none}
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
.pill.on{background:var(--brand-deep);color:var(--brand-soft)}
.pill{align-self:center}
td.active{gap:8px;font-size:.9rem}
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
button.done{border-color:var(--brand);color:var(--brand)}
button.busy{opacity:.6;cursor:progress}
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
  color:var(--court);font-size:.74rem;text-transform:uppercase;letter-spacing:.05em}
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
  background:var(--bg);border:2px solid color-mix(in oklab,var(--brand) 55%,var(--line));
  border-radius:12px;font-size:1.25rem;font-weight:800;font-variant-numeric:tabular-nums;
  box-shadow:inset 0 1px 2px rgba(0,0,0,.45);transition:border-color .15s ease-out}
.match input::placeholder{color:var(--muted);font-weight:600;opacity:1}
.match input:hover{border-color:var(--brand)}
.match input:focus{border-color:var(--brand);outline:none;
  box-shadow:0 0 0 3px color-mix(in oklab,var(--brand) 30%,transparent),inset 0 1px 2px rgba(0,0,0,.45)}
/* A box that already holds a score wears it in the brand colour outright. */
.match input:not(:placeholder-shown){border-color:var(--brand);color:var(--brand-soft)}
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
 * Tabs, so a tournament is four short screens instead of one long scroll. The
 * strip is the same shape as the nav so it reads as navigation, and the panels
 * are plain sections: with scripting off every panel simply shows, in order.
 */
.tabs{display:flex;gap:2px;margin:18px 0 6px;border-bottom:1px solid var(--line);
  overflow-x:auto;scrollbar-width:none}
.tabs::-webkit-scrollbar{display:none}
.tabs button{appearance:none;background:transparent;border:0;border-bottom:2px solid transparent;
  border-radius:0;margin-bottom:-1px;padding:0 14px;min-height:46px;color:var(--muted);font-weight:700;
  white-space:nowrap;display:inline-flex;align-items:center;gap:7px;transition:color .15s ease-out}
.tabs button .i{width:18px;height:18px}
.tabs button .n{font-size:.74rem;font-weight:800;color:var(--muted);background:var(--surface-2);
  border-radius:999px;padding:1px 7px}
.tabs button:hover{color:var(--ink);filter:none}
.tabs button[aria-selected="true"]{color:var(--ink);border-color:var(--brand)}
.tabs button[aria-selected="true"] .i{color:var(--brand)}
.tabs button[aria-selected="true"] .n{background:var(--brand-deep);color:var(--brand-soft)}
.js .panel:not(.on){display:none}
.panel>.card:first-child{margin-top:10px}
/* One bar for all the scores, kept in reach at the bottom of the rounds panel. */
.savebar{position:sticky;bottom:12px;display:flex;justify-content:flex-end;gap:10px;margin-top:14px;
  padding:10px;border-radius:12px;background:var(--surface);border:1px solid var(--line);
  box-shadow:0 8px 24px -8px rgba(0,0,0,.6);z-index:2}
@media (max-width:720px){.savebar{bottom:calc(72px + env(safe-area-inset-bottom))}
  .savebar button{flex:1 1 auto}}
/* Four tabs share a phone's width; nothing scrolls off the edge. */
@media (max-width:480px){
  .tabs{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(max-content,1fr);gap:0;overflow-x:auto}
  .tabs button{justify-content:center;padding:0 3px;gap:4px;font-size:.8rem}
  .tabs button .i{width:17px;height:17px}
  .tabs button .n{padding:0 6px;font-size:.7rem}
}
details.preview summary{cursor:pointer;color:var(--muted);font-weight:600;min-height:44px;
  display:flex;align-items:center;gap:6px;list-style:none}
details.preview summary::-webkit-details-marker{display:none}
details.preview summary .i{transition:transform .15s ease-out}
details.preview[open] summary .i{transform:rotate(90deg)}
details.preview pre{margin-top:8px}
.readout{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:0 0 14px;padding:12px 14px;
  border-radius:12px;background:var(--surface-2);border:1px solid var(--line)}
.readout strong{flex:0 0 auto}
.readout .muted,.readout .err{flex:1 1 100%;margin:0;font-size:.9rem}
.readout .roster{flex:1 1 100%;columns:2;column-gap:24px;margin:4px 0 0;padding-left:1.4em;font-size:.95rem}
.readout .roster li{break-inside:avoid;padding:2px 0}
@media (max-width:480px){.readout .roster{columns:1}}
/* A court is a name you can edit in place; the row is the field, its Save, its Remove. */
.courtlist{display:flex;flex-direction:column;gap:8px;margin-top:10px}
.courtlist .actions{margin-top:6px}
.courtrow{display:flex;gap:8px;align-items:center}
.courtrow>.i{flex:0 0 auto;color:var(--court)}
.courtrow input{flex:1 1 auto;min-width:0}
.courtrow .btn.danger span{display:none}
.courtrow .btn.danger{padding:0 12px}
@media (min-width:640px){.courtrow .btn.danger span{display:inline}.courtrow .btn.danger{padding:11px 16px}}
.venuelist{display:flex;flex-direction:column;gap:12px;margin-top:10px}
form.venue{padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--surface-2)}
form.venue .pill .i{width:14px;height:14px;vertical-align:-2px}
form.venue .actions{margin-top:12px}
form.venue.add{margin-top:16px;background:transparent;border-style:dashed}
form.venue h4{margin:0}
/* A card that folds: its heading is the summary, the arrow turns when open. */
details.fold summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:10px;min-height:44px;margin:-4px 0}
details.fold summary::-webkit-details-marker{display:none}
details.fold summary h3{margin:0;flex:1 1 auto}
details.fold summary>.i{color:var(--muted);transition:transform .15s ease-out}
details.fold[open] summary>.i{transform:rotate(90deg)}
details.fold[open] summary{margin-bottom:8px}
.danger-zone{display:flex;justify-content:flex-end;margin:4px 0 8px}
.meta form.inline{display:inline-flex;margin:0}
button.link.danger{color:var(--warn);text-decoration-color:color-mix(in oklab,var(--warn) 40%,transparent)}
button.link.danger:hover{color:var(--warn)}
/* Both actions are direct flex items — the form around Remove is invisible to
   layout — so they share one centre line, whichever table rule is in force. */
td.rowact,div.rowact,table.stack td.rowact{display:flex;align-items:center;gap:8px;flex:0 0 auto}
.rowact form{display:contents}
.rowact .btn{min-height:40px;padding:0 14px;line-height:1}
table.stack td.rowact{margin-top:6px;flex:1 1 100%}
@media (max-width:560px){table.stack td.rowact{display:inline-flex}}
.outmsg{margin-bottom:18px}
.outmsg .actions{margin-top:8px;align-items:center}
/* Standings: a real grid at every width. */
table.standings td.pos{font-weight:800;color:var(--brand);width:2.4ch;font-variant-numeric:tabular-nums}
table.standings td.team{font-weight:600;overflow-wrap:anywhere}
table.standings tr.top td.team{color:var(--ink)}
table.standings th .short{display:none}
@media (max-width:480px){
  table.standings th .long{display:none} table.standings th .short{display:inline}
  table.standings th,table.standings td{padding:9px 6px}
  table.standings td.team{font-size:.95rem}
}
/*
 * The pairs board. Seats are the shape a pair has — two slots side by side —
 * and the tray is everyone still unplaced. A player is a chip that moves by
 * finger, mouse, tap-then-tap, or keyboard; the board only ever *shows* an
 * arrangement, and Save is what writes it.
 */
.pairs{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr));margin-top:12px}
.pair{display:grid;grid-template-columns:auto minmax(0,1fr) minmax(0,1fr);gap:8px;align-items:center;
  padding:8px 10px;border:1px solid var(--line);border-radius:12px;background:var(--surface-2)}
.pair .num{font-weight:800;color:var(--brand);font-variant-numeric:tabular-nums;min-width:1.6ch;text-align:right}
.seat{min-width:0;min-height:48px;border:1.5px dashed var(--line);border-radius:10px;display:flex;
  align-items:center;padding:3px;transition:border-color .15s ease-out,background .15s ease-out}
.seat.over,.tray.over{border-color:var(--brand);background:color-mix(in oklab,var(--brand) 10%,var(--surface-2))}
.seat.pick,.tray.pick{border-style:solid;border-color:color-mix(in oklab,var(--brand) 60%,var(--line))}
.chip{appearance:none;border:1px solid var(--line);background:var(--surface);color:var(--ink);
  border-radius:9px;padding:0 10px;min-height:40px;width:100%;min-width:0;font:inherit;font-weight:600;text-align:left;
  display:inline-flex;align-items:center;gap:8px;cursor:grab;touch-action:none;user-select:none;
  overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.chip:hover{border-color:var(--muted);filter:none}
.chip .name{min-width:0;overflow:hidden;text-overflow:ellipsis}
/* The handle: the one thing that says "this moves" before anyone tries. */
/* The player's level on their chip: small, tabular, quiet until it matters. */
.chip .lv{margin-left:auto;flex:0 0 auto;min-width:1.6em;text-align:center;font-size:.72rem;font-weight:800;
  padding:1px 6px;border-radius:999px;background:var(--surface-2);color:var(--muted);font-variant-numeric:tabular-nums}
/* The register: one row per player, the level control on the right. */
.plist{display:flex;flex-direction:column;margin-top:6px}
.prow{display:flex;align-items:center;gap:10px 14px;padding:10px 2px;border-bottom:1px solid var(--line)}
.prow:last-child{border-bottom:0}
.prow .who{flex:1 1 auto;min-width:0}
.prow .who a{font-weight:700;color:var(--ink);text-decoration:none;overflow-wrap:anywhere}
.prow .who a:hover{text-decoration:underline;text-underline-offset:3px}
.prow .sub{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;color:var(--muted);font-size:.82rem;margin-top:2px}
.prow select{flex:0 0 auto;width:auto;max-width:52%;min-width:9.5rem}
.trend{display:inline-flex;align-items:center;gap:3px}
.trend .i{width:15px;height:15px}
.trend.up{color:var(--brand)} .trend.down{color:var(--warn)}
.search{margin:4px 0 8px}
.history{list-style:none;margin:6px 0 0;padding:0}
.history li{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px;padding:10px 0;border-bottom:1px solid var(--line)}
.history li:last-child{border-bottom:0}
.history .when{color:var(--muted);font-size:.85rem;min-width:9ch;font-variant-numeric:tabular-nums}
.history .hnote{flex:1 1 100%;color:var(--muted);font-size:.9rem}
@media (max-width:480px){.prow{flex-wrap:wrap}.prow select{max-width:100%;flex:1 1 100%}}
.chip .grip{width:18px;height:18px;flex:0 0 auto;color:var(--muted);margin-left:-4px;fill:currentColor;stroke:none;opacity:.9}
.chip:hover .grip,.chip.sel .grip{color:var(--brand)}
.chip .g{flex:0 0 auto;font-size:.7rem;font-weight:800;padding:1px 6px;border-radius:999px;
  background:var(--surface-2);color:var(--muted)}
.chip .g.F{background:#4A2B4F;color:#F5C2F0} .chip .g.M{background:var(--court-ink);color:var(--court)}
.chip.sel{border-color:var(--brand);box-shadow:0 0 0 3px color-mix(in oklab,var(--brand) 30%,transparent)}
.chip.lift{position:fixed;z-index:20;width:auto;pointer-events:none;cursor:grabbing;
  box-shadow:0 12px 28px -8px rgba(0,0,0,.7);transform:scale(1.04)}
.chip.ghost{opacity:.35}
.tray{min-height:56px;border:1.5px dashed var(--line);border-radius:12px;padding:6px;margin-top:12px;
  display:flex;flex-wrap:wrap;gap:6px;transition:border-color .15s ease-out,background .15s ease-out}
.tray .chip{width:auto;max-width:100%}
.tray:empty::before{content:attr(data-empty);color:var(--muted);padding:8px 6px;font-size:.9rem}
.pairsbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:14px}
/* On a phone the two seats stack, so a name is never squeezed to its first letters. */
@media (max-width:480px){
  .pairsbar button{flex:1 1 100%}
  .pair{grid-template-columns:auto minmax(0,1fr);grid-template-rows:auto auto;column-gap:10px;row-gap:6px}
  .pair .num{grid-row:1/3;align-self:center}
}

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
    display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);overflow:visible;
    background:var(--surface);border-top:1px solid var(--line);
    padding:6px 6px calc(6px + env(safe-area-inset-bottom))}
  nav a{flex-direction:column;justify-content:center;gap:3px;min-height:52px;padding:4px 1px;
    border-radius:10px;font-size:.64rem;font-weight:700;letter-spacing:0;min-width:0}
  nav a span{max-width:100%;overflow:hidden;text-overflow:ellipsis}
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
pbInit.push(function(){
  var c=document.getElementById('level_category'),g=document.getElementById('level_grade'),
      o=document.getElementById('level_preview');
  if(!c||!g||!o)return;
  var fallback=o.textContent;
  function paint(){
    var gr=g.options[g.selectedIndex];
    // No grade yet (an import that could not read the level): keep the plain
    // hint rather than painting "M- — Men's, . ." out of empty parts.
    if(!g.value){o.textContent=fallback;return}
    o.textContent=c.value+'-'+g.value+' — '+c.options[c.selectedIndex].dataset.label+
      ', '+gr.dataset.label.toLowerCase()+'. '+gr.dataset.blurb+'.';
  }
  c.addEventListener('change',paint);g.addEventListener('change',paint);paint();
});`

/**
 * The language switch lives in the header because it is the one setting someone
 * changes mid-task. It POSTs — switching language rewrites the club row, and a
 * link that mutates state is a link a crawler or a prefetch can pull.
 */
/**
 * The language switch: one compact dropdown, each language named in itself.
 * It switches as it changes (a full load — the header's own words change too);
 * without scripting, the button beside it does the same.
 */
const langToggle = (lang, here) => `<form class="lang" method="post" action="/language">${
  here ? `<input type="hidden" name="back" value="${esc(here)}">` : ''}
  <label>${ic('globe')}<span class="sr">Language</span>
  <select name="language" onchange="this.form.submit()" aria-label="Language / Idioma / Мова">${
    LANGUAGES.map((l) => `<option value="${l.code}"${l.code === lang ? ' selected' : ''}>${esc(l.label)}</option>`).join('')}
  </select></label><noscript><button class="btn ghost">OK</button></noscript></form>`

export function page(title, body, { nav = '', script = '', t = translator(), here = '', tab = '' } = {}) {
  return `<!doctype html><html lang="${t.lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="dark">
<title>${esc(title)}</title>${FAVICON}<style>${CSS}</style>
<script>document.documentElement.classList.add('js')</script></head><body${
  tab ? ` data-tab="${esc(tab)}"` : ''}>
<header class="top"><a class="brand" href="/">${LOGO}
<strong>Padel Buddy</strong><small>${esc(t('navTournaments'))}</small></a>
<nav>${nav}</nav>${langToggle(t.lang, here)}</header>
${SPRITE}
<div class="wrap">${body}</div><script>${AJAX_JS}</script><script>${TABS_JS}</script><script>${PAIRS_JS}</script><script>${COPY_JS}</script>${script ? `<script>${script}</script>` : ''}<script>pbBoot()</script></body></html>`
}

const navFor = (here, t) => [['/', 'navOverview', 'home'], ['/tournaments', 'navTournaments', 'trophy'],
  ['/players', 'navPlayers', 'user'], ['/settings', 'navSettings', 'sliders'], ['/groups', 'navGroups', 'chats']]
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
 * One match: the court, then a line per team with that team's box on it, and a
 * per-match Save for the host who types one result at a time from courtside.
 * It is a block inside the panel's single scores form, not a form of its own —
 * so every box on the page can also be saved at once from the bar underneath.
 * Each name is the input's own <label>, so the accessible name is the team.
 */
const matchBlock = (m, t) => `<div class="match" id="match-${m.id}">
  <div class="court">${ic('court')} ${esc(courtName(m.court, t))}</div>
  <div class="sides">
    ${[['a', m.team_a, m.score_a], ['b', m.team_b, m.score_b]].map(([side, team, score]) => `
    <div class="side">
      <label class="who" for="m${m.id}${side}">${esc(team)}</label>
      <input id="m${m.id}${side}" name="${side}${m.id}" type="number" min="0" max="99"
        inputmode="numeric" placeholder="–" value="${score ?? ''}">
    </div>`).join('')}
  </div>
  <button class="btn save" name="only" value="${m.id}">${ic('check')}${esc(t('save'))}</button>
</div>`

const levelCell = (code, t) => code
  ? `<span class="pill on">${esc(code)}</span> <span class="muted">${esc(levelShort(code, t))}</span>`
  : `<span class="muted">${esc(t('statusOpen'))}</span>`

export function overview({ club, home = null, venues = [], tournaments, courts, live, pinned = 0, night = 0, t }) {
  const here = home || { name: club.name, address: club.address, maps_url: club.maps_url, venue: null }
  return page(t('navOverview'), `
    <h1>${esc(here.name)}</h1>
    <p class="meta"><span>${ic('pin')}${esc(here.address) || esc(t('noAddress'))}</span>${
      here.maps_url ? `<a href="${esc(here.maps_url)}" target="_blank" rel="noopener">${esc(t('openInMaps'))}${ic('arrow')}</a>` : ''}</p>
    ${venues.length > 1 ? `<form class="home" method="post" action="/home" title="${esc(t('homeVenueHelp'))}">
      ${ic('home')}<label for="homev">${esc(t('homeVenue'))}</label>
      <select id="homev" name="home_venue_id" onchange="this.form.requestSubmit()">
        ${venues.map((x) => `<option value="${x.id}"${here.venue && here.venue.id === x.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}
      </select>
      <noscript><button class="btn ghost">${ic('check')}${esc(t('save'))}</button></noscript>
    </form>` : ''}
    <div class="grid">
      <div class="card"><h3>${ic('court')}${esc(t('courts'))}</h3>
        <p class="muted">${courts.length ? courts.map((c) => esc(courtName(c.label, t))).join(' · ') : esc(t('noneYet'))}</p>
        <div class="actions"><a class="btn ghost" href="/settings">${ic('sliders')}${esc(t('manageCourts'))}</a></div></div>
      <div class="card"><h3>${ic('chats')}${esc(t('navGroups'))}</h3>
        <p><span class="pill ${live ? 'on' : ''}">${esc(live ? t('live') : t('draftMode'))}</span></p>
        <p class="muted">${esc(live ? t('postingToGroup') : t('draftExplain'))}</p>
        <div class="actions"><a class="btn ghost" href="/groups">${esc(t('open'))}${ic('arrow')}</a></div></div>
    </div>
    <div class="card"><h3>${ic('trophy')}${esc(t('tournaments'))}</h3>
      ${tournaments.length ? wrapTable(`<thead><tr><th>${esc(t('when'))}</th><th>${esc(t('level'))}</th>
        <th class="num">${esc(t('courts'))}</th><th>${esc(t('status'))}</th><th></th><th></th></tr></thead><tbody>
      ${tournaments.map((x) => `<tr>
        <td class="lead" data-l="">${esc(humanWhen(x, { lang: t.lang }))}</td>
        <td data-l="${esc(t('level'))}">${levelCell(x.level, t)}</td>
        <td class="num" data-l="${esc(t('courts'))}">${x.courts}</td>
        <td data-l="${esc(t('status'))}"><span class="pill">${esc(statusLabel(x.status, t))}</span></td>
        ${x.id === night ? `<td class="full active" data-l=""><span class="pill on">${esc(t('activeNight'))}</span>${
          x.id === pinned ? '' : ` <span class="muted">${esc(t('autoNight'))}</span>`}</td>` : '<td data-l=""></td>'}
        <td class="full rowact"><a class="btn ghost" href="/t/${x.id}">${esc(t('open'))}${ic('arrow')}</a>
          <form method="post" action="/t/${x.id}/delete" onsubmit="return confirm(${
            JSON.stringify(t('deleteConfirm', { name: `${x.level || ''} ${humanWhen(x, { lang: t.lang })}`.trim() })).replace(/"/g, '&quot;')})">
            <button class="btn danger" aria-label="${esc(t('deleteTournament'))}">${ic('trash')}<span>${esc(t('remove'))}</span></button>
          </form></td></tr>`).join('')}</tbody>`, 'stack')
        : `<p class="muted">${esc(t('noTournaments'))}</p>`}
      <div class="actions"><a class="btn" href="/tournaments">${ic('plus')}${esc(t('newTournament'))}</a></div>
    </div>`, { nav: navFor('/', t), t, here: '/' })
}

export function settings({ club, courts, venues = [], notice = '', home = 0, t }) {
  const courtsPanel = `
    <div class="card">
      <h3>${ic('court')}${esc(t('courts'))}</h3>
      <p class="muted">${esc(t('courtsHelp'))} ${esc(t('courtsDefaultsHelp'))}</p>
      ${courtList(courts, '/courts', t)}
    </div>`
  const venueFields = (x, prefix) => `
    <div class="row">
      <div><label for="${prefix}name">${esc(t('venueName'))}</label>
        <input id="${prefix}name" name="name" value="${esc(x.name || '')}" maxlength="80" required placeholder="M9 Maia"></div>
      <div><label for="${prefix}maps">${esc(t('mapsLink'))}</label>
        <input id="${prefix}maps" name="maps_url" type="url" value="${esc(x.maps_url || '')}" placeholder="https://maps.app.goo.gl/…"></div>
    </div>
    <label for="${prefix}addr">${esc(t('address'))}</label>
    <input id="${prefix}addr" name="address" value="${esc(x.address || '')}" maxlength="160">`
  const venuesPanel = `
    <div class="card">
      <h3>${ic('pin')}${esc(t('venues'))}</h3>
      <p class="muted">${esc(t('venuesHelp'))}</p>
      <div class="venuelist">${venues.map((x) => `<form class="venue" data-key="venue-${x.id}" method="post" action="/venues/${x.id}">
        ${x.id === home ? `<span class="pill on">${ic('home')} ${esc(t('homeBadge'))}</span>` : ''}
        ${venueFields(x, `v${x.id}`)}
        <div class="actions">
          <button>${ic('check')}${esc(t('save'))}</button>
          ${x.id === home ? '' : `<button class="btn ghost" formaction="/home" formnovalidate name="home_venue_id" value="${x.id}">${ic('home')}${esc(t('makeHome'))}</button>`}
          <button class="btn danger" formaction="/venues/${x.id}/delete" formnovalidate>${ic('trash')}${esc(t('remove'))}</button>
        </div>
      </form>`).join('') || `<p class="muted">${esc(t('noVenuesYet'))}</p>`}</div>
      ${notice ? `<div class="flash" role="status"><strong>${esc(notice)}</strong></div>` : ''}
      <form class="venue add" method="post" action="/venues">
        <h4>${esc(t('addVenue'))}</h4>
        ${venueFields({}, 'vnew')}
        <div class="actions"><button>${ic('plus')}${esc(t('add'))}</button></div>
      </form>
      <form class="venue add" method="post" action="/venues/bulk">
        <h4>${esc(t('addVenues'))}</h4>
        <p class="muted">${esc(t('addVenuesHelp'))}</p>
        <textarea name="text" rows="5" required placeholder="M9 | https://maps.app.goo.gl/…&#10;Padel Norte&#10;Clube de Ténis do Porto | https://maps.app.goo.gl/…"></textarea>
        <div class="actions"><button>${ic('plus')}${esc(t('add'))}</button></div>
      </form>
    </div>`
  const langForm = `
    <form class="card" method="post" action="/settings">
      <h3>${ic('globe')}${esc(t('language'))}</h3>
      <p class="muted">${esc(t('languageHelp'))}</p>
      <label for="lang">${esc(t('language'))}</label>
      <select id="lang" name="language">${LANGUAGES.map((l) => `<option value="${l.code}"
        ${l.code === t.lang ? 'selected' : ''}>${esc(l.label)}</option>`).join('')}</select>
      <input type="hidden" name="tab" value="language">
      <div class="actions"><button>${ic('check')}${esc(t('save'))}</button></div>
    </form>`
  const policyForm = `
    <form class="card" method="post" action="/settings">
      <h3>${ic('doc')}${esc(t('dropoutPolicy'))}</h3>
      <p class="muted">${esc(t('dropoutPolicyHelp'))}</p>
      <label for="rules_en">${esc(t('inEnglish'))}</label>
      <textarea id="rules_en" name="rules_en" style="min-height:96px">${esc(club.rules_en)}</textarea>
      <label for="rules_pt">${esc(t('inPortuguese'))}</label>
      <textarea id="rules_pt" name="rules_pt" style="min-height:96px">${esc(club.rules_pt)}</textarea>
      <label for="rules_uk">${esc(t('inUkrainian'))}</label>
      <textarea id="rules_uk" name="rules_uk" style="min-height:96px">${esc(club.rules_uk || '')}</textarea>
      <label for="rules_es">${esc(t('inSpanish'))}</label>
      <textarea id="rules_es" name="rules_es" style="min-height:96px">${esc(club.rules_es || '')}</textarea>
      <input type="hidden" name="tab" value="policy">
      <div class="actions"><button>${ic('check')}${esc(t('save'))}</button></div>
    </form>`

  return page(t('settings'), `
    <h1>${esc(t('settings'))}</h1>
    ${tabbed([
      { id: 'venues', icon: 'flag', label: t('venues'), count: venues.length || null, body: venuesPanel },
      { id: 'courts', icon: 'court', label: t('courts'), count: courts.length, body: courtsPanel },
      { id: 'language', icon: 'globe', label: t('language'), body: langForm },
      { id: 'policy', icon: 'doc', label: t('tabPolicy'), body: policyForm },
    ], 'venues')}`, { nav: navFor('/settings', t), t, here: '/settings', tab: 'venues' })
}

export function tournamentsPage({ tournaments, venues = [], home = '', form = {}, error = '', imported = null, pasted = '', notice = '', filter = '', t }) {
  const today = todayISO()
  const cat = form.level_category || 'MX'
  const grade = String(form.level_grade || (imported ? '' : 4))
  const catOpts = categories(t).map((c) => `<option value="${c.code}" data-label="${esc(c.label)}"
    ${c.code === cat ? 'selected' : ''}>${esc(c.label)} (${c.code})</option>`).join('')
  const gradeOpts = (grade ? '' : `<option value="" data-label="" data-blurb="" selected disabled>—</option>`)
    + grades(t).map((g) => `<option value="${g.grade}" data-label="${esc(g.label)}"
    data-blurb="${esc(g.blurb)}" ${String(g.grade) === grade ? 'selected' : ''}
    >${g.grade} — ${esc(g.label)}</option>`).join('')
  const cmd = '!tournament non-stop level MX-4 date 2026-09-05 11:00 courts 3 duration 120'

  // What the import understood, shown beside the fields it filled in so the
  // host checks a summary rather than re-reading sixteen lines.
  const pairs = imported ? imported.players.filter((p) => p.partner).length / 2 : 0
  const readout = imported ? `
    <div class="readout">
      <strong>${esc(t('importFound'))}</strong>
      <span class="pill on">${esc(t('importPlayers', { n: imported.players.length }))}</span>
      ${pairs ? `<span class="pill on">${esc(t('importPairs', { n: pairs }))}</span>` : ''}
      ${imported.location ? `<span class="muted">${esc(t(imported.matchedVenue ? 'importVenueMatched' : 'importLocation', { place: imported.location }))}</span>` : ''}
      ${imported.warnings.map((w) => `<p class="err">${ic('alert')} ${esc(w)}</p>`).join('')}
      ${imported.players.length ? `<ol class="roster">${imported.players.map((p) =>
        `<li>${esc(p.name)}${p.partner ? ` <span class="muted">&amp; ${esc(p.partner)}</span>` : ''}</li>`).join('')}</ol>` : ''}
    </div>` : ''

  const list = tournaments.map((x) => `<div class="card"><div class="head">
      <div style="min-width:0"><strong>${esc(x.level) || esc(t('statusOpen'))}</strong>
        <span class="muted"> · ${esc(levelShort(x.level, t))}</span><br>
        <span class="muted">${esc(humanWhen(x, { lang: t.lang }))} · ${
          esc(t('courtsN', { n: x.courts }))}${x.venue && !filter ? ` · ${esc(x.venue)}` : ''}</span></div>
      <div class="rowact">
        <a class="btn ghost" href="/t/${x.id}">${esc(t('open'))}${ic('arrow')}</a>
        <form method="post" action="/t/${x.id}/delete" onsubmit="return confirm(${
          JSON.stringify(t('deleteConfirm', { name: `${x.level || ''} ${humanWhen(x, { lang: t.lang })}`.trim() })).replace(/"/g, '&quot;')})">
          <button class="btn danger" aria-label="${esc(t('deleteTournament'))}">${ic('trash')}<span>${esc(t('remove'))}</span></button>
        </form>
      </div></div></div>`).join('')

  if (filter) {
    return page(t('nightsAt', { place: filter }), `
      <h1>${ic('pin')} ${esc(t('nightsAt', { place: filter }))}</h1>
      <p class="meta"><a href="/tournaments">${ic('arrow')}${esc(t('allNights'))}</a></p>
      ${list || `<p class="muted">${esc(t('noNightsAt', { place: filter }))}</p>`}
    `, { nav: navFor('/tournaments', t), t, here: '/tournaments' })
  }

  return page(t('newTournament'), `
    <h1>${esc(t('newTournament'))}</h1>
    ${notice ? `<div class="flash" role="status"><strong>${esc(notice)}</strong></div>` : ''}
    <form class="card" method="post" action="/tournaments/import">
      <h3>${ic('chat')}${esc(t('importTitle'))}</h3>
      <p class="muted">${esc(t('importHelp'))}</p>
      <textarea name="text" rows="8" placeholder="${esc(t('importPlaceholder'))}" required>${esc(pasted)}</textarea>
      <div class="actions"><button class="${imported ? 'btn ghost' : ''}">${ic('board')}${esc(t('importRead'))}</button></div>
    </form>
    <form class="card" method="post" action="/tournaments">
      ${error ? `<p class="err">${ic('alert')} ${esc(error)}</p>` : ''}
      ${readout}
      ${form.roster ? `<input type="hidden" name="roster" value="${esc(form.roster)}">` : ''}
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
      <label for="venue">${esc(t('venue'))}</label>
      <select id="venue" name="venue">
        <option value=""${form.venue ? '' : ' selected'}>${esc(t('homeClubOption', { name: home }))}</option>
        ${venues.filter((x) => x.name !== home).map((x) => `<option value="${esc(x.name)}"${
          form.venue === x.name ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}
        ${form.venue && form.venue !== home && !venues.some((x) => x.name === form.venue)
          ? `<option value="${esc(form.venue)}" selected>${esc(form.venue)}</option>` : ''}
      </select>
      <p class="hint">${esc(t('venueHelp'))} <a href="/settings#venues">${esc(t('manageClubs'))}</a></p>
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
      <div class="actions"><button>${ic('plus')}${esc(imported && imported.players.length
        ? t('importCreateWith', { n: imported.players.length }) : t('create'))}</button></div>
      <p class="note" style="margin-top:16px">${
        esc(t('botDoesTheSame', { cmd: '\u0000' })).replace('\u0000',
          `<span class="mono">${esc(cmd)}</span>`)}</p>
    </form>
    ${list}
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
  if (flash.signed) {
    return `<div class="flash" role="status"><strong>${
      esc(t('importedSignups', { n: Number(flash.signed) || 0 }))}</strong></div>`
  }
  if (flash.what === 'pairs') {
    return `<div class="flash" role="status"><strong>${
      esc(t('savedPairs', { n: Number(flash.n) || 0 }))}</strong>${flash.tg === 'redrawn' ? `<span>${esc(t('redrawn'))}</span>` : ''}</div>`
  }
  if (flash.what === 'scores') {
    const n = Number(flash.n) || 0
    return `<div class="flash" role="status"><strong>${
      esc(n ? t('savedScores', { n }) : t('savedNothing'))}</strong></div>`
  }
  bits.push(bits.length
    ? `<span>${esc(t('sentDraft'))}</span>`
    : `<strong>${esc(t('sentDraft'))}</strong><a href="/groups">${esc(t('outbox'))} →</a>`)
  return `<div class="flash ${flash.tg === 'err' ? 'bad' : ''}" role="status">${bits.join('')}</div>`
}

export function tournamentPage({
  tournament: tour, teams, waiting, matches, table, message, roundText, tableText = '', scheduleText = '',
  courts, flash, pinned = false, night = false, place = null, t,
}) {
  const rounds = roundsOf(matches)
  const now = currentRound(matches)
  const flashFor = (what) => (flash && flash.what === what ? flashLine(flash, t) : '')
  // A mixed level asks every pair to be one of each. The host would otherwise
  // find out at the draw, which is too late to fix by messaging anyone.
  // Only a pair whose genders are both known, and the same, is off a mixed
  // level. An imported roster knows nobody's gender, and that is not a fault.
  const known = (p) => p.gender === 'M' || p.gender === 'F'
  const offLevel = isMixedLevel(tour.level)
    ? teams.filter((x) => x.players.every(known) && !x.mixed) : []
  const allDone = rounds.length > 0 && rounds.every((r) => roundComplete(matches, r))
  // Where the host is in the night decides which tab opens: sign-ups before the
  // draw, the rounds during it, the table once every score is in.
  const active = !matches.length ? 'board' : allDone ? 'table' : 'rounds'

  const board = `
    <div class="card"><h3>${ic('board')}${esc(t('signupBoard'))}</h3>
      ${flashFor('board')}
      <pre class="msg" id="msg-board">${esc(message)}</pre>
      <div class="actions">
        <form method="post" action="/t/${tour.id}/post">
          <button>${ic('megaphone')}${esc(t('postToGroups'))}</button></form>
        ${copyBtn('msg-board', t)}
        <a class="btn ghost" href="/groups">${ic('inbox')}${esc(t('outbox'))}</a>
      </div>
    </div>
    <form class="danger-zone" method="post" action="/t/${tour.id}/delete"
      onsubmit="return confirm(${JSON.stringify(t('deleteConfirm', { name: `${tour.level || ''} ${humanWhen(tour, { lang: t.lang })}`.trim() })).replace(/"/g, '&quot;')})">
      <button class="btn danger">${ic('trash')}${esc(t('deleteTournament'))}</button>
    </form>`

  // Before the draw the Teams tab is the pairs board; after it, the list. A
  // seat per two players, one extra for an odd count so nobody is off the board.
  const chip = (p) => `<button type="button" class="chip" data-name="${esc(p.name)}" data-gender="${esc(p.gender || '')}"
    data-grade="${p.grade || ''}" draggable="false">${ic('grip', 'grip')}${
    p.gender === 'F' || p.gender === 'M' ? `<span class="g ${p.gender}">${p.gender}</span>` : ''}<span class="name">${esc(p.name)}</span>${
    p.grade ? `<span class="lv" title="${esc(`${t('skillLevel')}: ${p.grade} — ${t(`grade${p.grade}`)}`)}">${p.grade}</span>` : ''}</button>`
  const everyone = teams.flatMap((x) => x.players).concat(waiting)
  const seatCount = Math.max(teams.length, Math.ceil(everyone.length / 2))
  const mixedNote = offLevel.length ? `<p class="err">${ic('alert')} ${esc(t('mixedWarning', {
    bad: offLevel.length, total: teams.length,
    verb: t(offLevel.length === 1 ? 'isNotAre' : 'areNotIs'),
    names: offLevel.map((x) => x.name).join(', '),
  }))}</p>` : ''
  const scored = matches.some((m) => m.score_a != null || m.score_b != null)
  const pairsBoard = `
    <form class="card" method="post" action="/t/${tour.id}/pairs"${matches.length && scored
      ? ` onsubmit="return confirm(${JSON.stringify(t('pairsRedrawConfirm')).replace(/"/g, '&quot;')})"` : ''}>
      <h3>${ic('users')}${esc(t('pairsTitle'))} <span class="pill on">${esc(t('importPairs', { n: teams.length }))}</span></h3>
      <p class="muted">${esc(t('pairsHelp'))}${matches.length ? ` ${esc(t('pairsLocked'))}` : ''}</p>
      ${flashFor('pairs')}
      ${mixedNote}
      <div id="pairs">
        <div class="pairs" data-mixed="${isMixedLevel(tour.level) ? 1 : ''}">${Array.from({ length: seatCount }, (_, i) => `<div class="pair">
          <span class="num">${i + 1}</span>
          ${[0, 1].map((k) => `<div class="seat" aria-label="${esc(t('seatEmpty'))}">${
            teams[i] && teams[i].players[k] ? chip(teams[i].players[k]) : ''}</div>`).join('')}
        </div>`).join('')}</div>
        <div class="tray" data-empty="${esc(t('nobodyYet'))}" aria-label="${esc(t('unpaired'))}">${
          waiting.map(chip).join('')}</div>
      </div>
      <input type="hidden" name="seats" value="[]">
      <div class="pairsbar">
        <button>${ic(matches.length ? 'shuffle' : 'check')}${esc(matches.length ? t('saveAndRedraw') : t('save'))}</button>
        <button type="button" class="btn ghost" data-act="rest">${ic('shuffle')}${esc(t('pairUpRest'))}</button>
        <button type="button" class="btn ghost" data-act="all">${ic('repeat')}${esc(t('reshuffleAll'))}</button>
        <button type="button" class="btn ghost" data-act="balance" title="${esc(t('balanceHelp'))}">${ic('scale')}${esc(t('balanceByLevel'))}</button>
      </div>
    </form>`

  const teamsPanel = pairsBoard + (teams.length ? `
    <div class="card"><h3>${ic('users')}${esc(t('teams'))} (${teams.length})</h3>
      ${wrapTable(`<tbody>${teams.map((x, i) => `<tr><td class="pos">${i + 1}</td>
        <td class="lead">${esc(x.name)}</td>
        <td>${x.mixed ? `<span class="pill on">${esc(t('mixed'))}</span>` : ''}</td></tr>`).join('')
        || `<tr><td class="muted">${esc(t('nobodyYet'))}</td></tr>`}</tbody>`, 'stack')}
      ${waiting.length ? `<h3 style="margin-top:16px">${ic('hourglass')}${esc(t('waiting'))} (${waiting.length})</h3>
        ${wrapTable(`<tbody>${waiting.map((p) => `<tr><td class="lead">${esc(p.name)}</td>
          <td class="muted full">${esc(p.partner ? t('waitingOn', { name: p.partner })
            : t('noPartner'))}</td></tr>`).join('')}</tbody>`, 'stack')}` : ''}
    </div>` : '')

  // Before the draw the rounds tab is the draw itself; after it, the scores
  // are the primary task and the round message is one collapsed preview above
  // them — it posts itself when a round completes, so it rarely needs opening.
  // Courts belong to the night. Once a schedule names one it can still be
  // renamed (its matches follow) but not removed from under the schedule.
  const inSchedule = new Set(matches.map((m) => m.court))
  const nightCourts = courts.map((c) => ({ ...c, locked: inSchedule.has(c.label) }))
  // Before the draw the courts are part of setting the night up, so the card
  // is open; after it they are a detail, folded above the scores so they can
  // still be found and renamed without scrolling past every round.
  const courtsBody = `
      <p class="muted">${esc(t('courtsNightHelp'))}${matches.length ? ` ${esc(t('courtsNightLocked'))}` : ''}</p>
      ${courtList(nightCourts, `/t/${tour.id}/courts`, t, { fixed: matches.length > 0 })}`
  const courtsCard = matches.length ? `
    <details class="card fold"><summary><h3>${ic('court')}${esc(t('courtsNight'))} <span class="pill">${courts.length}</span></h3>${ic('arrow')}</summary>
      ${courtsBody}
    </details>` : `
    <div class="card"><h3>${ic('court')}${esc(t('courtsNight'))} <span class="pill">${courts.length}</span></h3>
      ${courtsBody}
    </div>`
  const roundsPanel = !matches.length ? `
    <div class="card"><h3>${ic('list')}${esc(t('schedule'))}</h3>
      <p class="muted">${esc(t('noSchedule'))}</p>
      <form method="post" action="/t/${tour.id}/schedule"><div class="actions">
        <button ${teams.length < 2 ? 'disabled' : ''}>${ic('shuffle')}${esc(t('drawSchedule'))}</button></div></form>
      ${teams.length < 2 ? `<p class="hint">${esc(t('needTwoPairs'))}</p>` : ''}
    </div>${courtsCard}` : `
    ${courtsCard}
    <div class="card"><h3>${ic('compass')}${esc(t('roundTitle'))} <span class="pill on">${
      esc(t('roundN', { n: now }))}</span></h3>
      <p class="muted">${esc(t('roundHelp'))}</p>
      ${flashFor(`round-${now}`)}
      <div class="actions" style="margin-top:8px">
        <form method="post" action="/t/${tour.id}/post">
          <input type="hidden" name="round" value="${now}">
          <button>${ic('megaphone')}${esc(t('postToGroups'))}</button></form>
        ${copyBtn('msg-round', t)}
      </div>
      <details class="preview"><summary>${ic('arrow')}${esc(t('preview'))}</summary>
        <pre class="msg" id="msg-round">${esc(roundText)}</pre></details>
    </div>
    ${scheduleText ? `<div class="card"><h3>${ic('calendar')}${esc(t('allRounds'))}</h3>
      <p class="muted">${esc(t('allRoundsHelp'))}</p>
      ${flashFor('schedule')}
      <div class="actions" style="margin-top:8px">
        <form method="post" action="/t/${tour.id}/post">
          <input type="hidden" name="what" value="schedule">
          <button>${ic('megaphone')}${esc(t('postToGroups'))}</button></form>
        ${copyBtn('msg-schedule', t)}
      </div>
      <details class="preview"><summary>${ic('arrow')}${esc(t('preview'))}</summary>
        <pre class="msg" id="msg-schedule">${esc(scheduleText)}</pre></details>
    </div>` : ''}
    <form class="card" method="post" action="/t/${tour.id}/scores">
      <h3>${ic('list')}${esc(t('schedule'))}</h3>
      ${flashFor('scores')}
      ${rounds.map((r) => `<div class="roundhead" id="round-${r}">
        <h4>${esc(t('roundN', { n: r }))}${r === now && !allDone ? ` <span class="pill on">${esc(t('nowShort'))}</span>` : ''}</h4>
        <button type="submit" class="link" formaction="/t/${tour.id}/post" name="round" value="${r}"
          formnovalidate>${esc(t('postRound', { n: r }))}</button>
      </div>${matches.filter((m) => m.round === r).map((m) => matchBlock(m, t)).join('')}`).join('')}
      <div class="savebar"><button>${ic('check')}${esc(t('saveAll'))}</button></div>
    </form>`

  // The table stays a table on a phone: a ranking is read down a column, and
  // four short numbers fit beside a name. Headings abbreviate below 480px.
  const th = (key, short) => `<th class="num"><span class="long">${esc(t(key))}</span><span class="short">${esc(short)}</span></th>`
  const tablePanel = `
    <div class="card"><h3>${ic('trophy')}${esc(t('standings'))}</h3>
      ${wrapTable(`<thead><tr><th>#</th><th>${esc(t('team'))}</th>${th('played', 'P')}${th('won', 'W')}${
        th('points', 'Pts')}${th('against', 'Ag')}</tr></thead>
      <tbody>${table.map((r, i) => `<tr class="${i < 3 ? 'top' : ''}" data-key="${esc(r.team)}"><td class="pos">${i + 1}</td>
        <td class="team">${esc(r.team)}</td>
        <td class="num">${r.played}</td>
        <td class="num">${r.won}</td>
        <td class="num"><strong>${r.points}</strong></td>
        <td class="num muted">${r.against}</td></tr>`).join('')
        || `<tr><td class="muted" colspan="6">${esc(t('noResults'))}</td></tr>`}</tbody>`, 'standings')}
    </div>
    ${tableText ? `<div class="card"><h3>${ic('chat')}${esc(t('shareTable'))}</h3>
      <p class="muted">${esc(t('shareTableHelp'))}</p>
      ${flashFor('table')}
      <pre class="msg" id="msg-table">${esc(tableText)}</pre>
      <div class="actions">
        <form method="post" action="/t/${tour.id}/post">
          <input type="hidden" name="what" value="table">
          <button>${ic('megaphone')}${esc(t('postToGroups'))}</button></form>
        ${copyBtn('msg-table', t)}
      </div>
    </div>` : ''}`

  return page(`${tour.level || ''} ${humanWhen(tour, { lang: t.lang })}`.trim(), `
    <h1>${esc(tour.level) || esc(t('statusOpen'))} · ${esc(humanWhen(tour, { lang: t.lang }))}</h1>
    <p class="muted">${esc(levelLabel(tour.level, t))}</p>
    <p class="meta">
      ${place ? `<span class="place">${place.url
        ? `<a class="pinlink" href="${esc(place.url)}" target="_blank" rel="noopener" aria-label="${esc(t('openInMaps'))}" title="${esc(t('openInMaps'))}">${ic('pin')}</a>`
        : `<span class="pinlink off">${ic('pin')}</span>`}<a href="/tournaments?venue=${encodeURIComponent(place.name)}">${esc(place.name)}</a></span>` : ''}
      <span>${ic('court')}${esc(t('courtsN', { n: tour.courts }))}</span>
      <span>${ic('clock')}${esc(t('minutes', { n: tour.duration_min }))}</span>
      <span>${ic('repeat')}${esc(t('minRounds', { n: tour.round_min }))}</span>
      <span class="pill">${esc(statusLabel(tour.status, t))}</span>
      ${night ? `<span><span class="pill on">${esc(t('activeNight'))}</span>${pinned ? '' : ` <span class="muted">${esc(t('autoNight'))}</span>`}</span>` : ''}
      <a href="/t/${tour.id}/tv">${ic('tv')}${esc(t('tvView'))}</a>
      <form method="post" action="/t/${tour.id}/activate" class="inline" title="${esc(t('activeHelp'))}">
        ${pinned ? '<input type="hidden" name="off" value="1">' : ''}
        <button class="link">${ic(pinned ? 'x' : 'pin')}${esc(pinned ? t('unsetActive') : t('makeActive'))}</button>
      </form></p>
    ${tabbed([
      { id: 'board', icon: 'board', label: t('tabBoard'), body: board },
      { id: 'teams', icon: 'users', label: t('tabTeams'), count: teams.length, body: teamsPanel },
      { id: 'rounds', icon: 'list', label: t('tabRounds'), count: rounds.length || null, body: roundsPanel },
      { id: 'table', icon: 'trophy', label: t('tabTable'), body: tablePanel },
    ], active)}`, { nav: navFor('/tournaments', t), t, here: '/tournaments', tab: active })
}

/**
 * The clubhouse tablet: every pair, every round, which court — on one screen.
 *
 * It stands by the courts for the whole night, and the one question it answers
 * is "where do I go next". So the heart of it is a grid: a row per pair, in
 * alphabetical order because that is how you look for your own name, and a
 * column per round holding the court. The round being played is filled, the
 * next one outlined, the ones already played dimmed — you find your row and
 * read across. Beside it, who is on which court right now and who is leading.
 *
 * It never scrolls. Type sizes come from the night itself: the server passes the
 * number of rows and columns, and CSS divides the screen by them, so six pairs
 * are read from across the room and sixteen still fit an iPad without a second
 * page. It refreshes itself in place — no white flash every twenty seconds —
 * keeps the screen awake, and goes full screen on the first tap.
 */
/** Longest pair name the wall prints in full; past it, surnames become initials. */
const TV_NAME = 22

export function tvPage({ tournament: tour, club, teams, matches, table, place = '', t }) {
  const rounds = roundsOf(matches)
  const allDone = rounds.length > 0 && rounds.every((r) => roundComplete(matches, r))
  const round = currentRound(matches)
  const next = !allDone && rounds.includes(round + 1) ? round + 1 : 0
  const plan = rounds.length ? roundPlan({ tournament: tour, matches, teams, round }) : null
  const from = plan ? clock(plan.start, { lang: t.lang }) : ''
  const to = plan ? clock(plan.end, { lang: t.lang }) : ''
  const scored = matches.some((m) => m.score_a != null)

  // Pair → court, per round. A missing entry is a pair sitting that round out.
  const where = new Map(rounds.map((r) => [r, courtsByTeam(matches, r)]))
  const points = new Map(table.map((r) => [r.team, r.points]))
  const pairs = teams.map((x) => x.name)
    .sort((a, b) => a.localeCompare(b, t.lang, { sensitivity: 'base' }))

  // A pair as the wall shows it. A long name keeps each first name and drops
  // the surnames to an initial — "Inês F. & Eduardo C." is still recognisable
  // from across the court, "Inês Figueiredo & Edua…" loses the partner.
  const shown = new Map(teams.map(({ name }) => [name, name.length <= TV_NAME ? name
    : name.split(/\s*&\s*/).map((p) => {
      const w = p.trim().split(/\s+/)
      return w.length > 1 ? `${w[0]} ${w[w.length - 1][0]}.` : p.trim()
    }).join(' & ')]))
  const label = (name) => shown.get(name) || name
  const nameEm = Math.min(13, Math.max(7, ...[...shown.values()].map((n) => n.length * 0.56)))

  // How much there is to fit, in em. The grid is a name column, a narrow
  // column per round (a court is one or two characters), wider ones for now and
  // next, and the points; the side is two lines per court plus its headings.
  const courts = plan ? plan.games.length : 0
  const loud = rounds.filter((r) => (r === round && !allDone) || r === next).length
  // Heights are in em as rendered: a grid row is 2em with its padding and the
  // larger now/next digits, the heading 1.7; a court on the side is two lines,
  // 2.95em; a table line 1.75.
  const gridCols = nameEm + 0.6 + (rounds.length - loud) * 1.9 + loud * 2.8 + (scored ? 2.6 : 0)
  const gridEm = 1.7 + pairs.length * 2
  const courtsEm = plan && !allDone ? 1.6 + courts * 2.95 + (plan.resting.length ? 1.5 : 0) : 0
  const leadEm = allDone ? 1.6 + table.length * 1.75 : scored ? 1.6 + 3 * 1.75 : 0
  // Stacked in one column beside the grid, or side by side under it.
  const sideEm = courtsEm + leadEm + (courtsEm && leadEm ? 0.6 : 0)
  const sidePortraitEm = Math.max(courtsEm, leadEm, 1)

  const cell = (r, name) => {
    const court = where.get(r)?.get(name)
    const cls = [r === round && !allDone ? 'now' : r === next ? 'next' : r < round || allDone ? 'past' : '']
    if (!court) return `<td class="${cls} rest" title="${esc(t('sittingOut'))}">${ic('coffee')}</td>`
    return `<td class="${cls}">${esc(court)}</td>`
  }
  const head = (r) => `<th class="${r === round && !allDone ? 'now' : r === next ? 'next' : r < round || allDone ? 'past' : ''}">${
    r === round && !allDone ? esc(t('nowShort')) : r === next ? esc(t('tvNext')) : esc(t('tvRound', { n: r }))}</th>`

  // Widths live on <col>, in the table's own em. On a <th> they would be in the
  // heading's smaller em, and the digits underneath would spill past them.
  const kind = (r) => (r === round && !allDone ? 'now' : r === next ? 'next' : '')
  const grid = rounds.length ? `<table class="where">
      <colgroup><col class="who" style="width:${(nameEm + 0.6).toFixed(1)}em">${rounds.map((r) => `<col class="${kind(r) ? 'loud' : 'r'}">`).join('')}${
        scored ? '<col class="pts">' : ''}</colgroup>
      <thead><tr><th class="who">${esc(t('tvPair'))}</th>${rounds.map(head).join('')}${
        scored ? `<th class="pts">${esc(t('tvPts'))}</th>` : ''}</tr></thead>
      <tbody>${pairs.map((name) => `<tr><td class="who" title="${esc(name)}">${esc(label(name))}</td>${
        rounds.map((r) => cell(r, name)).join('')}${
        scored ? `<td class="pts">${points.get(name) ?? 0}</td>` : ''}</tr>`).join('')}</tbody>
    </table>` : `<p class="muted big">${esc(t('notDrawn'))}</p>`

  const onCourt = plan && !allDone ? `
    <h2>${ic('court')}<span class="t">${esc(t('roundOfN', { n: round, total: rounds.length }))}</span>${
      from && to ? `<span class="when">${esc(from)} → ${esc(to)}</span>` : ''}</h2>
    <ul class="games">${plan.games.map((m) => `<li>
      <span class="c">${esc(m.court)}</span>
      <span class="a">${esc(label(m.team_a))}</span><span class="b"><em>${esc(t('vsShort'))}</em> ${esc(label(m.team_b))}</span>
    </li>`).join('')}</ul>
    ${plan.resting.length ? `<p class="resting">${ic('coffee')}${esc(plan.resting.map(label).join(', '))}</p>` : ''}` : ''

  const leaders = allDone
    ? `<h2>${ic('trophy')}${esc(t('tvFinal'))}</h2><ol class="table">${table.map((r, i) => `<li class="${i < 3 ? 'top' : ''}">
        <span class="p">${i + 1}</span><span class="n">${esc(label(r.team))}</span><span class="s">${r.points}</span></li>`).join('')}</ol>`
    : scored ? `<h2>${ic('trophy')}${esc(t('tvLeading'))}</h2><ol class="table">${table.slice(0, 3).map((r, i) => `<li class="top">
        <span class="p">${i + 1}</span><span class="n">${esc(label(r.team))}</span><span class="s">${r.points}</span></li>`).join('')}</ol>`
      : ''

  const body = `<header class="tvhead">
    <h1>${esc(place || club.name)} <span>· ${esc(levelShort(tour.level, t))}</span></h1>
    <span class="sub">${esc(humanWhen(tour, { lang: t.lang, tbc: '' }))} · ${esc(t('minRounds', { n: tour.round_min }))}</span>
    <span class="hint" id="hint">${esc(t('tvFullscreen'))}</span>
    <span class="clock" id="clock"></span>
  </header>
  <main class="tv" style="--gw:${gridCols.toFixed(1)};--gh:${gridEm.toFixed(1)};--sh:${
    Math.max(sideEm, 1).toFixed(1)};--shp:${sidePortraitEm.toFixed(1)};--ghf:${gridEm.toFixed(1)}fr;--shf:${
    (sidePortraitEm + 0.5).toFixed(1)}fr">
    <section class="left">${grid}</section>
    <section class="side"><div class="in">${onCourt ? `<div>${onCourt}</div>` : ''}${leaders ? `<div>${leaders}</div>` : ''}</div></section>
  </main>`

  return `<!doctype html><html lang="${t.lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<noscript><meta http-equiv="refresh" content="20"></noscript>
<title>${esc(club.name)} — ${esc(t('live'))}</title>${FAVICON}<style>${CSS}
html,body{height:100%}
body{margin:0;padding:1.6vh 2vw;overflow:hidden;display:flex;flex-direction:column;gap:1.4vh;
  font-variant-numeric:tabular-nums}
/*
 * Spacing is margins, not flex gap: a Galaxy Tab 2 tops out at Chrome 71, which
 * ignores gap in flex layouts — "Round 4 of 12" and "7:36PM" ran together into
 * "Round 4 of 127:36PM". Same for every flex row on this page.
 */
/*
 * One line, always: a second header line on a 7-inch screen with the browser
 * toolbar showing is a tenth of the height the grid needed. When it is tight
 * the date gives way first, then the club name; the clock never does.
 */
.tvhead{display:flex;align-items:baseline;flex-wrap:nowrap;white-space:nowrap;font-size:18px;
  font-size:clamp(13px,min(1.7vw,2.6vh),26px)}
.tvhead h1{font-size:1.9em;margin:0 .6em 0 0;line-height:1.1;flex:0 1 auto;min-width:0;
  overflow:hidden;text-overflow:ellipsis}
.tvhead h1 span{color:var(--muted);font-weight:600}
.tvhead .sub{color:var(--muted);flex:1 1 0;min-width:0;overflow:hidden;text-overflow:ellipsis}
.tvhead .hint{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:.75em;
  color:var(--muted);margin:0 1em;opacity:.8}
.tvhead .clock{flex:0 0 auto;font-weight:800;font-size:1.5em}
:fullscreen .tvhead .hint{display:none}
:-webkit-full-screen .tvhead .hint{display:none}
.tv{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,2.3fr) minmax(0,1fr);
  grid-template-rows:minmax(0,1fr);grid-column-gap:2vw;grid-row-gap:1.6vh}
/*
 * Each panel is a size container, and the type inside it is whichever is
 * tighter: its width divided by the em the night needs across (--gw, --sw), or
 * its height divided by the rows (--gr, --sr). The server counts; CSS divides.
 */
.tv section{min-height:0;min-width:0;container-type:size;overflow:hidden}
.tv section.tight{overflow-y:auto}

/*
 * The grid is sized from the night: --gr rows and --gw em of width must fit the
 * space it has, so the type is whichever of the two is tighter. The height
 * budget is the viewport minus the header; 1.85em is one row.
 */
table.where{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;margin:0;
  font-size:max(11px,min(calc(100cqw / var(--gw)),calc(100cqh / var(--gh)),44px))}
table.where th,table.where td{padding:.26em .2em;text-align:center;line-height:1.25;
  border-bottom:1px solid var(--line);white-space:nowrap}
table.where th{font-size:.62em;color:var(--muted);letter-spacing:.04em;text-transform:uppercase;
  font-weight:800;border-bottom:2px solid var(--line)}
table.where .who{text-align:left;overflow:hidden;text-overflow:ellipsis;font-weight:600;padding-left:.3em}
table.where col.r{width:1.9em}
table.where col.loud{width:2.8em}
table.where col.pts{width:2.6em}
table.where .pts{font-weight:800;color:var(--brand)}
table.where th,table.where td{overflow:hidden}
table.where td.now,table.where td.next{font-size:1.12em}
table.where th.now,table.where th.next{font-size:.7em;letter-spacing:.02em}
table.where td{font-weight:700}
table.where .past{color:var(--muted);opacity:.45;font-weight:500}
table.where td.now{background:var(--brand);color:var(--brand-ink);font-weight:900}
table.where th.now{background:var(--brand);color:var(--brand-ink);border-radius:.4em .4em 0 0}
table.where td.next,table.where th.next{box-shadow:inset 2px 0 var(--accent),inset -2px 0 var(--accent);color:var(--accent);font-weight:900}
table.where th.next{box-shadow:inset 2px 0 var(--accent),inset -2px 0 var(--accent),inset 0 2px var(--accent);border-radius:.4em .4em 0 0}
table.where tbody tr:last-child td.next{box-shadow:inset 2px 0 var(--accent),inset -2px 0 var(--accent),inset 0 -2px var(--accent)}
table.where td.rest .i{width:.9em;height:.9em;opacity:.55;vertical-align:-.1em}
table.where td.now.rest .i{opacity:.9}
table.where tbody tr:nth-child(even) td.who{background:color-mix(in oklab,var(--surface) 55%,transparent)}
.big{font-size:clamp(18px,3vw,40px)}

/* The side has its own budget: two lines a court, three leaders, headings. */
.side>.in{font-size:max(11px,min(calc(100cqw / 16),calc(100cqh / var(--sh)),34px))}
.side>.in>div+div{margin-top:.5em}
.side h2{font-size:1em;margin:0 0 .15em;line-height:1.3}
.side h2 .i{width:1em;height:1em;margin:0 .35em 0 0;vertical-align:-.12em}
.side h2 .t{white-space:nowrap}
.side h2 .when{color:var(--muted);font-weight:600;font-size:.8em;margin-left:.5em;white-space:nowrap}
ul.games,ol.table{list-style:none;margin:0;padding:0}
ul.games li{display:grid;grid-template-columns:2.4em minmax(0,1fr);grid-column-gap:.5em;
  padding:.2em 0;border-bottom:1px solid var(--line)}
ul.games .c{grid-row:span 2;align-self:center;font-weight:900;color:var(--accent);font-size:1.25em;text-align:center}
ul.games .a,ul.games .b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3}
ul.games em{font-style:normal;color:var(--muted);font-size:.75em;margin-right:.2em}
.resting{margin:0;color:var(--muted);font-size:.85em}
.resting .i{width:1em;height:1em;margin-right:.3em;vertical-align:-.12em}
ol.table li{display:grid;grid-template-columns:1.6em minmax(0,1fr) auto;grid-column-gap:.5em;align-items:baseline;
  padding:.15em 0;border-bottom:1px solid var(--line)}
ol.table .p{font-weight:900;color:var(--brand)}
ol.table .n{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
ol.table .s{font-weight:800}

/* Portrait: the grid on top, the courts and leaders underneath. */
@media (orientation:portrait) and (min-width:600px){
  /* Rows shared in proportion to what each needs, so neither starves the other. */
  .tv{grid-template-columns:1fr;grid-template-rows:minmax(0,var(--ghf)) minmax(0,var(--shf))}
  /* Two columns underneath — courts, then leaders — so each needs half the rows. */
  .side>.in{font-size:max(11px,min(calc(50cqw / 16),calc(100cqh / var(--shp)),34px));
    display:grid;grid-template-columns:1fr 1fr;align-content:start;grid-column-gap:3vw}
  .side>.in>div+div{margin-top:0}
}
/* A phone held up in the clubhouse: normal type, and scrolling is fine. */
@media (max-width:599px){
  .tvhead{flex-wrap:wrap;white-space:normal}
  .tvhead .sub{flex-basis:100%;order:3}
  body{overflow:auto;height:auto;padding:12px}
  .tv{grid-template-columns:1fr;gap:18px}
  .tv section{container-type:normal;overflow:visible}
  table.where,.side>.in{font-size:15px}
  .tv .left{overflow-x:auto}
  table.where{min-width:calc(var(--gw) * 1em)}
}
</style></head><body>
${SPRITE}
<div id="tv-root" style="display:contents">${body}</div>
<script>
(function(){
  var lang=document.documentElement.lang;
  function tick(){var el=document.getElementById('clock');if(!el)return;
    el.textContent=new Date().toLocaleTimeString(lang,{hour:'2-digit',minute:'2-digit'})}
  tick();setInterval(tick,10000);

  // Every panel gets the largest type at which its content fits its box —
  // found by bisection, so it grows as readily as it shrinks. Modern CSS gives
  // a close first guess; this is what makes it true, and it is the only sizing
  // an older tablet gets: Chrome 71 on a Galaxy Tab 2 drops min(), max() and
  // container units entirely and would otherwise sit at 16px on any night.
  // Whether a name is cut off, from the text's own width in its own font.
  // Neither engine the Tab 2 can run reports an ellipsised box honestly —
  // Firefox 68's scrollWidth and Range both give the visible width — so the
  // text is measured on a canvas, which knows nothing about the clipping.
  var cv=document.createElement('canvas').getContext('2d');
  function cut(n){var cs=getComputedStyle(n);
    cv.font=cs.fontStyle+' '+cs.fontWeight+' '+cs.fontSize+' '+cs.fontFamily;
    var room=n.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);
    return cv.measureText(n.textContent).width>room+.5}
  function fit(){
    if(innerWidth<600)return;
    var secs=document.querySelectorAll('.tv section');
    for(var s=0;s<secs.length;s++){
      var sec=secs[s],el=sec.querySelector('table.where,.in');if(!el)continue;
      // A name cut off with an ellipsis doesn't fit either: someone looking
      // for their pair has to be able to read it.
      var names=el.querySelectorAll('td.who,.a,.b,.n');
      var fits=function(f){el.style.fontSize=f+'px';var r=el.getBoundingClientRect();
        if(r.height>sec.clientHeight||r.width>sec.clientWidth+.5||el.scrollWidth>sec.clientWidth)return false;
        for(var k=0;k<names.length;k++)if(cut(names[k]))return false;
        return true};
      var lo=11,hi=el.tagName==='TABLE'?44:34;
      sec.className=sec.className.replace(/ ?tight/g,'');
      if(fits(hi))continue;
      for(var i=0;i<9;i++){var mid=(lo+hi)/2;if(fits(mid))lo=mid;else hi=mid}
      // Too much night for this screen even at the smallest readable size:
      // the panel scrolls rather than silently dropping the last pairs.
      if(!fits(lo))sec.className+=' tight';
    }
  }
  fit();addEventListener('resize',fit);
  // The hint is for whoever sets the tablet up; after that it is only in the way.
  setTimeout(function(){var h=document.getElementById('hint');if(h){h.style.display='none';fit()}},20000);
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fit);

  // Refresh in place: fetch the page, swap the content, keep the clock going.
  // A meta refresh blanks the screen every twenty seconds; this doesn't.
  setInterval(function(){
    fetch(location.href,{credentials:'same-origin',cache:'no-store'}).then(function(r){
      if(!r.ok)throw 0;return r.text()}).then(function(html){
      var doc=new DOMParser().parseFromString(html,'text/html');
      var next=doc.getElementById('tv-root');if(!next)return;
      var cur=document.getElementById('tv-root');
      if(cur.innerHTML!==next.innerHTML){cur.innerHTML=next.innerHTML;tick();fit()}
    }).catch(function(){});
  },15000);

  // A tablet left by the courts goes to sleep in two minutes unless told not to.
  var lock=null;
  function awake(){if(!('wakeLock' in navigator)||document.visibilityState!=='visible')return;
    navigator.wakeLock.request('screen').then(function(l){lock=l}).catch(function(){})}
  awake();document.addEventListener('visibilitychange',awake);
  document.addEventListener('click',function(){
    awake();
    var d=document.documentElement;
    if(document.fullscreenElement||document.webkitFullscreenElement)return;
    var go=d.requestFullscreen||d.webkitRequestFullscreen;
    if(go){try{var p=go.call(d);if(p&&p.catch)p.catch(function(){})}catch(e){}}
  });
})();
</script>
</body></html>`
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
        ? groups.outbox().map((m, i) => `<div class="outmsg">
          <pre class="msg" id="out-${i}">${esc(m.text)}</pre>
          <div class="actions">${copyBtn(`out-${i}`, t)}${m.reason ? `<span class="pill">${esc(m.reason)}</span>` : ''}</div>
        </div>`).join('')
        : `<p class="muted">${esc(t('nothingWaiting'))}</p>`}
    </div>`, { nav: navFor('/groups', t), t, here: '/groups' })
}


/** A level as people say it: "4 — Upper intermediate", or a dash when unrated. */
const levelName = (g, t) => (g ? `${g} — ${t(`grade${g}`)}` : t('levelUnset'))
const levelOptions = (g, t) => `<option value="0"${g ? '' : ' selected'}>${esc(t('levelUnset'))}</option>${
  grades(t).map((x) => `<option value="${x.grade}"${x.grade === g ? ' selected' : ''}>${esc(levelName(x.grade, t))}</option>`).join('')}`
const nights = (n, t) => t(n === 1 ? 'nightsPlayed1' : 'nightsPlayed', { n })
/** The date part of a stored timestamp, read in the club's language. */
const onDay = (at, t) => (at ? humanDate(String(at).slice(0, 10), { lang: t.lang }) : '')
/** Up is better: a lower grade number is a stronger player. */
const trend = (g, prev, t) => (!g || !prev || g === prev ? ''
  : g < prev ? `<span class="trend up" title="${esc(t('levelUp'))}">${ic('up')}${esc(t('levelUp'))}</span>`
    : `<span class="trend down" title="${esc(t('levelDown'))}">${ic('down')}${esc(t('levelDown'))}</span>`)

/** Filter the register as you type — no request, just rows hidden. */
const PLAYERS_JS = `pbInit.push(function(){
  var q=document.getElementById('psearch');if(!q)return;
  var norm=function(x){return x.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase()};
  q.addEventListener('input',function(){var v=norm(q.value.trim());
    document.querySelectorAll('.prow').forEach(function(r){r.hidden=v&&norm(r.dataset.name).indexOf(v)<0})});
});`

/**
 * The player register: everyone who has signed up, and how good they are now.
 *
 * Levels are the same 1–7 ladder the nights use. Changing one here records the
 * change with its date, so a player's page tells the story of their game. The
 * whole list is one form — change several levels after a night, Save all once.
 */
export function playersPage({ players, notice = '', t }) {
  const rows = players.map((p) => `<div class="prow" data-name="${esc(p.name)}">
      <div class="who"><a href="/players/${p.id}">${esc(p.name)}</a>
        <div class="sub">${p.gender === 'M' || p.gender === 'F' ? `<span class="pill">${esc(t(p.gender === 'F' ? 'genderF' : 'genderM'))}</span>` : ''}
          ${trend(p.grade, p.prev_grade, t)}
          ${p.changed_at ? `<span>${esc(t('since', { when: onDay(p.changed_at, t) }))}</span>` : ''}
          <span>${esc(nights(p.nights, t))}</span></div></div>
      <select name="grade${p.id}" aria-label="${esc(t('skillLevel'))} — ${esc(p.name)}">${levelOptions(p.grade, t)}</select>
    </div>`).join('')

  return page(t('players'), `
    <h1>${esc(t('players'))}</h1>
    <p class="muted">${esc(t('playersHelp'))}</p>
    ${notice ? `<div class="flash" role="status"><strong>${esc(notice)}</strong></div>` : ''}
    <form class="card" method="post" action="/players/levels">
      <h3>${ic('user')}${esc(t('players'))} <span class="pill">${players.length}</span></h3>
      ${players.length ? `<input id="psearch" class="search" type="search" placeholder="${esc(t('searchPlayers'))}" aria-label="${esc(t('searchPlayers'))}" autocomplete="off">
      <div class="plist">${rows}</div>
      <label for="pnote">${esc(t('levelNote'))}</label>
      <input id="pnote" name="note" maxlength="200" placeholder="${esc(t('levelNotePlaceholder'))}">
      <div class="savebar"><button>${ic('check')}${esc(t('saveAll'))}</button></div>`
        : `<p class="muted">${esc(t('noPlayersYet'))}</p>`}
    </form>
    <form class="card" method="post" action="/players/bulk">
      <h3>${ic('plus')}${esc(t('addPlayers'))}</h3>
      <p class="muted">${esc(t('addPlayersHelp'))}</p>
      <textarea name="text" rows="5" required placeholder="Rui Basto | M | 4&#10;Rita | F&#10;Carla Guerra | F | 5"></textarea>
      <div class="actions"><button>${ic('plus')}${esc(t('add'))}</button></div>
    </form>`, { nav: navFor('/players', t), t, here: '/players', script: PLAYERS_JS })
}

/** One player: their level and its history, who they are, the nights they played. */
export function playerPage({ player: p, notice = '', t }) {
  const hist = p.history.map((h, i) => {
    const prev = p.history[i + 1]?.grade
    return `<li><span class="when">${esc(onDay(h.at, t))}</span>
      <strong>${esc(levelName(h.grade, t))}</strong>${trend(h.grade, prev, t)}
      ${h.note ? `<span class="hnote">${esc(h.note)}</span>` : ''}</li>`
  }).join('')
  return page(p.name, `
    <p class="meta"><a href="/players">${ic('arrow')}${esc(t('allPlayers'))}</a></p>
    <h1>${esc(p.name)}</h1>
    <p class="meta">
      <span class="pill on">${esc(levelName(p.grade, t))}</span>
      ${p.gender === 'M' || p.gender === 'F' ? `<span>${esc(t(p.gender === 'F' ? 'genderF' : 'genderM'))}</span>` : ''}
      <span>${ic('trophy')}${esc(nights(p.nights.length, t))}</span></p>
    ${notice ? `<div class="flash" role="status"><strong>${esc(notice)}</strong></div>` : ''}
    <div class="grid">
      <form class="card" method="post" action="/players/${p.id}/level">
        <h3>${ic('up')}${esc(t('adjustLevel'))}</h3>
        <label for="plevel">${esc(t('skillLevel'))}</label>
        <select id="plevel" name="grade">${levelOptions(p.grade, t)}</select>
        <label for="pnote1">${esc(t('levelNote'))}</label>
        <input id="pnote1" name="note" maxlength="200" placeholder="${esc(t('levelNotePlaceholder'))}">
        <div class="actions"><button>${ic('check')}${esc(t('save'))}</button></div>
      </form>
      <div class="card"><h3>${ic('list')}${esc(t('levelHistory'))}</h3>
        ${hist ? `<ol class="history">${hist}</ol>` : `<p class="muted">${esc(t('noLevelYet'))}</p>`}
      </div>
    </div>
    <form class="card" method="post" action="/players/${p.id}">
      <h3>${ic('user')}${esc(t('playerDetails'))}</h3>
      <div class="row">
        <div><label for="pname">${esc(t('playerName'))}</label>
          <input id="pname" name="name" value="${esc(p.name)}" maxlength="80" required></div>
        <div><label for="pgender">${esc(t('gender'))}</label>
          <select id="pgender" name="gender">
            <option value=""${p.gender ? '' : ' selected'}>—</option>
            <option value="F"${p.gender === 'F' ? ' selected' : ''}>${esc(t('genderF'))}</option>
            <option value="M"${p.gender === 'M' ? ' selected' : ''}>${esc(t('genderM'))}</option>
          </select></div>
      </div>
      <label for="pnotes">${esc(t('playerNotes'))}</label>
      <textarea id="pnotes" name="notes" rows="3" maxlength="500">${esc(p.notes)}</textarea>
      <div class="actions">
        <button>${ic('check')}${esc(t('save'))}</button>
        <button class="btn danger" formaction="/players/${p.id}/delete" formnovalidate
          onclick="return confirm(${JSON.stringify(t('deletePlayerConfirm', { name: p.name })).replace(/"/g, '&quot;')})">${ic('trash')}${esc(t('remove'))}</button>
      </div>
    </form>
    <div class="card"><h3>${ic('calendar')}${esc(t('nightsTitle'))}</h3>
      ${p.nights.length ? `<div class="plist">${p.nights.map((x) => `<div class="prow"><div class="who">
        <a href="/t/${x.id}">${esc(x.level || '')} · ${esc(humanWhen(x, { lang: t.lang }))}</a>
        ${x.venue ? `<div class="sub">${esc(x.venue)}</div>` : ''}</div></div>`).join('')}</div>`
        : `<p class="muted">${esc(t('noNightsYet'))}</p>`}
    </div>`, { nav: navFor('/players', t), t, here: '/players' })
}

export const _internal = { esc, parseLevel, statusLabel }
