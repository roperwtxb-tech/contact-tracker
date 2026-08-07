# Contacts & Referrals

A living tracker for contacts and referrals surfaced by Randy, Dewaine, or anyone else on the team —
one persistent record per person, with a dated, append-only history of the relationship.

Distinct from **MyCRM** (active client pipeline) and from the Thought Capture app (temporary dumping ground).
This is the earlier, looser stage: people who may never become formal prospects, but whose status Sean
still wants visibility into.

## What it does

- **One record per person** — name, source, status, phone/email/company, and a growing timeline.
- **Source is an open text field** — Randy and Dewaine get pinned colors; anyone else added later gets a
  stable color of their own automatically. Nothing is hardcoded to two names.
- **Status** is the one field that answers "whose court is this in":
  `They're handling it` · `Waiting to hear` · `My turn` · `Contacted` · `Client` · `Dead end`.
  Changing it writes a dated line into the timeline, so status history is never lost.
- **Append-only timeline** — each entry carries its own date (default today, back-dateable), so
  "6/12 — Randy mentioned him at lunch" stays accurate even if it's logged on 6/14.
- **Filters** — by source (tabs), by status (chips), plus a search that also looks inside timeline text.
- **Promote to MyCRM** — writes the person straight into MyCRM as a `Prospect`, carrying the source and
  the full timeline across. Falls back to a flag + one-tap copy if you'd rather paste it yourself.
- **Works in the field** — installs as a PWA, opens instantly from cache, and queues writes made offline,
  flushing them the moment signal comes back.
- **One login** — the same username and password as MyCRM unlocks the app and authorises the CRM write.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The whole app — markup, styles, and logic in one file. No build step. |
| `sw.js` | Service worker. Caches the app shell only; Supabase calls always hit the network. |
| `manifest.webmanifest` | PWA metadata (name, icons, standalone display). |
| `icon-*.png` | App icons, including a maskable variant for Android. |

## Storage

Supabase project **mycrm** (`uknwddmqebveovxxxyrd`), in its own `ct_*` table namespace:

- `ct_people` — one row per person.
- `ct_timeline` — one row per dated entry, `ON DELETE CASCADE` from `ct_people`.

Inserting a timeline entry bumps its person's `updated_at`, so the list is always ordered by real activity.

Sync is a poll every 8 seconds while the tab is visible, plus an immediate refresh on focus, on reconnect,
and after every write. Writes are optimistic: they appear instantly, go into a durable outbox, and retry
until the server accepts them. Rows carry client-generated UUIDs and are written as upserts, so a retry
can never duplicate anything.

### Access

The app is gated behind the **same login as MyCRM** — one Supabase account unlocks the tracker and
authorises the CRM write, so there's no second password to remember and no shared passcode to leak.
`ct_people` and `ct_timeline` are `authenticated`-only, so the publishable key in this repo is useless
on its own: without a signed-in session it reads and writes nothing. `crm_data` is untouched and stays
scoped to `auth.uid()`.

Sessions persist per device and refresh silently. Offline, an expired token is kept rather than forcing a
sign-out, so field edits keep queueing; the outbox replays once signal returns. Signing out clears the
local cache of contacts, and warns first if anything is still unsynced.

### Promote to MyCRM

Promotion writes into `crm_data.data.contacts` for the signed-in agent. Because the app already holds that
session, it's one tap — no extra prompt.

The contact is written with the exact field set MyCRM already uses — no new or missing keys — with
`stage: "Prospect"` and `tags: "Referral: <source>"`.

The timeline lands in the contact's `notes`, one note per dated entry, each keeping its own entry date
rather than the promotion date. MyCRM's format — `{ date: 'YYYY-MM-DD', text: '…' }` — was confirmed
against a real note in the live CRM and is the default in `DEFAULT_NOTE`.

`notesFor()` keeps a safety net around that default: if MyCRM's note format ever changes, it copies the
shape of the first real note it finds instead of writing something the CRM can't render — string entries
stay strings; object entries reuse the same keys, with the text and date slotted into whichever keys hold
them. So a format change degrades to "still correct" rather than "breaks the CRM".

The tracker record is never deleted by promoting — it stays as the full history and is marked `IN CRM`.

## Deploying

Static hosting, no build. On GitHub Pages: Settings → Pages → Source `Deploy from a branch`, branch `main`,
folder `/ (root)`. The service worker and manifest use relative paths, so it works from a project subpath.

After changing `index.html`, bump `CACHE` in `sw.js` (e.g. `ct-shell-v3` → `v4`) so installed devices pick
up the new version instead of serving the cached shell.
