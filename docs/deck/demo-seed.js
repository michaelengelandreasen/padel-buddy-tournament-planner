/**
 * Demo data for the organizer deck and the public demo: a fictional club and
 * fictional players, built into DB_PATH from nothing.
 *
 *   DB_PATH=/data/demo.db node docs/deck/demo-seed.js
 */
import { seedDemo } from '../../src/demo-seed.js'

const r = seedDemo()
console.log(`demo: tonight #${r.tonight} ${r.startTime}, ${r.pairs} pairs, ${r.matches} matches`)
