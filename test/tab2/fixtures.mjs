// Three nights for the tablet test, written into a throwaway copy of the
// database — never the club's. Prints {"6":id,"12":id,"16":id}.
// `node --test` runs every file under test/, and inside the app container
// DB_PATH is the club's real database — so under the runner this skips, and
// anywhere else a DB_PATH that is not a sandbox is refused, loudly.
if (process.env.NODE_TEST_CONTEXT || !process.env.DB_PATH) { console.log('skipped — run test/tab2/run.sh'); process.exit(0) }
if (!/sandbox/.test(process.env.DB_PATH)) { console.error('refusing: DB_PATH is not a sandbox'); process.exit(1) }
const { createTournament, addSignup } = await import('/app/src/db.js')
const F = ['Ana Rita', 'Beatriz', 'Catarina Sousa', 'Daniela', 'Inês Figueiredo', 'Joana', 'Leonor', 'Mariana Braga',
  'Marta', 'Patrícia Almeida', 'Rita', 'Sofia', 'Teresa', 'Vera Lúcia', 'Clara', 'Helena']
const M = ['André', 'Alberto Teles', 'Carlos', 'Diogo', 'Ernesto Valente', 'Filipe', 'Gonçalo', 'Hugo',
  'João Pedro', 'Luís', 'Ilídio Freire', 'Nuno', 'Pedro', 'Lauro Simões', 'Tiago', 'Vasco']
// The club's own size: six pairs on three courts, long real names included.
const SIX = [['Laura Quintas', 'Hélio Varela'], ['Daniela Seabra', 'Jaime Costa'], ['Lúcia Abreu', 'Rodrigo Barreira'],
  ['Rita Sousa', 'João Almeida'], ['Inês Costa', 'Ilídio Freire'], ['Beatriz Lima', 'Tiago Nunes']]
const ids = {}
for (const [pairs, courts, dur] of [[6, 3, 60], [12, 6, 120], [16, 8, 150]]) {
  const t = createTournament({ level: 'MX-4', play_date: '2026-09-27', play_time: '19:00', courts, duration_min: dur, round_min: 12 })
  for (let i = 0; i < pairs; i++) {
    const [f, m] = pairs === 6 ? SIX[i] : [F[i], M[i]]
    addSignup(t.id, { name: f, gender: 'F', partner: m }); addSignup(t.id, { name: m, gender: 'M', partner: f })
  }
  ids[pairs] = t.id
}
console.log(JSON.stringify(ids))
