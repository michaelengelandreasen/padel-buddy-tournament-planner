// Firefox 68 ESR over Marionette (length-prefixed JSON on TCP): the same
// measurements as measure-chrome.mjs. Firefox 68 has no DevTools protocol.
//   node measure-firefox.mjs <ip:2829> <base> <cases.json> [shotDir]
import net from 'node:net'
import fs from 'node:fs'
const [hp, base, casesFile, shotDir = ''] = process.argv.slice(2)
// `node --test` runs every file under test/; without arguments this is that, not a run.
if (!casesFile) { console.log('skipped — run test/tab2/run.sh'); process.exit(0) }
const [host, port] = hp.split(':'); const label = 'firefox68'
const cases = JSON.parse(fs.readFileSync(casesFile, 'utf8'))
// The length prefix counts bytes, not characters — "Inês" is five bytes.
const sock = net.connect(Number(port), host); let buf = Buffer.alloc(0); const wait = new Map(); let id = 0; let hello
sock.on('data', (d) => { buf = Buffer.concat([buf, d])
  for (;;) { const c = buf.indexOf(58); if (c < 0) return; const n = Number(buf.subarray(0, c).toString()); if (buf.length < c + 1 + n) return
    const msg = JSON.parse(buf.subarray(c + 1, c + 1 + n).toString('utf8')); buf = buf.subarray(c + 1 + n)
    if (!Array.isArray(msg)) { hello && hello(msg); continue }
    const w = wait.get(msg[1]); if (w) { wait.delete(msg[1]); w(msg) } } })
await new Promise((r) => { hello = r })
const cmd = (name, params = {}) => new Promise((r, j) => { const i = ++id
  wait.set(i, (m) => (m[2] ? j(new Error(name + ': ' + JSON.stringify(m[2]))) : r(m[3])))
  const s = JSON.stringify([0, i, name, params]); sock.write(`${Buffer.byteLength(s)}:${s}`) })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await cmd('WebDriver:NewSession', { capabilities: {} })
const MEASURE = `var d=document,e=d.documentElement,out={};
  var secs=[].slice.call(d.querySelectorAll('.tv section'));
  out.clip=secs.map(function(x){var c=x.querySelector('table.where,.in');return c?Math.max(0,Math.round(c.getBoundingClientRect().height-x.clientHeight)):0}).join('/');
  out.pageOver=(e.scrollHeight>innerHeight+1||e.scrollWidth>innerWidth+1);
  var g=d.querySelector('table.where'),si=d.querySelector('.side>.in');
  out.grid=g?Math.round(parseFloat(getComputedStyle(g).fontSize)*10)/10:0;
  out.side=si?Math.round(parseFloat(getComputedStyle(si).fontSize)*10)/10:0;
  out.used=g?Math.round(g.getBoundingClientRect().height/g.parentNode.clientHeight*100):0;
  out.cells=[].slice.call(d.querySelectorAll('table.where td:not(.who)')).filter(function(c){return c.scrollWidth>c.clientWidth+1}).length;
  var cv=d.createElement('canvas').getContext('2d');out.trunc=[].slice.call(d.querySelectorAll('td.who,.a,.b,.n')).filter(function(c){var cs=getComputedStyle(c);cv.font=cs.fontStyle+' '+cs.fontWeight+' '+cs.fontSize+' '+cs.fontFamily;return cv.measureText(c.textContent).width>c.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)+.5}).length;
  out.vp=innerWidth+'x'+innerHeight;out.tight=d.querySelectorAll('.tv section.tight').length;
  return JSON.stringify(out)`
let fails = 0
for (const [path, w, h, name] of cases) {
  // Headless Firefox's window IS the viewport; resize it, then check it took.
  // The window includes chrome even headless; size it so the *viewport* is w×h.
  await cmd('WebDriver:SetWindowRect', { width: w, height: h })
  for (let k = 0; k < 3; k++) {
    const v = JSON.parse((await cmd('WebDriver:ExecuteScript', { script: 'return JSON.stringify([innerWidth,innerHeight,outerWidth,outerHeight])', args: [] })).value)
    if (v[0] === w && v[1] === h) break
    await cmd('WebDriver:SetWindowRect', { width: v[2] + (w - v[0]), height: v[3] + (h - v[1]) })
  }
  await cmd('WebDriver:Navigate', { url: base + path })
  await sleep(2500)
  const r = await cmd('WebDriver:ExecuteScript', { script: MEASURE, args: [] })
  const m = JSON.parse(r.value)
  const ok = m.clip === '0/0' && !m.tight && !m.pageOver && !m.cells && !m.trunc
  if (!ok) fails++
  console.log(`${label.padEnd(8)} ${name.padEnd(26)} ${ok ? 'FITS ' : 'FAIL '} grid ${String(m.grid).padStart(4)}px side ${String(m.side).padStart(4)}px  height used ${String(m.used).padStart(3)}%  clipped ${m.clip}  cellsOverflow ${m.cells}  namesCut ${m.trunc}  vp ${m.vp}${m.tight ? '  (scrolls: too small for this night)' : ''}`)
  if (shotDir) { const s = await cmd('WebDriver:TakeScreenshot', {}); fs.writeFileSync(`${shotDir}/${label}-${name.replace(/\W+/g, '_')}.png`, Buffer.from(s.value, 'base64')) }
}
await cmd('WebDriver:DeleteSession'); sock.end(); process.exit(fails ? 1 : 0)
