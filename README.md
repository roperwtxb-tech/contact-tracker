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

`ct_people` and `ct_timeline` allow the `anon` role full access — the app has no login gate, per the build
brief. `crm_data` is untouched and stays scoped to `auth.uid()`, so the publishable key in this repo grants
access to the tracker only, never to the CRM. Anyone with the URL can read and write the tracker.

To add a passcode later, gate `render()` at the bottom of `index.html` behind a prompt — or better, reuse
the MyCRM sign-in that promotion already uses, which gives real per-user auth rather than a shared word.

### Promote to MyCRM

Promotion writes into `crm_data.data.contacts` for the signed-in agent, which is protected by
`auth.uid() = agent_id`. So the first promote on a device asks for MyCRM credentials (username without the
`@xo-crm.local` suffix is fine); the session is stored locally and reused after that.

The contact is written with the exact field set MyCRM already uses — no new or missing keys — with
`stage: "Prospect"`, `tags: "Referral: <source>"`, and the source plus full timeline under `custom`.
The `notes` array is deliberately left empty because MyCRM's expected shape for it can't be inferred from
existing data; the promote sheet's **Copy** button hands you the formatted timeline for pasting wherever
MyCRM displays notes. Point `crmContactFrom()` at the right field once that's known.

The tracker record is never deleted by promoting — it stays as the full history and is marked `IN CRM`.

## Deploying

Static hosting, no build. On GitHub Pages: Settings → Pages → Source `Deploy from a branch`, branch `main`,
folder `/ (root)`. The service worker and manifest use relative paths, so it works from a project subpath.

After changing `index.html`, bump `CACHE` in `sw.js` (e.g. `ct-shell-v3` → `v4`) so installed devices pick
up the new version instead of serving the cached shell.
