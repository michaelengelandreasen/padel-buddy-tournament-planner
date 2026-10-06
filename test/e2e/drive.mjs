// End-to-end drive of the console in a real browser, over the DevTools protocol.
// Every page, every tab, every form, at phone width; console errors and failed
// requests collected. Creates and deletes its own tournament and clubs.
//
//   chrome --headless=new --remote-debugging-port=9333 --remote-allow-origins='*' about:blank &
//   node test/e2e/drive.mjs            # needs Node 22+ (global WebSocket, fetch)
//
// BASE, BASIC_AUTH and CDP default to the VPN URL, the club login and a local
// Chrome; override with env. `node --test` picks this file up with everything
// else, so with no browser to drive it reports a skip rather than a failure —
// a missing Chrome is not a broken console.
import { readFileSync } from 'node:fs'
const base = process.env.BASE || 'https://padel-tournament-planner.mikehome.users.ctx7.dev'
const auth = 'Basic ' + Buffer.from(process.env.BASIC_AUTH || 'padel:buddy').toString('base64')
const cdp = process.env.CDP || 'http://127.0.0.1:9333'
let ver
try {
  ver = await (await fetch(`${cdp}/json/new?about:blank`, { method: 'PUT' })).json()
} catch (err) {
  console.log(`skipped — no browser on ${cdp} (${err.cause?.code || err.message})`)
  process.exit(0)
}
const ws = new WebSocket(ver.webSocketDebuggerUrl)
await new Promise((r) => { ws.onopen = r })
let id = 0; const pending = new Map(); const errors = []; const failed = []
ws.onmessage = (m) => {
  const d = JSON.parse(m.data)
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); return }
  if (d.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).split('\n')[0])
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push('console.error: ' + d.params.args.map((a) => a.value || a.description).join(' ').slice(0, 160))
  if (d.method === 'Network.responseReceived' && d.params.response.status >= 400) failed.push(d.params.response.status + ' ' + d.params.response.url.replace(base, ''))
}
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const js = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) return 'JS ERROR: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text).split('\n')[0]; return r.result?.result?.value }
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const until = async (expr, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await js(expr); if (v) return v; await wait(150) } return false }
const go = async (path) => { await send('Page.navigate', { url: base + path }); await wait(1200); await js('window.__alive=1;1') }
const alive = () => js('window.__alive===1')
const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')) }
const submit = async (formSel, btnSel) => js(`(function(){var f=document.querySelector(${JSON.stringify(formSel)});if(!f)return 'no form';var b=${btnSel ? `f.querySelector(${JSON.stringify(btnSel)})||document.querySelector(${JSON.stringify(btnSel)})` : 'null'};f.requestSubmit(b||undefined);return 'submitted'})()`)
const q = (sel) => js(`!!document.querySelector(${JSON.stringify(sel)})`)
const text = (sel) => js(`(document.querySelector(${JSON.stringify(sel)})||{}).textContent||''`)
const tab = () => js(`(document.querySelector('.tabs [aria-selected=true]')||{}).dataset?.tab||''`)
const clickTab = async (name) => { await js(`document.querySelector('.tabs [data-tab=${name}]').click();1`); await wait(100) }

await send('Network.enable'); await send('Network.setExtraHTTPHeaders', { headers: { Authorization: auth } })
await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
// confirm() always yes — deletes and redraws are part of the path
await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.confirm=function(){return true}' })

// ---------- Overview ----------
await go('/')
check('overview loads', (await text('h1')).length > 0, await text('h1'))
check('overview: tournament rows have Open + Remove', await js(`document.querySelectorAll('td.rowact .btn.ghost').length>0 && document.querySelectorAll('td.rowact .btn.ghost').length===document.querySelectorAll('td.rowact .btn.danger').length`))
check('overview: no sideways overflow @390', await js('document.documentElement.scrollWidth<=innerWidth'), await js('document.documentElement.scrollWidth+"/"+innerWidth'))

// ---------- Settings: clubs ----------
await go('/settings')
check('settings opens on Clubs', (await tab()) === 'venues', await tab())
const clubsBefore = await js(`document.querySelectorAll('form.venue:not(.add)').length`)
await js(`document.querySelector('#vnewname').value='E2E Club';document.querySelector('#vnewmaps').value='https://maps.app.goo.gl/e2e';1`)
await submit('form.venue.add[action="/venues"]')
await until(`document.querySelectorAll('form.venue:not(.add)').length===${clubsBefore}+1`)
check('clubs: add one (in place)', (await alive()) && (await js(`document.querySelectorAll('form.venue:not(.add)').length`)) === clubsBefore + 1)
check('clubs: still on Clubs tab after save', (await tab()) === 'venues')
await js(`document.querySelector('form.venue.add[action="/venues/bulk"] textarea').value='E2E Two | https://maps.app.goo.gl/two\\nE2E Club\\nE2E Three';1`)
await submit('form.venue.add[action="/venues/bulk"]')
await until(`document.querySelector('.flash')&&/Added 2/.test(document.querySelector('.flash').textContent)`)
check('clubs: bulk add skips the duplicate', /Added 2/.test(await text('.flash')), (await text('.flash')).trim())
// make E2E Club home, then back
const e2eId = await js(`[...document.querySelectorAll('form.venue:not(.add)')].find(f=>f.querySelector('input[name=name]').value==='E2E Club')?.action.split('/').pop()`)
const homeId = await js(`[...document.querySelectorAll('form.venue:not(.add)')].find(f=>f.querySelector('.pill'))?.action.split('/').pop()`)
await js(`[...document.querySelectorAll('form.venue:not(.add)')].find(f=>f.action.endsWith('/${e2eId}')).querySelector('button[formaction="/home"]').click();1`)
await until(`[...document.querySelectorAll('form.venue:not(.add)')].find(f=>f.action.endsWith('/${e2eId}'))?.querySelector('.pill')`)
check('clubs: make home moves the badge', await js(`!![...document.querySelectorAll('form.venue:not(.add)')].find(f=>f.action.endsWith('/${e2eId}'))?.querySelector('.pill')`))
await js(`[...document.querySelectorAll('form.venue:not(.add)')].find(f=>f.action.endsWith('/${homeId}')).querySelector('button[formaction="/home"]').click();1`)
await until(`[...document.querySelectorAll('form.venue:not(.add)')].find(f=>f.action.endsWith('/${homeId}'))?.querySelector('.pill')`)
check('clubs: home restored', await js(`!![...document.querySelectorAll('form.venue:not(.add)')].find(f=>f.action.endsWith('/${homeId}'))?.querySelector('.pill')`))
// courts: rename all
await clickTab('courts')
await js(`document.querySelectorAll('.courtlist input')[0].value='E2E';1`)
await submit('.courtlist', '.courtlist .actions button')
await until(`document.querySelectorAll('.courtlist input')[0].value==='E2E'&&window.__alive===1`)
check('courts: Save all renames in place', (await js(`document.querySelectorAll('.courtlist input')[0].value`)) === 'E2E' && await alive())
check('courts: stays on Courts tab', (await tab()) === 'courts')
await js(`document.querySelectorAll('.courtlist input')[0].value='1';1`)
await submit('.courtlist', '.courtlist button.save')
await until(`document.querySelectorAll('.courtlist input')[0].value==='1'`)
check('courts: row Save restores', (await js(`document.querySelectorAll('.courtlist input')[0].value`)) === '1')
// policy save
await clickTab('policy')
await submit('#tab-policy form')
await until(`window.__alive===1&&document.querySelector('#rules_en')`)
check('policy: save lands back on Policy', (await tab()) === 'policy' && await alive())

// ---------- Language toggle (full reload, by design) ----------
await js(`document.querySelector('form.lang button[value=pt]').click();1`)
await wait(1500)
check('language: PT renders, no raw keys', /Definições/.test(await text('h1')) && !(await js(`/\\b(nav[A-Z]\\w+|undefined)\\b/.test(document.body.innerText)`)), await text('h1'))
await js(`document.querySelector('form.lang button[value=en]').click();1`)
await wait(1500)
check('language: back to EN', /Settings/.test(await text('h1')))

// ---------- Tournaments: import → create ----------
await go('/tournaments')
check('tournaments: club dropdown lists home first', /Home club/.test(await js(`document.querySelector('#venue option').textContent`)))
const fixture = readFileSync(new URL('../fixtures/maia.txt', import.meta.url), 'utf8')
await js(`document.querySelector('textarea[name=text]').value=${JSON.stringify(fixture)};1`)
await submit('form[action="/tournaments/import"]')
await until(`document.querySelector('.readout')`)
check('import: readout appears in place (no navigation)', (await q('.readout')) && await alive(), (await text('.readout strong')).trim())
check('import: 16 players, 1 pair', /16 players/.test(await text('.readout')) && /1 pairs/.test(await text('.readout')))
check('import: form prefilled', (await js(`document.querySelector('#play_date').value`)) === '2026-09-13' && (await js(`document.querySelector('#play_time').value`)) === '09:30' && (await js(`document.querySelector('#courts').value`)) === '4')
check('import: address stays /tournaments', (await js('location.pathname')) === '/tournaments', await js('location.pathname'))
await js(`document.querySelector('#level_grade').value='5';document.querySelector('#play_date').value='2026-10-04';1`)
await submit('form[action="/tournaments"]')
await wait(2000)
const tPath = await js('location.pathname')
await js('window.__alive=1;1')
check('create: navigates to the new tournament', /^\/t\/\d+$/.test(tPath), tPath)
check('create: opens on Board with the sign-up flash', (await tab()) === 'board' && /16 players/.test(await text('.flash')), (await text('.flash')).trim())
check('board: message names Sunday 04/10/2026', /04\/10\/2026/.test(await text('#msg-board')))

// ---------- Teams: pairs board ----------
await clickTab('teams')
check('teams: pairs board with a tray of 14', (await js(`document.querySelectorAll('.tray .chip').length`)) === 14, await js(`document.querySelectorAll('.tray .chip').length+''`))
await js(`document.querySelector('[data-act=rest]').click();1`)
check('teams: pair up the rest fills every seat', (await js(`document.querySelectorAll('.tray .chip').length`)) === 0 && (await js(`document.querySelectorAll('.seat .chip').length`)) === 16)
await submit('form[action$="/pairs"]', null)
await until(`document.querySelector('.flash')&&/Saved 8 pairs/.test(document.querySelector('.flash').textContent)`)
check('teams: Save writes 8 pairs in place', /Saved 8 pairs/.test(await text('.flash')) && await alive(), (await text('.flash')).trim())
check('teams: stays on Teams', (await tab()) === 'teams')

// ---------- Rounds: courts, draw, scores ----------
await clickTab('rounds')
check('rounds: courts card shows 4 before the draw', (await js(`document.querySelectorAll('#tab-rounds .courtlist input').length`)) === 4)
await js(`document.querySelector('#tab-rounds .courtlist input').value='Center';1`)
await submit('#tab-rounds .courtlist', '#tab-rounds .courtlist button.save')
await until(`document.querySelector('#tab-rounds .courtlist input')?.value==='Center'`)
check('rounds: court rename in place', (await js(`document.querySelector('#tab-rounds .courtlist input').value`)) === 'Center')
await submit('form[action$="/schedule"]')
await until(`document.querySelectorAll('.match').length>0`)
check('rounds: draw produces matches', (await js(`document.querySelectorAll('.match').length`)) > 0, (await js(`document.querySelectorAll('.match').length`)) + ' matches')
check('rounds: match cards say Court Center', await js(`[...document.querySelectorAll('.match .court')].some(c=>/Center/.test(c.textContent))`))
check('rounds: All rounds card offered (4 courts)', await q('#msg-schedule'))
check('rounds: courts card folded after the draw', await q('details.fold'))
// scores: fill round 1 and Save all
await js(`[...document.querySelectorAll('.match')].slice(0,4).forEach((m,i)=>{var a=m.querySelector('input[name^=a]'),b=m.querySelector('input[name^=b]');a.value=11;b.value=5+i});1`)
await submit('form[action$="/scores"]', '.savebar button')
await until(`document.querySelector('.flash')&&/Saved 4 scores/.test(document.querySelector('.flash').textContent)`)
check('scores: Save all saves 4', /Saved 4 scores/.test(await text('.flash')), (await text('.flash')).trim())
check('scores: values persisted', (await js(`document.querySelector('.match input[name^=a]').value`)) === '11')
check('scores: round 2 is now the round message', /Round 2/.test(await text('#tab-rounds .card:not(.fold) h2 .pill')))
// per-match save on round 2
await js(`var m=document.querySelectorAll('.match')[4];m.querySelector('input[name^=a]').value=7;m.querySelector('input[name^=b]').value=9;1`)
await js(`document.querySelectorAll('.match')[4].querySelector('button.save').click();1`)
await until(`document.querySelector('.flash')&&/Saved 1 scores/.test(document.querySelector('.flash').textContent)`)
check('scores: per-match Save saves 1', /Saved 1 scores/.test(await text('.flash')))
// post round + copy
await submit('#tab-rounds form[action$="/post"]')
await until(`document.querySelector('.flash')&&/outbox/i.test(document.querySelector('.flash').textContent)`)
check('rounds: Post to the groups reports the outbox', /outbox/i.test(await text('.flash')), (await text('.flash')).trim())
check('rounds: Copy buttons present', (await js(`document.querySelectorAll('#tab-rounds [data-copy]').length`)) >= 2)

// ---------- Active night pin / unpin (header form, in place) ----------
await submit('form.inline[action$="/activate"]')
await until(`document.querySelector('form.inline[action$="/activate"] input[name=off]')`)
check('pin: Make active → Unpin, in place', (await q('form.inline[action$="/activate"] input[name=off]')) && await alive() && (await tab()) === 'rounds', 'tab=' + await tab())
await submit('form.inline[action$="/activate"]')
await until(`!document.querySelector('form.inline[action$="/activate"] input[name=off]')`)
check('pin: Unpin restores', !(await q('form.inline[action$="/activate"] input[name=off]')))

// ---------- Teams after the draw: Save and redraw ----------
await clickTab('teams')
check('teams: board still editable after the draw, button says redraw', /redraw/i.test(await text('form[action$="/pairs"] .pairsbar button')), (await text('form[action$="/pairs"] .pairsbar button')).trim())
const before = await js(`document.querySelectorAll('.match').length`)
await js(`document.querySelector('[data-act=all]').click();1`)
await submit('form[action$="/pairs"]', null)
await until(`document.querySelector('.flash')&&/redrawn/i.test(document.querySelector('.flash').textContent)`)
check('teams: Save and redraw reports and keeps the page', /redrawn/i.test(await text('.flash')) && await alive(), (await text('.flash')).trim())
await clickTab('rounds')
check('rounds: schedule exists after redraw, scores cleared', (await js(`document.querySelectorAll('.match').length`)) === before && (await js(`document.querySelector('.match input[name^=a]').value`)) === '')

// ---------- Table ----------
await clickTab('table')
check('table: real table with 8 rows', (await js(`document.querySelectorAll('table.standings tbody tr').length`)) === 8)
check('table: message text present', /Standings/.test(await text('#msg-table')))
await submit('#tab-table form[action$="/post"]')
await until(`document.querySelector('#tab-table .flash')`)
check('table: post lands on Table with a status', (await tab()) === 'table' && await q('#tab-table .flash'))

// ---------- Board: post board, then delete ----------
await clickTab('board')
await submit('#tab-board form[action$="/post"]')
await until(`document.querySelector('#tab-board .flash')`)
check('board: post board reports', await q('#tab-board .flash'), (await text('#tab-board .flash')).trim())
await submit('form.danger-zone')
await wait(1800)
check('delete: navigates to the list with a notice', (await js('location.pathname')) === '/tournaments' && /deleted/i.test(await text('.flash')), await js('location.pathname+location.search'))
check('delete: the tournament is gone', !(await js(`[...document.querySelectorAll('.card .head strong')].some(s=>false)`)) && !(await js(`document.body.innerText.includes('Sunday 4 October')`)))

// ---------- Overview: home picker (4 clubs saved right now) ----------
await go('/')
check('overview: home picker present with several clubs', await q('form.home select'))
const e2eOpt = await js(`[...document.querySelectorAll('form.home option')].find(o=>o.textContent==='E2E Club')?.value`)
await js(`var s=document.querySelector('form.home select');s.value=${JSON.stringify(e2eOpt)};s.dispatchEvent(new Event('change'));1`)
await until(`document.querySelector('h1')&&document.querySelector('h1').textContent==='E2E Club'`)
check('overview: picker switches home in place', (await text('h1')) === 'E2E Club' && await alive(), await text('h1'))
await js(`var s=document.querySelector('form.home select');s.value=${JSON.stringify(String(homeId))};s.dispatchEvent(new Event('change'));1`)
await until(`document.querySelector('h1')&&document.querySelector('h1').textContent!=='E2E Club'`)
check('overview: home restored', (await text('h1')) !== 'E2E Club', await text('h1'))

// ---------- Groups + TV ----------
await go('/groups')
await js(`document.querySelector('#watext').value='!where nico';1`)
await submit('form[action="/groups/simulate"]')
await until(`document.querySelector('pre.msg')`)
check('groups: try a command answers in place', (await q('pre.msg')) && await alive())
check('groups: every outbox message has Copy', await js(`[...document.querySelectorAll('.outmsg')].every(o=>o.querySelector('[data-copy]'))`))
const tvId = await js(`fetch('/api/tournaments').then(r=>r.json()).then(l=>(l.find(x=>x.status==='scheduled')||l[0]||{}).id)`)
await go('/t/' + tvId + '/tv')
check('tv: board renders the current round', /Round \d of \d/.test(await text('.tv h2')), (await text('.tv h2')).trim().slice(0, 30))

// ---------- cleanup: the E2E clubs ----------
await go('/settings')
for (const name of ['E2E Club', 'E2E Two', 'E2E Three']) {
  await js(`var f=[...document.querySelectorAll('form.venue:not(.add)')].find(f=>f.querySelector('input[name=name]').value===${JSON.stringify(name)});if(f)f.querySelector('button.danger').click();1`)
  await wait(900)
}
check('cleanup: E2E clubs removed', !(await js(`[...document.querySelectorAll('form.venue:not(.add) input[name=name]')].some(i=>/^E2E/.test(i.value))`)))

console.log('\n' + results.filter((r) => r.ok).length + '/' + results.length + ' passed')
if (errors.length) console.log('console/exception errors:\n  ' + [...new Set(errors)].join('\n  '))
if (failed.length) console.log('failed requests:\n  ' + [...new Set(failed)].join('\n  '))
ws.close(); process.exit(0)
