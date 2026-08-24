# Padel Tournament Planner

A WhatsApp-driven tournament organiser for a padel club. Non-stop smash only, for now.

Live: https://padel-tournament-planner.mike.users.ctx7.dev

Seeded with **Padel Tribe**, R. Gonçalves Zarco 1813, Matosinhos (Porto) —
[map](https://maps.app.goo.gl/PC4yvKz3BES4Xuh66): four courts, a Saturday
mixed level 4 with three pairs in and one player still looking, and a men's
level 3 with sign-ups open. Court names are placeholders; rename them in
Settings.

## The three pieces

- **Server** (this repo) — SQLite, the bot's command engine, the club's web console,
  and a full-screen TV view. Node 24, zero npm dependencies: `node:sqlite` and
  `node:http` are enough, so there is nothing to install and nothing to audit.
- **Web console** — club settings, courts, tournaments, results, standings, in
  English or Portuguese. Built phone-first: nothing makes the page scroll
  sideways, wide tables collapse into labelled rows under 560px, and every tap
  target clears 44px.
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
  default transport is `draft`: the bot parses, stores and formats exactly as the
  live one would, and hands the finished message to a human to paste. To go live,
  add `src/whatsapp/linked-device.js` with the same two methods and set
  `WHATSAPP_TRANSPORT=linked-device`.
- **Google Sheets.** Not wired. The TV view does the job Sheets was wanted for —
  a big screen showing the plan and the results, refreshing itself, with no Google
  account, no OAuth and no token to expire. Sheets export can be added against the
  same `/api/tournaments/:id` payload.

## The sign-up board

The message the bot posts is the club's own WhatsApp format, generated rather
than retyped:

```
📆 Saturday                📆 Sábado
29/08/2026                 29/08/2026
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

Angle brackets from the spec are accepted and ignored, so `level <MX-4>` works too.
Partners can be written `partner X`, `with X`, `+ X` or `& X`.

## REST

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/whatsapp/incoming` | `{text, from, chat}` → `{reply}`. The seam a live bridge posts to. |
| GET | `/api/club` | Club settings and courts. |
| GET | `/api/languages` | The club's language and the ones available. |
| GET | `/api/tournaments` | All tournaments. |
| GET | `/api/tournaments/:id` | Teams, waiting list, schedule, standings, and the formatted message. |
| GET | `/api/outbox` | Messages still waiting to be pasted. |
| GET | `/healthz` | Liveness. |

## Running

```
docker compose up -d --build
docker compose exec app node scripts/seed.js --reset   # Padel Tribe sample data
```

Data lives in `data/planner.db` (gitignored, bind-mounted, survives recreation).
`TZ=Europe/Lisbon` in compose, because "has this date already been played" is a
question about an evening in Matosinhos, not about UTC.

## Tests

The parsers are the only place where a human's typing becomes a stored value, so
they are the only place with tests.

```
TZ=Europe/Lisbon node --test
```
