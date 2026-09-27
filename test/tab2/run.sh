#!/bin/sh
# The clubhouse tablet on a Samsung Galaxy Tab 2, in the browsers it can run.
#
# A Tab 2 stops at Android 4.2: the newest Chrome for it is 71, the newest
# Firefox 68 ESR. This runs both — the real builds, headless, at 1:1 pixel
# density — against the tablet page at every Tab 2 viewport (7″ 1024×600 and
# 10.1″ 1280×800, landscape and portrait, browser toolbar showing and full
# screen) with a 6-, 12- and 16-pair night, and fails if anything is clipped,
# cut off or overflowing.
#
# It never touches the club's data: the nights live in a copy of the database
# served by a second instance on :8099 inside the app container, removed after.
#
#   test/tab2/run.sh            # from the project root, on the stack's operator
#
# First run downloads ~180 MB of browsers into .cache/tab2 (not committed).
set -eu
cd "$(dirname "$0")/../.."
HERE=test/tab2; CACHE=.cache/tab2; MOUNT="${PROJECTS_DIR:?}/padel-tournament-planner/$CACHE"
BASE=http://padel-tournament-planner-app-1:8099
mkdir -p "$CACHE/shots"

if [ ! -x "$CACHE/chrome-linux/chrome" ]; then
  echo "fetching Chromium 71 (r599034, the M71 branch point)"
  curl -sL -o "$CACHE/chrome71.zip" "https://www.googleapis.com/download/storage/v1/b/chromium-browser-snapshots/o/Linux_x64%2F599034%2Fchrome-linux.zip?alt=media"
  python3 -c "import zipfile,sys;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" "$CACHE/chrome71.zip" "$CACHE"
  chmod +x "$CACHE/chrome-linux/chrome"
fi
[ -f "$CACHE/firefox68.tar.bz2" ] || { echo "fetching Firefox 68.12.0esr"
  curl -sL -o "$CACHE/firefox68.tar.bz2" https://archive.mozilla.org/pub/firefox/releases/68.12.0esr/linux-x86_64/en-US/firefox-68.12.0esr.tar.bz2; }
docker build -q -t tab2-browsers "$HERE" >/dev/null
[ -d "$CACHE/firefox" ] || docker run --rm --user 1000:1000 -v "$MOUNT:/w" -w /w tab2-browsers tar xjf firefox68.tar.bz2

cleanup() {
  docker rm -f tab2-c71 tab2-ff68 >/dev/null 2>&1 || true
  # Only the sandbox: it alone carries --tab2-sandbox. The app's own server is
  # PID 1. The [-] keeps the pattern from matching this very shell's command
  # line, which pkill would otherwise kill before the rm below ever ran.
  docker compose exec -T app sh -c 'pkill -f "[-]-tab2-sandbox"; rm -f /tmp/tab2-sandbox.db* /tmp/tab2-fixtures.mjs' >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "sandbox: a copy of the database with three test nights"
docker compose exec -T app sh -c 'rm -f /tmp/tab2-sandbox.db*; cp /app/data/planner.db /tmp/tab2-sandbox.db'
docker compose cp "$HERE/fixtures.mjs" app:/tmp/tab2-fixtures.mjs >/dev/null 2>&1
IDS=$(docker compose exec -T -e DB_PATH=/tmp/tab2-sandbox.db app node /tmp/tab2-fixtures.mjs)
docker compose exec -d -T -e PORT=8099 -e DB_PATH=/tmp/tab2-sandbox.db -e BASIC_AUTH= -e TELEGRAM_BOT_TOKEN= \
  -e MESSAGING_CHANNELS=draft app node src/server.js --tab2-sandbox
sleep 3
# Draw every night and play its first rounds, so there is a now, a next and a table.
docker compose exec -T app node --input-type=module -e "
const B='http://127.0.0.1:8099', ids=$IDS, form={'content-type':'application/x-www-form-urlencoded'};
for (const id of Object.values(ids)) {
  await fetch(B+'/t/'+id+'/schedule',{method:'POST',body:'',redirect:'manual',headers:form});
  const d=await (await fetch(B+'/api/tournaments/'+id)).json();
  const body=d.matches.filter(m=>m.round<=(d.teams.length>6?3:2)).map((m,i)=>'a'+m.id+'='+(i%2?11:6+i%5)+'&b'+m.id+'='+(i%2?4+i%6:11)).join('&');
  await fetch(B+'/t/'+id+'/scores',{method:'POST',body,redirect:'manual',headers:form});
}"
node -e "const ids=$IDS,c=JSON.parse(require('fs').readFileSync('$HERE/cases.json','utf8'));
  require('fs').writeFileSync('$CACHE/cases.json',JSON.stringify(c.map(([p,...r])=>['/t/'+ids[p.slice(1,-1)]+'/tv',...r])))"

docker run -d --name tab2-c71 --network web --user 1000:1000 -e HOME=/tmp -v "$MOUNT:/w" tab2-browsers \
  /w/chrome-linux/chrome --headless --no-sandbox --disable-gpu --hide-scrollbars \
  --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0 about:blank >/dev/null
docker run -d --name tab2-ff68 --network web --user 1000:1000 -e HOME=/tmp -e MOZ_HEADLESS=1 -v "$MOUNT:/w" tab2-browsers \
  sh -c 'mkdir -p /tmp/p && echo "user_pref(\"layout.css.devPixelsPerPx\", \"1.0\");" > /tmp/p/user.js &&
    (socat TCP-LISTEN:2829,fork,reuseaddr TCP:127.0.0.1:2828 &) &&
    exec /w/firefox/firefox --headless --marionette -no-remote -profile /tmp/p about:blank' >/dev/null
ip() { docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$1"; }
C=$(ip tab2-c71); F=$(ip tab2-ff68)
for i in $(seq 1 30); do curl -s "http://$C:9222/json/version" >/dev/null 2>&1 && break; sleep 1; done
for i in $(seq 1 30); do timeout 2 sh -c "exec 3<>/dev/tcp/$F/2829 && head -c 40 <&3" 2>/dev/null | grep -q applicationType && break; sleep 1; done 2>/dev/null || true

rc=0
node --experimental-websocket --no-warnings "$HERE/measure-chrome.mjs" "$C:9222" "$BASE" "$CACHE/cases.json" "$CACHE/shots" || rc=1
node "$HERE/measure-firefox.mjs" "$F:2829" "$BASE" "$CACHE/cases.json" "$CACHE/shots" || rc=1
echo "screenshots: $CACHE/shots"
[ $rc = 0 ] && echo "PASS — every Galaxy Tab 2 case fits in Chrome 71 and Firefox 68" || echo "FAIL — see above"
exit $rc
