# Padel Tournament Planner

A group-chat-driven tournament organiser for a padel club — WhatsApp and Telegram.
Non-stop smash only, for now.

The point of it: the club runs its nights off a printed sheet, a PDF and a
WhatsApp group, and between rounds twenty people walk to a wall to find their
own name. Here the group gets one message per round saying who is on which
court and where every pair goes next, posted the moment the previous round's
last score is typed in — and anyone can ask `!where Nico` and get their own
answer. The TV view shows the same board on the clubhouse screen.

Live (VPN): https://padel-tournament-planner.mikehome.users.ctx7.dev
Public: https://padeladmin.webperfology.com — a Cloudflare Tunnel behind a shared login,
see "Public domain" under Running.

Seeded with **Padel Tribe**, R. Gonçalves Zarco 1813, Matosinhos (Porto) —
[map](https://maps.app.goo.gl/PC4yvKz3BES4Xuh66): four courts, a Saturday
mixed level 4 with five pairs in and one player still looking (round 1 played),
and a men's level 3 with sign-ups open. Court names are placeholders; rename them in
Settings.

## The three pieces

- **Server** (this repo) — SQLite, the bot's command engine, the club's web console,
  and a full-screen TV view. Node 24, zero npm dependencies: `node:sqlite` and
  `node:http` are enough, so there is nothing to install and nothing to audit.
- **Web console** — club settings, courts, tournaments, results, standings, in
  English or Portuguese. Built phone-first: nothing makes the page scroll
  sideways, wide tables collapse into labelled rows under 560px, every tap target
  clears 44px, and a match is entered as two lines — each team with its own score
  box on it — so recording 11-5 from the side of a court needs no working out.
- **Android app** — not built yet. It is an admin client over the REST API below,
  not a second source of truth.

## Decisions taken without an answer

These were asked and went unanswered, so they are assumptions. Each is written to be
cheap to reverse.

- **Format.** `!in` names a partner, so pairs are fixed for the night: every court
  plays a timed round at once, pairs rotate opponents, ranking is total points
  scored. Lives in `src/formats/nonstop.js` behind `schedule()` / `standings()`; an
  Americano or a king-of-the-court ladder is a sibling file and a different
  `format` value, nothing else changes.
- **WhatsApp.** WhatsApp has no official group API — the Cloud API is 1:1 only, and
  posting into a group means pairing a number as a linked device, which is against
  their terms and gets numbers banned. Nobody authorised burning a number, so the
  WhatsApp channel is `draft`: the bot parses, stores and formats exactly as a
  live one would, and hands the finished message to a human to paste from the
  outbox (`/groups`).
- **Telegram.** Has a real group API, so it is the channel that actually posts.
  One env var, `TELEGRAM_BOT_TOKEN` (from @BotFather), and the bot is live: add
  it to the club's group and send `/help` there — the first command it sees is
  how it learns which group it lives in. The sign-up board is one pinned message
  it edits in place on every `!in`/`!out`; round messages are posted fresh so
  they land on phones. Only group admins can open a tournament. Commands work
  with a slash too (`/where nico`). Both channels run at once: every message goes
  to Telegram and into the WhatsApp outbox. `src/messaging/` — `transport.js` is
  the bus, `telegram.js` the live channel, `draft.js` the outbox.
- **Google Sheets.** Not wired. The TV view does the job Sheets was wanted for —
  a big screen showing the plan and the results, refreshing itself, with no Google
  account, no OAuth and no token to expire. Sheets export can be added against the
  same `/api/tournaments/:id` payload.

## The sign-up board

The message the bot posts is the club's own WhatsApp format, generated rather
than retyped:

```
📆 Saturday 29/08/2026     📆 Sábado 29/08/2026
🕒 11AM-1PM                🕒 11h-13h
📈 Nonstop MX4             📈 Nonstop MX4

📍 Padel Tribe             📍 Padel Tribe
https://maps.app.goo…      https://maps.app.goo…

3 Courts                   3 Campos

👩🏻 Laura Quintas           👩🏻 Laura Quintas
👦🏼 Hélio Varela            👦🏼 Hélio Varela
👩🏻 Daniela Seabra          👩🏻 Daniela Seabra
👦🏼 Jaime Costa             👦🏼 Jaime Costa
👩🏻                        👩🏻
👦🏼 Nico                    👦🏼 Nico
👩🏻                        👩🏻
👦🏼                        👦🏼

Who's in?                  Quem alinha?
…                          …

*IMPORTANT*                *IMPORTANTE*
Once the nonstop is …      Depois de o nonstop …
```

Every line comes from the tournament's own settings — the weekday and the date
from its date, the time range from its start plus its duration, the level and
the court count from its settings, and the slot list from `courts × 4`. Moving a
night from three courts to four adds four blank slots; it does not need a new
message written by hand.

**The blanks are the format.** A padel club posts a list of empty lines and
fills them in, because the empty lines are what make somebody reply. A mixed
level alternates woman/man down the list, so a pair occupies two adjacent slots
and the shape of the board itself enforces "one of each"; a men's or women's
level uses one marker all the way down. Complete pairs are seated first, in
sign-up order; a player still waiting on a partner drops into the first free
slot their gender fits — they are in the tournament, just not yet in a pair, and
hiding them is how a club double-books a court. Anyone past `courts × 4` comes
back under **Reserves** rather than being dropped.

The **IMPORTANT** block is the club's drop-out policy, edited in Settings and
stored in both languages so switching the club over doesn't silently lose the
club's own wording.

## Importing the club's own message

The club already posts each night in a fixed shape, and the host was retyping
it. **Tournaments → Import a WhatsApp message**: paste it, press *Read the
message*, and the new-tournament form fills itself in — date (`13/09/26`),
start and duration from the time window (`09:30- 11:30` → 120 min), the level
if the message has one (`MX4 - Padel Tribe`), the venue otherwise (`M9 - MAIA`
is the club M9 in Maia, and the board then prints that instead of the club
name), courts (players ÷ 4), and the numbered roster with names tidied
(`zeca Ramos` → Zeca Ramos) and `(dupla)` lines paired with the line above. What it could
not read is said per field and left for the host; *Create with 16 players*
makes the tournament and signs everyone up in one go. `src/import.js`, tested
against the real message in `test/fixtures/maia.txt`.

## Deleting a tournament

At the bottom of a tournament's Board tab. It asks first, and it is the one
thing here with no undo: sign-ups, courts, schedule, scores and the pinned
board's memory go with it.

## Courts belong to the night

Which courts are booked, and what they are called, changes from night to
night. Each tournament carries its own list — seeded from Settings → Courts
(the defaults) when it is created — and edits it on its Rounds tab: rename,
add, remove. A rename follows through to that night's schedule only; a court
already in the schedule can be renamed but not removed. The draw uses the
night's list, and the sign-up board draws `courts × 4` slots from its length.
The list is one form — every name saves from *Save all*, or one row from its
own Save. Labels are what the club calls the court — `1`, `2`, `Center` — and
the word is put back only on display and in messages when the label is a bare
number ("Court 1"), so the box you rename it in holds just the number.

## Clubs

The group plays at more than one club, so clubs are a list — Settings → Clubs:
name, address, map link, each editable in place; add one, or several at once
from pasted lines (`Name | map link`, names already saved are skipped). One
club is **home**, marked there or picked at the top of the Overview, and the
Overview's header is the home club. A night that does not say otherwise is at
home: the board's 📍 line and map link, the tournament header, the TV title.
A night elsewhere names its club on the form (the saved names are offered) or
gets it from a pasted message (`M9 - MAIA` when a club called M9 is saved;
accents and case aside, longest saved name winning). In a tournament's header
the small pin opens the club on Google Maps and the name opens every night
played there (`/tournaments?venue=…`).

## Players and their levels

**Players** keeps everyone who has ever signed up — one entry per name, case
aside, filled in automatically from sign-ups and imports, or added by pasting
lines (`Rita | F | 5`). Each player has a gender and a level on the same 1–7
ladder the nights use. Change levels in the list (several at once, one note,
*Save all*) or on a player's page; every change is kept with its date and note,
so the page shows how the player's game has moved, with the nights they played.

Nights use the register: a sign-up borrows the player's gender when it did not
give one (an imported roster finally knows who is who on a mixed night), chips
on the pairs board show the level, and **Balance by level** pairs the strongest
with the weakest — on a mixed night, the best woman with the weakest man — so
every pair adds up to about the same. Unrated players count as a 4.

## Pairs

Before the draw, the Teams tab is a pairs board: numbered seats, two to a pair,
and a tray of whoever is still unpaired — what an imported roster mostly is.
Drag a player onto a seat (pointer events, so a thumb works as well as a mouse),
or tap one player and then another to swap them; Enter/Space do the same from
the keyboard. *Pair up the rest at random* deals the tray into the empty seats
(woman/man on a mixed level where genders are known); *Reshuffle everyone*
starts over. Nothing is written until *Save pairs*, which sets each player's
partner both ways (`src/pairs.js`). The board stays available after the draw:
the schedule is drawn from the pairs, so *Save and redraw* replaces it — it asks
first once scores have been entered, since they go with the old schedule.

## Language

English, Portuguese, Ukrainian or Spanish, chosen with the `EN`/`PT`/`UK`/`ES`
toggle in the header or in Settings. It is one setting on the club row, not a per-visitor cookie: it drives
the console *and* the messages the same button sends to the group, and those two
must never disagree. Unknown values fall back to English, and a missing string
renders its own key rather than a blank.

The two languages differ in more than words — Portugal reads a 24-hour clock, so
`11AM-1PM` in English is `11h-13h` in Portuguese, and the bot accepts Portuguese
weekdays and months (`sexta`, `5 set`) in either.

## Levels and dates

The two fields a night is advertised on used to be free text, which meant
`level asdf` opened a tournament nobody could self-select into and the word
"Friday" stayed Friday forever. Both now go through one parser each, used
identically by the web form and the bot.

**Level** (`src/levels.js`) — a category and a grade, written `MX-4`:

| | |
| --- | --- |
| `MX` / `M` / `F` | mixed · men's · women's |
| `1` … `7` | 1 competition, 4 upper intermediate, 7 beginner |

The console offers two pickers, so an invalid level cannot be typed; the server
re-checks anyway. The bot accepts `MX-4`, `mx4`, `mixed 4` or `4 misto` and
answers a wrong one with the whole table (`!levels`). A mixed level also flags
any pair that isn't one of each, on the tournament page, before the draw.

**Date** (`src/dates.js`) — stored as ISO `YYYY-MM-DD` plus a separate `HH:MM`,
so the console can use a real date picker (`min` = today) and the list can sort
as a calendar. The bot still takes what a host types into a group: `2026-09-05`,
`05/09/2026`, `5/9`, `5 Sep`, `5 setembro`, `Friday`, `sexta 19:00`, `tomorrow`.
A bare weekday resolves forward, a leading weekday in front of a real date is
ignored rather than trusted, and anything unreadable is an error, never a guess.
Dates in the past and dates over two years out are refused at both ends.

Old rows are dragged through the same parsers on boot (`migrate()` in
`src/db.js`), so nothing is left in a shape the pickers can't open.

## Commands

```
!tournament non-stop level MX-4 date 2026-09-05 11:00 courts 3 duration 120
!in Nico M partner Sofia
!out Nico
!list
!levels
!help
```

On the night they read the **active night**: the one pinned from its page
("Make this the active night", shown on the Overview), or — unpinned — what
the calendar says: the night on court now, else the next one up, else the most
recent, so `!table` still answers on Sunday for Saturday. A club announces
Friday while Saturday is still on court, so "newest open" was never the answer.

```
!where Nico      where you play now, and where you go next   (!onde)
!round           the round being played, court by court      (!ronda)
!next            where every pair goes for the next round    (!seguir)
!table           the standings                               (!tabela)
```

A round message, generated from the stored matches:

```
🎾 *Round 2 of 5* · Nonstop MX4
⏱ 11:12AM → 11:24AM

*Court 1*
Laura Quintas & Hélio Varela
🆚 Raquel Dantas & Fausto Correia

*Court 2*
Daniela Seabra & Jaime Costa
🆚 Lúcia Abreu & Rodrigo Barreira

☕ Sitting out: Vera Sales & Simão Brito

*⏭ Next round · 11:24AM*
Court 1 — Laura Quintas & Hélio Varela
Court 1 — Vera Sales & Simão Brito
Court 2 — Lúcia Abreu & Rodrigo Barreira
Court 2 — Raquel Dantas & Fausto Correia
☕ Daniela Seabra & Jaime Costa
```

On nights of up to four courts the Rounds tab also offers **All rounds** — every
round in one message, court by court, the printed sheet as a message — with
Copy and Post; the bot answers `!schedule` with the same. Every message waiting
in the outbox (Groups) has its own Copy button.

The next-round block is one line per pair rather than the fixtures, because a
player reading it is not asking who they play — they are asking where to stand.
Round 1 is posted when the schedule is drawn; every later round is posted when
the last score of the round before it is saved, and the final standings after
the last one. Any round or the board can also be posted by hand from the
tournament page, which then says what each channel did with it.

Angle brackets from the spec are accepted and ignored, so `level <MX-4>` works too.
Partners can be written `partner X`, `with X`, `+ X` or `& X`.

## REST

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/messages/incoming` | `{text, from, chat}` → `{reply}`. The seam a bridge posts to (`/api/whatsapp/incoming` still works). |
| GET | `/api/tournaments/:id/round` | The current round message; `?n=3` for a specific one. |
| GET | `/api/club` | Club settings and courts. |
| GET | `/api/languages` | The club's language and the ones available. |
| GET | `/api/tournaments` | All tournaments. |
| GET | `/api/tournaments/:id` | Teams, waiting list, schedule, standings, and the formatted message. |
| GET | `/api/outbox` | Messages still waiting to be pasted. |
| GET | `/healthz` | Liveness. |

## Running

The bind mounts are absolute, because the container broker refuses a `./` path
that resolves through a symlink. They read `PROJECTS_DIR` from a gitignored
`.env`, so a fresh clone (or a new host) needs it written first — without it
Docker mounts empty directories over `/app/src` and the app crash-loops on
`Cannot find module '/app/src/server.js'`:

```
echo PROJECTS_DIR=$(dirname "$PWD") > .env
docker compose up -d --build
docker compose exec app node scripts/seed.js --reset   # Padel Tribe sample data
```

The tournament page is four tabs — Board, Teams, Rounds, Table — and the
Rounds tab is one form: every score box on the page saves from the bar at the
bottom, or one match from its own Save. Empty boxes mean "not played", never 0–0.
Each match says which state it is in. Not played: two empty boxes and Save.
Saved: the result shown as a result — winner in full ink, the scores as
numerals, a quiet "Saved" — with **Edit** to change it. Edited or typed but not
saved: the card turns amber with "Unsaved", Save becomes primary, **Cancel**
(or Esc) puts the saved score back, and the save bar counts what is waiting.
Leaving the page with unsaved scores asks first.

Data lives in `data/planner.db` (gitignored, bind-mounted, survives recreation).

### Public domain

The ctx7 stack keeps projects VPN-only, its Traefik can only serve the ctx7
wildcard certificate, and this is a home box whose router already uses 443/80
for its own nginx — so nothing here can answer the internet directly. The
`tunnel` service is the way round that: **cloudflared dials out** to Cloudflare,
which terminates TLS at its edge and passes requests down the tunnel to
`http://app:8080` on the compose network. No port forward, no certificate, no
router change; the stack is untouched.

Once, in [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) for a zone
you manage there:

1. **Networks → Tunnels → Create a tunnel → Cloudflared**, name it (e.g.
   `padel`), and copy the token from the install step (the long `eyJ…` string).
2. **Public Hostname**: subdomain `padel`, your domain, type **HTTP**,
   URL **`app:8080`**. Save — Cloudflare creates the DNS record itself.
3. On this box, add to `.env`:

   ```
   TUNNEL_TOKEN=eyJ…
   COMPOSE_PROFILES=public
   ```

   then `docker compose up -d`. The tunnel shows *Healthy* in Zero Trust within
   seconds and the hostname serves the console.

The console has one shared login, HTTP Basic, set with `BASIC_AUTH=user:pass`
in `.env` (empty disables it). Pick your own; never commit it. Share it inside
the link and the browser remembers it:

```
https://USER:PASS@your-host/            console
https://USER:PASS@your-host/t/13/tv     the TV board
```

`/healthz` stays open. To go dark again, remove `COMPOSE_PROFILES` from `.env`
and `docker compose up -d --remove-orphans`.

The dashboard at mikehome.users.ctx7.dev lists containers labelled
`aidevserver.project=true`; compose declares it, because a `docker compose up`
on the host (unlike the broker) does not stamp it and the project vanishes.
`TZ=Europe/Lisbon` in compose, because "has this date already been played" is a
question about an evening in Matosinhos, not about UTC.

## The sandbox site

`SANDBOX=on` turns the app into a public site: a front page, and a private
sandbox for anyone who types a name. A sandbox is a club of the visitor's own —
sixteen invented players, a tournament half played, three more on the calendar —
with the visitor signed in as the club. Nobody else can see it, and a week later
(`SANDBOX_DAYS`) it is deleted.

- **One SQLite file per sandbox** (`data/sandboxes/<id>.db`). A request is
  scoped to its visitor's file (`src/scope.js`), so the data layer cannot name
  another visitor's data; deleting a sandbox is deleting a file.
- **No email, no password.** A signed cookie is the key. The strip at the top of
  every page has *Copy my link* — the same sandbox on another device — and
  *Delete now*.
- **Limits**, because it is a public form that creates files: `SANDBOX_MAX`
  sandboxes at once (300), `SANDBOX_PER_IP` new ones per address per day (5),
  `SANDBOX_MAX_MB` each (8). Addresses are kept only as a salted hash.
- **Nothing leaves it.** Messages a sandbox would post to a group are shown in
  its outbox and never sent, whatever bot token is in the environment.
- Expired sandboxes are swept at start and every hour, along with any database
  file the registry does not know.

`/healthz` reports how many are in use. `test/sandbox.test.js` covers the
isolation, the limits and the expiry.

## The clubhouse tablet

`/t/<id>/tv` is what stands by the courts all night. It answers one question —
which court do I go to next — with a grid: a row per pair, alphabetical, and a
column per round holding the court; the round being played is filled, the next
one outlined, the ones played dimmed. Beside it, who is on court now and the
leaders; once every score is in, the final table.

It never scrolls and never cuts a name off. Every panel gets the largest text
at which its content fits, found by bisection in the page itself — so it works
the same in a 2018 browser as today's. A long pair name drops surnames to an
initial ("Inês F. & Eduardo C.") rather than losing the partner. It refreshes
in place every 15 s, keeps the screen awake, and goes full screen on the first
tap.

### On a Samsung Galaxy Tab 2 (or any Android 4 tablet)

Tested in the real browsers such a tablet can run — Chrome 71 and Firefox
68 ESR — at the 7″ (1024×600) and 10.1″ (1280×800) screens, both orientations,
toolbar showing and full screen, with 6, 12 and 16 pairs: everything fits.
The club's 6-pair night reads at 25 px on the 7″ and 31 px on the 10.1″.

**Use Firefox, not Chrome, on the tablet.** Both addresses are signed through
*ISRG Root X1*, which Android only trusts from 7.1.1; the old cross-signed
root that covered Android 4 expired in 2021. Chrome on Android 4 uses the
system's certificates and shows "Your connection is not private". Firefox
carries its own, and Firefox 68 — the last for Android 4, still offered by the
Play Store to those devices — opens the public address fine (verified against
the live certificate). To make Chrome work too, switch the zone's edge
certificate authority in Cloudflare (SSL/TLS → Edge Certificates → Certificate
Authority) to Google Trust Services, whose root is cross-signed by GlobalSign's
1998 root that Android 4 does trust — untested here, so check on the tablet.

To re-check after changing the tablet page — downloads the two browsers once
(~180 MB, into `.cache/`, not committed), builds its own throwaway nights in a
copy of the database, and removes it all afterwards:

```
test/tab2/run.sh
```

## Saving without a page load

Every POST form on a page is fetched instead of navigated: the server answers
as it always did — a redirect to the page it just changed — and that page's
content replaces the current one in place, tab kept, scroll kept, URL updated.
A redirect to a *different* page (create, delete) is followed as a real
navigation. Anything unexpected falls back to a plain submit, so the server
routes stay the one source of truth and the console still works with scripting
off. The page scripts (tabs, pairs board, copy buttons) are re-run after each
swap.

## Tests

The parsers are the only place where a human's typing becomes a stored value, so
they are the only place with unit tests. `test/e2e/drive.mjs` drives the whole
console in a real headless Chrome over the DevTools protocol — every page, tab
and form at phone width, in-place saves included, console errors and failed
requests collected — creating and deleting its own tournament and clubs.

```
TZ=Europe/Lisbon node --test
```

## Branches

- `main` — what runs live. Only tested work lands here.
- `testing` — features are merged here first and tried out together.
- `feature/<name>` — one branch per feature (`feature/postgres`, `feature/americano`, …),
  branched from `testing` and merged back into it when done.

Flow: `feature/*` → `testing` → (checked) → `main`.
