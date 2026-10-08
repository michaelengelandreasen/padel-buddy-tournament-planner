#!/bin/sh
# The public demo: invented players, a night on court "now", reset every day.
#
# Visitors can change anything, and the demo's "tonight" is only tonight on
# the day it was seeded. So the database is thrown away and seeded again at
# start and every night at 05:00 (club time); the server restarts with it.
set -u
# Sandbox mode has no shared database to reset: every visitor has their own,
# and each is deleted a week after it was started (see src/sandbox.js).
case "${SANDBOX:-}" in on|1|true|yes) exec node src/server.js ;; esac
DB="${DB_PATH:-/app/data/demo.db}"
while true; do
  rm -f "$DB" "$DB-wal" "$DB-shm"
  node docs/deck/demo-seed.js || exit 1
  node src/server.js &
  pid=$!
  # Seconds until the next 05:00, local time.
  now=$(date +%s)
  next=$(date -d "$(date +%Y-%m-%d) 05:00" +%s 2>/dev/null || echo $((now + 86400)))
  [ "$next" -le "$now" ] && next=$((next + 86400))
  sleep $((next - now)) &
  wait $!
  kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null
done
