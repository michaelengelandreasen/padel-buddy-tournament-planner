// Chromium 71 over the DevTools protocol: for each Galaxy Tab 2 viewport and
// night, load the tablet page and report what actually rendered.
//   node --experimental-websocket measure-chrome.mjs <ip:9222> <base> <cases.json> [shotDir]
import fs from 'node:fs'
const [host, base, casesFile, shotDir = ''] = process.argv.slice(2)
// `node --test` runs every file under test/; without arguments this is that, not a run.
if (!casesFile) { console.log('skipped — run test/tab2/run.sh'); process.exit(0) }
const label = 'chrome71'
const cases = JSON.parse(fs.readFileSync(casesFile, 'utf8'))
const tabs = await (await fetch(`http://${host}/json`)).json()
const page = tabs.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl.replace(/ws:\/\/[^/]+/, `ws://${host}`))
await new Promise((r) => { ws.onopen = r })
let id = 0; const wait = new Map(); const logs = []
ws.onmessage = (m) => { const d = JSON.parse(m.data)
  if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id) }
  if (d.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).split('\n')[0])
  if (d.method === 'Runtime.consoleAPICalled' && /error|warn/.test(d.params.type)) logs.push(d.params.type + ' ' + d.params.args.map((a) => a.value || a.description).join(' ')) }
const send = (method, params = {}) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await send('Runtime.enable'); await send('Page.enable')
const MEASURE = `(function(){var d=document,e=d.documentElement,out={};
  var secs=[].slice.call(d.querySelectorAll('.tv section'));
  out.clip=secs.map(function(x){var c=x.querySelector('table.where,.in');return c?Math.max(0,Math.round(c.getBoundingClientRect().height-x.clientHeight)):0}).join('/');
  out.tight=d.querySelectorAll('.tv section.tight').length;out.pageOver=(e.scrollHeight>innerHeight+1||e.scrollWidth>innerWidth+1);
  var g=d.querySelector('table.where'),si=d.querySelector('.side>.in');
  out.grid=g?Math.round(parseFloat(getComputedStyle(g).fontSize)*10)/10:0;
  out.side=si?Math.round(parseFloat(getComputedStyle(si).fontSize)*10)/10:0;
  out.used=g?Math.round(g.getBoundingClientRect().height/g.parentNode.clientHeight*100):0;
  out.cells=[].slice.call(d.querySelectorAll('table.where td:not(.who)')).filter(function(c){return c.scrollWidth>c.clientWidth+1}).length;var cv=d.createElement('canvas').getContext('2d');out.trunc=[].slice.call(d.querySelectorAll('td.who,.a,.b,.n')).filter(function(c){var cs=getComputedStyle(c);cv.font=cs.fontStyle+' '+cs.fontWeight+' '+cs.fontSize+' '+cs.fontFamily;return cv.measureText(c.textContent).width>c.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)+.5}).length;
  return JSON.stringify(out)})()`
let fails = 0
for (const [path, w, h, name] of cases) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: base + path })
  await sleep(2500)
  const r = await send('Runtime.evaluate', { expression: MEASURE, returnByValue: true })
  const m = JSON.parse(r.result.result.value || '{}')
  const ok = m.clip === '0/0' && !m.tight && !m.pageOver && !m.cells && !m.trunc
  if (!ok) fails++
  console.log(`${label.padEnd(8)} ${name.padEnd(26)} ${ok ? 'FITS ' : 'FAIL '} grid ${String(m.grid).padStart(4)}px side ${String(m.side).padStart(4)}px  height used ${String(m.used).padStart(3)}%  clipped ${m.clip}  cellsOverflow ${m.cells}  namesCut ${m.trunc}`)
  if (shotDir) { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${shotDir}/${label}-${name.replace(/\W+/g, '_')}.png`, Buffer.from(s.result.data, 'base64')) }
}
if (logs.length) console.log('console:', [...new Set(logs)].join(' | ')); else console.log(`${label}: no console errors`)
ws.close(); process.exit(fails ? 1 : 0)
