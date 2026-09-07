# Padel Tournament Planner

A group-chat-driven tournament organiser for a padel club — WhatsApp and Telegram.
Non-stop smash only, for now.

The point of it: the club runs its nights off a printed sheet, a PDF and a
WhatsApp group, and between rounds twenty people walk to a wall to find their
own name. Here the group gets one message per round saying who is on which
court and where every pair goes next, posted the moment the previous round's
last score is typed in — and anyone can ask `!where Mike` and get their own
answer. The TV view shows the same board on the clubhouse screen.

Live (VPN): https://padel-tournament-planner.mikehome.users.ctx7.dev
Public: https://wp-bullet.asuscomm.com — see "Public domain" under Running.

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
  with a slash too (`/where mike`). Both channels run at once: every message goes
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

👩🏻 Paula Quevedo           👩🏻 Paula Quevedo
👦🏼 Luís Miranda            👦🏼 Luís Miranda
👩🏻 Adriana Osório          👩🏻 Adriana Osório
👦🏼 Manuel Lima             👦🏼 Manuel Lima
👩🏻                        👩🏻
👦🏼 Mike                    👦🏼 Mike
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

## Language

English or Portuguese, chosen with the `EN`/`PT` toggle in the header or in
Settings. It is one setting on the club row, not a per-visitor cookie: it drives
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
!in Mike M partner Sofia
!out Mike
!list
!levels
!help
```

On the night (they read the tournament being *played*, which is not the newest
one open — a club announces Friday while Saturday is still on court):

```
!where Mike      where you play now, and where you go next   (!onde)
!round           the round being played, court by court      (!ronda)
!next            where every pair goes for the next round    (!seguir)
!table           the standings                               (!tabela)
```

A round message, generated from the stored matches:

```
🎾 *Round 2 of 5* · Nonstop MX4
⏱ 11:12AM → 11:24AM

*Court 1*
Paula Quevedo & Luís Miranda
🆚 Sofia Marques & Tiago Ferreira

*Court 2*
Adriana Osório & Manuel Lima
🆚 Maria Aries & Filipe Herculano

☕ Sitting out: Rita Bessa & André Pinto

*⏭ Next round · 11:24AM*
Court 1 — Paula Quevedo & Luís Miranda
Court 1 — Rita Bessa & André Pinto
Court 2 — Maria Aries & Filipe Herculano
Court 2 — Sofia Marques & Tiago Ferreira
☕ Adriana Osório & Manuel Lima
```

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

Data lives in `data/planner.db` (gitignored, bind-mounted, survives recreation).

### Public domain

The ctx7 stack keeps projects VPN-only: Traefik serves the `*.mikehome.users.ctx7.dev`
wildcard with a cert the ctx7 backend issues, and this is a home box behind NAT,
so the stack's own `ctx7 expose` (Cloudflare orange-cloud to a routable origin)
cannot make it public. The `public` service in compose is the way round that: a
Caddy sidecar with its own Let's Encrypt certificate for `wp-bullet.asuscomm.com`
(the router's DDNS name), proxying to the app over the compose network, listening
on host **:9443** because Traefik owns :443. Core stack untouched.

On the ASUS router, once:

1. Turn off *Web Access from WAN* (or move it off 443/80) — otherwise the
   router answers the public port itself, which is what Let's Encrypt saw first.
2. Port forward **WAN TCP 443 → 192.168.40.230:9443**.

Caddy retries issuance on its own; `docker compose restart public` forces it.
Certificates persist in `data/caddy`. To go dark again: remove the `public`
service (or `docker compose rm -sf public`) and the port forward.

The dashboard at mikehome.users.ctx7.dev lists containers labelled
`aidevserver.project=true`; compose declares it, because a `docker compose up`
on the host (unlike the broker) does not stamp it and the project vanishes.
`TZ=Europe/Lisbon` in compose, because "has this date already been played" is a
question about an evening in Matosinhos, not about UTC.

## Tests

The parsers are the only place where a human's typing becomes a stored value, so
they are the only place with tests.

```
TZ=Europe/Lisbon node --test
```
