# Padel Tournament Planner

A WhatsApp-driven tournament organiser for a padel club. Non-stop smash only, for now.

Live: https://padel-tournament-planner.mike.users.ctx7.dev

## The three pieces

- **Server** (this repo) — SQLite, the bot's command engine, the club's web console,
  and a full-screen TV view. Node 24, zero npm dependencies: `node:sqlite` and
  `node:http` are enough, so there is nothing to install and nothing to audit.
- **Web console** — club settings, courts, tournaments, results, standings.
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

## Commands

```
!tournament non-stop level MX-4 date Friday 5 Sep courts 3 duration 90
!in Mike M partner Sofia
!out Mike
!list
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
```

Data lives in `data/planner.db` (gitignored, bind-mounted, survives recreation).
