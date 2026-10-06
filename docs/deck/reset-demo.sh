#!/bin/sh
# Fresh demo copy of the app: new database, re-seeded, same code as live.
set -e
cd /home/mike/projects/padel-tournament-planner
docker rm -f padel-demo >/dev/null 2>&1 || true
rm -f /home/mike/projects/padel-tournament-planner/docs/deck/demo-data/demo.db /home/mike/projects/padel-tournament-planner/docs/deck/demo-data/demo.db-wal /home/mike/projects/padel-tournament-planner/docs/deck/demo-data/demo.db-shm
docker run -d --name padel-demo --network web --user 1000:1000 -e TZ=Europe/Lisbon -e DB_PATH=/data/demo.db -e BASIC_AUTH= -e PORT=8080 \
  -v /home/mike/projects/padel-tournament-planner/src:/app/src -v /home/mike/projects/padel-tournament-planner/docs:/app/docs \
  -v /home/mike/projects/padel-tournament-planner/docs/deck/demo-data:/data \
  padel-tournament-planner-app sh -c 'node docs/deck/demo-seed.js && exec node src/server.js' >/dev/null
sleep 4; docker logs padel-demo 2>&1 | tail -2
