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
tabs.forEach(function(b){b.addEventListener('click',function(){show(b.dataset.tab,true)});
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
    ${courts.map((c) => `<div class="courtrow">
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
 * Saves without a page load.
 *
 * Every POST form on the page is fetched instead of navigated: the server
 * answers as it always did — a redirect to the page it just changed — and the
 * content of that page replaces this one's, tab kept, scroll kept, URL updated.
 * A redirect to a *different* page (create, delete) is a real navigation and
 * is followed as one. Anything unexpected falls back to a plain submit, so the
 * server routes remain the one source of truth and scripting off still works.
 */
const AJAX_JS = `window.pbInit=window.pbInit||[];
function pbBoot(){window.pbInit.forEach(function(f){try{f()}catch(e){console.error(e)}})}
(function(){
  var wrap=document.querySelector('.wrap');if(!wrap)return;
  document.addEventListener('submit',function(e){
    var form=e.target;if(!(form instanceof HTMLFormElement)||e.defaultPrevented)return;
    if((form.method||'get').toLowerCase()!=='post'||!wrap.contains(form))return;
    if(!window.fetch||!window.DOMParser)return;
    e.preventDefault();
    var btn=e.submitter,action=(btn&&btn.getAttribute('formaction'))||form.getAttribute('action')||location.pathname;
    var data=btn?new FormData(form,btn):new FormData(form);
    if(btn){btn.disabled=true;btn.classList.add('busy')}
    var y=scrollY;
    fetch(action,{method:'POST',body:new URLSearchParams(data),credentials:'same-origin',
      headers:{'Accept':'text/html'},redirect:'follow'}).then(function(res){
      var to=new URL(res.url,location.href);
      if(to.pathname!==location.pathname){location.assign(to.href);return}
      return res.text().then(function(html){
        var doc=new DOMParser().parseFromString(html,'text/html');
        var next=doc.querySelector('.wrap');if(!next)throw new Error('no page');
        wrap.innerHTML=next.innerHTML;
        document.title=doc.title;
        var tab=doc.body.getAttribute('data-tab');if(tab)document.body.setAttribute('data-tab',tab);
        history.replaceState(null,'',to.pathname+to.search+(to.hash||location.hash));
        pbBoot();
        scrollTo(0,y);
      })
    }).catch(function(err){console.error(err);if(btn){btn.disabled=false;btn.classList.remove('busy')}form.submit()});
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
form.lang{display:flex;gap:2px;flex:0 0 auto;margin-left:8px}
form.lang button{background:transparent;color:var(--muted);border:1px solid transparent;
  min-height:44px;min-width:44px;padding:0 10px;font-size:.82rem;font-weight:800;letter-spacing:.03em}
form.lang button.on{color:var(--brand-ink);background:var(--brand)}

.i{width:1.1em;height:1.1em;flex:0 0 auto;fill:none;stroke:currentColor;stroke-width:2;
  stroke-linecap:round;stroke-linejoin:round;vertical-align:-.18em}
h3 .i,h2 .i{width:20px;height:20px;color:var(--muted);margin-right:.4em;vertical-align:-.22em}
button .i,.btn .i,nav a .i{width:18px;height:18px}
.meta{display:flex;flex-wrap:wrap;gap:6px 16px;align-items:center;color:var(--muted);margin:0 0 .5rem}
.meta>span,.meta>a{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
/* The pin opens the map, the name opens the venue's nights: two links, one item. */
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
const langToggle = (lang, here) => `<form class="lang" method="post" action="/language">${
  here ? `<input type="hidden" name="back" value="${esc(here)}">` : ''}${
  LANGUAGES.map((l) => `<button name="language" value="${l.code}"
    class="${l.code === lang ? 'on' : ''}" aria-label="${esc(l.label)}"
    ${l.code === lang ? 'aria-current="true"' : ''}>${l.short}</button>`).join('')}</form>`

export function page(title, body, { nav = '', script = '', t = translator(), here = '', tab = '' } = {}) {
  return `<!doctype html><html lang="${t.lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="dark">
<title>${esc(title)}</title><style>${CSS}</style>
<script>document.documentElement.classList.add('js')</script></head><body${
  tab ? ` data-tab="${esc(tab)}"` : ''}>
<header class="top"><a class="brand" href="/">${LOGO}
<strong>Padel Buddy</strong><small>${esc(t('navTournaments'))}</small></a>
<nav>${nav}</nav>${langToggle(t.lang, here)}</header>
${SPRITE}
<div class="wrap">${body}</div><script>${AJAX_JS}</script><script>${TABS_JS}</script><script>${PAIRS_JS}</script><script>${COPY_JS}</script>${script ? `<script>${script}</script>` : ''}<script>pbBoot()</script></body></html>`
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
 * One match: the court, then a line per team with that team's box on it, and a
 * per-match Save for the host who types one result at a time from courtside.
 * It is a block inside the panel's single scores form, not a form of its own —
 * so every box on the page can also be saved at once from the bar underneath.
 * Each name is the input's own <label>, so the accessible name is the team.
 */
const matchBlock = (m, t) => `<div class="match">
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

export function overview({ club, tournaments, courts, live, pinned = 0, night = 0, t }) {
  return page(t('navOverview'), `
    <h1>${esc(club.name)}</h1>
    <p class="meta"><span>${ic('pin')}${esc(club.address) || esc(t('noAddress'))}</span>${
      club.maps_url ? `<a href="${esc(club.maps_url)}">${esc(t('openInMaps'))}${ic('arrow')}</a>` : ''}</p>
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

export function settings({ club, courts, venues = [], t }) {
  const clubForm = `
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
      <input type="hidden" name="tab" value="club">
      <div class="actions"><button>${ic('check')}${esc(t('save'))}</button></div>
    </form>`
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
      <div class="venuelist">${venues.map((x) => `<form class="venue" method="post" action="/venues/${x.id}">
        ${venueFields(x, `v${x.id}`)}
        <div class="actions">
          <button>${ic('check')}${esc(t('save'))}</button>
          <button class="btn danger" formaction="/venues/${x.id}/delete" formnovalidate>${ic('trash')}${esc(t('remove'))}</button>
        </div>
      </form>`).join('') || `<p class="muted">${esc(t('noVenuesYet'))}</p>`}</div>
      <form class="venue add" method="post" action="/venues">
        <h4>${esc(t('addVenue'))}</h4>
        ${venueFields({}, 'vnew')}
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
      <input type="hidden" name="tab" value="policy">
      <div class="actions"><button>${ic('check')}${esc(t('save'))}</button></div>
    </form>`

  return page(t('settings'), `
    <h1>${esc(t('settings'))}</h1>
    ${tabbed([
      { id: 'club', icon: 'flag', label: t('club'), body: clubForm },
      { id: 'courts', icon: 'court', label: t('courts'), count: courts.length, body: courtsPanel },
      { id: 'venues', icon: 'pin', label: t('venues'), count: venues.length || null, body: venuesPanel },
      { id: 'language', icon: 'globe', label: t('language'), body: langForm },
      { id: 'policy', icon: 'doc', label: t('tabPolicy'), body: policyForm },
    ], 'club')}`, { nav: navFor('/settings', t), t, here: '/settings', tab: 'club' })
}

export function tournamentsPage({ tournaments, venues = [], form = {}, error = '', imported = null, pasted = '', notice = '', filter = '', t }) {
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
      <input id="venue" name="venue" value="${esc(form.venue || '')}" maxlength="80" list="venues"
        placeholder="${esc(t('venueHelp'))}" autocomplete="off">
      <datalist id="venues">${venues.map((x) => `<option value="${esc(x.name)}">`).join('')}</datalist>
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
  const chip = (p) => `<button type="button" class="chip" data-name="${esc(p.name)}" draggable="false">${
    ic('grip', 'grip')}${
    p.gender === 'F' || p.gender === 'M' ? `<span class="g ${p.gender}">${p.gender}</span>` : ''}<span class="name">${esc(p.name)}</span></button>`
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
        <div class="pairs">${Array.from({ length: seatCount }, (_, i) => `<div class="pair">
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
      ${rounds.map((r) => `<div class="roundhead">
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
      <tbody>${table.map((r, i) => `<tr class="${i < 3 ? 'top' : ''}"><td class="pos">${i + 1}</td>
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
export function tvPage({ tournament: tour, club, teams, matches, table, place = '', t }) {
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
<div class="tvhead"><h1>${esc(place || club.name)} — ${esc(levelShort(tour.level, t))}</h1>
<span class="sub">${esc(humanWhen(tour, { lang: t.lang, tbc: '' }))} · ${
  esc(t('minRounds', { n: tour.round_min }))}</span></div>
<div class="tv">
  <div>
    <h2>${plan ? esc(t('roundOfN', { n: round, total: rounds.length })) : esc(t('nowOnCourt'))}${
      from && to ? `<span class="when">${esc(from)} → ${esc(to)}</span>` : ''}</h2>
    <div class="tablewrap"><table>
    ${plan ? plan.games.map((m) => `<tr>
      <td class="court">${ic('court')}${esc(courtName(m.court, t))}</td><td>${esc(m.team_a)}</td>
      <td class="vs">${esc(t('vsShort'))}</td><td>${esc(m.team_b)}</td></tr>`).join('')
      : `<tr><td class="muted">${esc(t('notDrawn'))}</td></tr>`}
    </table></div>
    ${plan && plan.resting.length
      ? `<p class="rest">${ic('coffee')}${esc(t('sittingOut'))}: ${esc(plan.resting.join(', '))}</p>` : ''}
    ${goes.length ? `<div class="next">
      <h2>${ic('compass')}${esc(t('nextRoundAt', { n: round + 1, at: to || '—' }))}</h2>
      <div class="tablewrap"><table>
      ${goes.map((g) => `<tr class="${g.court ? '' : 'off'}">
        <td class="court">${g.court ? ic('court') : ic('coffee')}${esc(g.court ? courtName(g.court, t) : t('sittingOut'))}</td><td>${esc(g.name)}</td></tr>`).join('')}
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
        ? groups.outbox().map((m, i) => `<div class="outmsg">
          <pre class="msg" id="out-${i}">${esc(m.text)}</pre>
          <div class="actions">${copyBtn(`out-${i}`, t)}${m.reason ? `<span class="pill">${esc(m.reason)}</span>` : ''}</div>
        </div>`).join('')
        : `<p class="muted">${esc(t('nothingWaiting'))}</p>`}
    </div>`, { nav: navFor('/groups', t), t, here: '/groups' })
}

export const _internal = { esc, parseLevel, statusLabel }
