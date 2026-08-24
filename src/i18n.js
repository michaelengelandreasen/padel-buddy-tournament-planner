/**
 * English and Portuguese, for a club in Matosinhos whose group chat runs in both.
 *
 * One language at a time, stored on the club row: a padel club is not a
 * multi-tenant SaaS, and a per-visitor cookie would let the console disagree
 * with the message the same button sends to the group. The header toggle writes
 * the setting, so the console and WhatsApp always speak the same language.
 *
 * Keys are flat and named after what they say, not where they sit, so the same
 * string is reused rather than re-translated. `{name}`-style placeholders are
 * filled by {@link translator}; a missing key falls back to English and then to
 * the key itself, which shows up loudly in the page instead of rendering blank.
 */

export const LANGUAGES = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'pt', label: 'Português', short: 'PT' },
]

export const isLanguage = (code) => LANGUAGES.some((l) => l.code === code)
export const DEFAULT_LANGUAGE = 'en'

const EN = {
  appName: 'Padel Tournament Planner',

  navOverview: 'Overview',
  navTournaments: 'Tournaments',
  navSettings: 'Settings',
  navWhatsapp: 'WhatsApp',

  courts: 'Courts',
  courtsN: '{n} courts',
  manageCourts: 'Manage courts',
  noneYet: 'None yet',
  noAddress: 'No address set',
  openInMaps: 'Open in Maps',
  open: 'Open',
  live: 'live',
  draftMode: 'draft mode',
  postingToGroup: 'Posting to the group.',
  draftExplain: 'Messages are written for a human to paste.',
  tournaments: 'Tournaments',
  when: 'When',
  level: 'Level',
  status: 'Status',
  noTournaments: 'None yet — open one from WhatsApp, or below.',
  newTournament: 'New tournament',

  settings: 'Settings',
  club: 'Club',
  clubName: 'Club name',
  address: 'Address',
  mapsLink: 'Google Maps link',
  saveClub: 'Save club',
  courtsHelp: 'Named, not numbered — the WhatsApp message and the TV view both say these out loud.',
  addCourt: 'Add a court',
  add: 'Add',
  remove: 'Remove',
  noCourtsYet: 'No courts yet',
  language: 'Language',
  languageHelp: 'Sets this console and the WhatsApp messages. One club, one language.',
  save: 'Save',
  dropoutPolicy: 'Drop-out policy',
  dropoutPolicyHelp: 'Printed under every sign-up board. Kept in both languages so switching '
    + 'the club over does not silently drop it.',
  inEnglish: 'In English',
  inPortuguese: 'In Portuguese',

  category: 'Category',
  skillLevel: 'Skill level',
  date: 'Date',
  startTime: 'Start time',
  durationMin: 'Duration (min)',
  roundMin: 'Round (min)',
  create: 'Create',
  levelHintFallback: 'Level 1 is competition, {n} is first-timers.',
  botDoesTheSame: 'The same thing happens from the group with {cmd} — the bot runs the level '
    + 'and the date through the same checks this form does.',

  teams: 'Teams',
  waiting: 'Waiting',
  nobodyYet: 'Nobody yet',
  waitingOn: 'waiting on {name}',
  noPartner: 'no partner',
  mixed: 'mixed',
  mixedWarning: '{bad} of {total} pairs {verb} not mixed, and this is a mixed level: {names}.',
  isNotAre: 'is',
  areNotIs: 'are',
  whatsappMessage: 'WhatsApp message',
  outbox: 'Outbox',
  schedule: 'Schedule',
  roundN: 'Round {n}',
  noSchedule: 'No schedule yet.',
  drawSchedule: 'Draw the schedule',
  needTwoPairs: 'Two pairs is the minimum — there is nobody to play yet.',
  addCourtsFirst: 'Add courts in Settings first — the draw needs somewhere to put the matches.',
  standings: 'Standings',
  team: 'Team',
  played: 'Played',
  won: 'Won',
  points: 'Points',
  against: 'Against',
  noResults: 'No results yet',
  tvView: 'TV view',
  minRounds: '{n} min rounds',
  minutes: '{n} min',
  nowOnCourt: 'Now on court',
  notDrawn: 'Schedule not drawn yet',
  statusOpen: 'open',
  statusScheduled: 'scheduled',
  statusDone: 'done',

  tryCommand: 'Try a command',
  message: 'Message',
  fromOptional: 'From (optional)',
  sendToBot: 'Send to the bot',
  reply: 'Reply',
  outboxTitle: 'Outbox — paste these into the group',
  nothingWaiting: 'Nothing waiting.',
  draftNote: 'Draft mode: the bot does the parsing, the state and the formatting, and leaves '
    + 'the last hop to a human. WhatsApp has no official group API — posting into a group means '
    + 'pairing a number as a linked device, which is against their terms and gets numbers banned. '
    + 'Nobody has authorised that, so nothing is connected.',
  botStayedQuiet: '(the bot stayed quiet — not a command it knows)',

  // The sign-up board itself.
  boardFormat: 'Nonstop',
  courtsWord: 'Courts',
  whosIn: "Who's in?",
  signupHint: 'Sign up: {cmd}',
  dropoutHint: "Can't make it? {cmd}",
  important: 'IMPORTANT',
  reserves: 'Reserves',
  dateTBC: 'Date TBC',
  spotsLeft: '{n} spots left',
  boardFull: 'Full — {n} on the reserve list',
  boardFullClean: 'Full.',
  dropoutDefault: 'Once the nonstop is closed, dropping out still means paying your entry, '
    + 'unless you name someone to take your place in good time.',

  // Bot replies.
  onlyHostOpens: '🔒 Only the host can open a tournament.',
  noTournamentOpen: '🎾 No tournament is open yet. The host starts one with:\n{cmd}',
  noTournamentOpenShort: '🎾 No tournament is open yet.',
  needAName: '🤔 I need a name — try {cmd}.',
  whoIsDropping: '🤔 Who is dropping out? Try {cmd}.',
  notOnTheList: "🤷 I don't have {name} on the list.",
  isOut: '👋 {name} is out.',
  helpHost: 'Host',
  helpPlayers: 'Players',
  helpSignUpAsPair: 'sign up as a pair',
  helpCancel: 'cancel',
  helpWhoIsIn: 'who is in',
  helpWhatLevel: 'what MX-4 means',
  helpDates: 'Dates: {examples} all work.',

  // Levels.
  catMixed: 'Mixed',
  catMens: "Men's",
  catWomens: "Women's",
  catMixedHint: 'One of each on every pair',
  grade1: 'Competition',
  grade2: 'Advanced +',
  grade3: 'Advanced',
  grade4: 'Upper intermediate',
  grade5: 'Intermediate',
  grade6: 'Improver',
  grade7: 'Beginner',
  blurb1: 'Federated, plays ranked tournaments',
  blurb2: 'Regional competition, on court weekly',
  blurb3: 'Works the walls, builds the point',
  blurb4: 'Dependable serve, volley and lob',
  blurb5: 'Rallies hold up, still learning the glass',
  blurb6: 'A season or two in',
  blurb7: 'First racket nights',
  levelsTitle: 'Levels',
  levelsPutTogether: 'Put them together: {examples}.',
  levelWhich: 'Which level? Pick one like `MX-4` — mixed, upper intermediate.',
  levelUnknown: 'I don\'t know the level "{raw}". Levels look like {examples}.',
  levelNoCategory: '"{raw}" is missing the category — M for men\'s, F for women\'s, MX for mixed. Try MX-{n}.',
  levelNoGrade: '"{raw}" is missing the grade — 1 (competition) to {max} (beginner). Try {cat}-4.',
  levelBadGrade: "Grade {n} doesn't exist — they run 1 (competition) to {max} (beginner).",
  levelMixedNote: '🔀 Mixed level — one of each per pair.',

  // Dates.
  dateNotReal: "{raw} isn't a real date.",
  dateUnreadable: 'I couldn\'t read "{raw}" as a date. Try 2026-09-05, 5 Sep, or Friday.',
  timeNotReal: "{raw} isn't a time — use 19:00.",
  datePast: '{when} has already been played — pick a date from today on.',
  dateTooFar: '{when} is more than two years out — is that the year you meant?',
  datePick: 'Pick the date the tournament is played.',
}

const PT = {
  appName: 'Organizador de Torneios de Padel',

  navOverview: 'Resumo',
  navTournaments: 'Torneios',
  navSettings: 'Definições',
  navWhatsapp: 'WhatsApp',

  courts: 'Campos',
  courtsN: '{n} campos',
  manageCourts: 'Gerir campos',
  noneYet: 'Ainda nenhum',
  noAddress: 'Sem morada definida',
  openInMaps: 'Abrir no Maps',
  open: 'Abrir',
  live: 'ligado',
  draftMode: 'modo rascunho',
  postingToGroup: 'A publicar no grupo.',
  draftExplain: 'As mensagens são escritas para alguém colar.',
  tournaments: 'Torneios',
  when: 'Quando',
  level: 'Nível',
  status: 'Estado',
  noTournaments: 'Ainda nenhum — abre um pelo WhatsApp, ou aqui em baixo.',
  newTournament: 'Novo torneio',

  settings: 'Definições',
  club: 'Clube',
  clubName: 'Nome do clube',
  address: 'Morada',
  mapsLink: 'Link do Google Maps',
  saveClub: 'Guardar clube',
  courtsHelp: 'Com nome, não com número — a mensagem do WhatsApp e o ecrã da TV dizem-nos em voz alta.',
  addCourt: 'Adicionar campo',
  add: 'Adicionar',
  remove: 'Remover',
  noCourtsYet: 'Ainda sem campos',
  language: 'Idioma',
  languageHelp: 'Define esta consola e as mensagens de WhatsApp. Um clube, um idioma.',
  save: 'Guardar',
  dropoutPolicy: 'Política de desistência',
  dropoutPolicyHelp: 'Impressa no fim de cada mensagem de inscrições. Guardada nos dois idiomas, '
    + 'para que mudar o clube de idioma não a apague em silêncio.',
  inEnglish: 'Em inglês',
  inPortuguese: 'Em português',

  category: 'Categoria',
  skillLevel: 'Nível de jogo',
  date: 'Data',
  startTime: 'Hora de início',
  durationMin: 'Duração (min)',
  roundMin: 'Ronda (min)',
  create: 'Criar',
  levelHintFallback: 'O nível 1 é competição, o {n} é para quem começa.',
  botDoesTheSame: 'O mesmo acontece a partir do grupo com {cmd} — o bot passa o nível e a data '
    + 'pelas mesmas verificações deste formulário.',

  teams: 'Duplas',
  waiting: 'À espera',
  nobodyYet: 'Ainda ninguém',
  waitingOn: 'à espera de {name}',
  noPartner: 'sem parceiro',
  mixed: 'misto',
  mixedWarning: '{bad} de {total} duplas não {verb} mistas, e este é um nível misto: {names}.',
  isNotAre: 'é',
  areNotIs: 'são',
  whatsappMessage: 'Mensagem de WhatsApp',
  outbox: 'Caixa de saída',
  schedule: 'Calendário',
  roundN: 'Ronda {n}',
  noSchedule: 'Ainda sem calendário.',
  drawSchedule: 'Sortear o calendário',
  needTwoPairs: 'Duas duplas é o mínimo — ainda não há com quem jogar.',
  addCourtsFirst: 'Adiciona campos nas Definições primeiro — o sorteio precisa de onde pôr os jogos.',
  standings: 'Classificação',
  team: 'Dupla',
  played: 'Jogos',
  won: 'Ganhos',
  points: 'Pontos',
  against: 'Sofridos',
  noResults: 'Ainda sem resultados',
  tvView: 'Ecrã da TV',
  minRounds: 'rondas de {n} min',
  minutes: '{n} min',
  nowOnCourt: 'Agora em campo',
  notDrawn: 'Calendário ainda não sorteado',
  statusOpen: 'aberto',
  statusScheduled: 'sorteado',
  statusDone: 'terminado',

  tryCommand: 'Experimenta um comando',
  message: 'Mensagem',
  fromOptional: 'De (opcional)',
  sendToBot: 'Enviar ao bot',
  reply: 'Resposta',
  outboxTitle: 'Caixa de saída — cola estas no grupo',
  nothingWaiting: 'Nada à espera.',
  draftNote: 'Modo rascunho: o bot faz a leitura dos comandos, guarda o estado e formata as '
    + 'mensagens, e deixa o último passo a uma pessoa. O WhatsApp não tem API oficial para grupos '
    + '— publicar num grupo obriga a ligar um número como dispositivo associado, o que viola os '
    + 'termos e leva a números banidos. Ninguém autorizou isso, por isso não há nada ligado.',
  botStayedQuiet: '(o bot ficou calado — não é um comando que conheça)',

  boardFormat: 'Nonstop',
  courtsWord: 'Campos',
  whosIn: 'Quem alinha?',
  signupHint: 'Inscrição: {cmd}',
  dropoutHint: 'Não podes ir? {cmd}',
  important: 'IMPORTANTE',
  reserves: 'Suplentes',
  dateTBC: 'Data a confirmar',
  spotsLeft: 'faltam {n} lugares',
  boardFull: 'Cheio — {n} na lista de suplentes',
  boardFullClean: 'Cheio.',
  dropoutDefault: 'Depois de o nonstop estar fechado, desistir implica na mesma o pagamento da '
    + 'inscrição, a não ser que indiques alguém para o teu lugar em tempo útil.',

  onlyHostOpens: '🔒 Só o anfitrião pode abrir um torneio.',
  noTournamentOpen: '🎾 Ainda não há torneio aberto. O anfitrião abre um com:\n{cmd}',
  noTournamentOpenShort: '🎾 Ainda não há torneio aberto.',
  needAName: '🤔 Falta o nome — experimenta {cmd}.',
  whoIsDropping: '🤔 Quem é que desiste? Experimenta {cmd}.',
  notOnTheList: '🤷 Não tenho {name} na lista.',
  isOut: '👋 {name} está fora.',
  helpHost: 'Anfitrião',
  helpPlayers: 'Jogadores',
  helpSignUpAsPair: 'inscrever uma dupla',
  helpCancel: 'cancelar',
  helpWhoIsIn: 'quem está dentro',
  helpWhatLevel: 'o que quer dizer MX-4',
  helpDates: 'Datas: {examples} — todas funcionam.',

  catMixed: 'Misto',
  catMens: 'Masculino',
  catWomens: 'Feminino',
  catMixedHint: 'Um de cada em cada dupla',
  grade1: 'Competição',
  grade2: 'Avançado +',
  grade3: 'Avançado',
  grade4: 'Intermédio alto',
  grade5: 'Intermédio',
  grade6: 'Em evolução',
  grade7: 'Iniciado',
  blurb1: 'Federado, joga torneios com ranking',
  blurb2: 'Competição regional, joga todas as semanas',
  blurb3: 'Trabalha as paredes, constrói o ponto',
  blurb4: 'Serviço, volei e globo de confiança',
  blurb5: 'Aguenta a troca de bolas, ainda a aprender o vidro',
  blurb6: 'Uma época ou duas de padel',
  blurb7: 'Primeiras noites de raquete',
  levelsTitle: 'Níveis',
  levelsPutTogether: 'Junta-os: {examples}.',
  levelWhich: 'Que nível? Escolhe um como `MX-4` — misto, intermédio alto.',
  levelUnknown: 'Não conheço o nível "{raw}". Os níveis são do género {examples}.',
  levelNoCategory: 'Falta a categoria em "{raw}" — M masculino, F feminino, MX misto. Experimenta MX-{n}.',
  levelNoGrade: 'Falta o grau em "{raw}" — de 1 (competição) a {max} (iniciado). Experimenta {cat}-4.',
  levelBadGrade: 'O grau {n} não existe — vão de 1 (competição) a {max} (iniciado).',
  levelMixedNote: '🔀 Nível misto — um de cada por dupla.',

  dateNotReal: '{raw} não é uma data real.',
  dateUnreadable: 'Não consegui ler "{raw}" como data. Experimenta 2026-09-05, 5 set, ou sexta.',
  timeNotReal: '{raw} não é uma hora — usa 19:00.',
  datePast: '{when} — essa data já passou. Escolhe uma de hoje em diante.',
  dateTooFar: '{when} — isso é daqui a mais de dois anos. O ano é mesmo esse?',
  datePick: 'Escolhe a data em que o torneio se joga.',
}

const STRINGS = { en: EN, pt: PT }

/** Missing keys are loud on purpose: an English string, or the key, never blank. */
export function translator(lang = DEFAULT_LANGUAGE) {
  const code = isLanguage(lang) ? lang : DEFAULT_LANGUAGE
  const t = (key, vars) => {
    const raw = STRINGS[code][key] ?? EN[key] ?? key
    return vars ? raw.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : raw
  }
  t.lang = code
  return t
}
