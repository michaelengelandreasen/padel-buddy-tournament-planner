# Padel Tournament Planner

A WhatsApp-driven tournament organiser for a padel club. Non-stop smash only, for now.

Live: https://padel-tournament-planner.mike.users.ctx7.dev

Seeded with **Padel Tribe**, R. Gonçalves Zarco 1813, Matosinhos (Porto) —
[map](https://maps.app.goo.gl/PC4yvKz3BES4Xuh66). Court names are placeholders;
rename them in Settings.

## The three pieces

- **Server** (this repo) — SQLite, the bot's command engine, the club's web console,
  and a full-screen TV view. Node 24, zero npm dependencies: `node:sqlite` and
  `node:http` are enough, so there is nothing to install and nothing to audit.
- **Web console** — club settings, courts, tournaments, results, standings. Built
  phone-first: nothing makes the page scroll sideways, wide tables collapse into
  labelled rows under 560px, and every tap target clears 44px.
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
!tournament non-stop level MX-4 date 2026-09-05 19:00 courts 3 duration 90
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
