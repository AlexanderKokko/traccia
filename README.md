# 🌿 Traccia

A calm, bilingual symptom diary for people living with chronic conditions.
Record how a day went, keep therapies, reports and appointments in one place, and
bring a clear picture to your doctor.

This is a rebuild of [traccia-daily-flow.base44.app](https://traccia-daily-flow.base44.app),
per `TRACCIA_DOCS (2).md`.

## Running it

```bash
npm install
npm run dev
```

The app is at http://localhost:5180.

Out of the box it runs in **device-local mode**: everything works, but there are
no accounts and nothing syncs, and an amber banner says so. To turn on accounts
and cross-device sync, follow [SETUP.md](SETUP.md) — about ten minutes.

| Script | |
|---|---|
| `npm run dev` | dev server with HMR |
| `npm run build` | production build into `dist/` |
| `npm run preview` | serve the production build |
| `npm run lint` | ESLint over the project |
| `npm run format` | Prettier over `src/` |

## Stack

React 18 · Vite · Tailwind CSS · Framer Motion · Recharts · React Router ·
next-themes · TanStack Query · lucide-react · marked + DOMPurify ·
Supabase (auth, Postgres, storage, realtime)

## How it is put together

```
src/
  api/
    client.js         Backend facade. Everything else imports `db` from here.
    supabaseData.js   Supabase implementation: accounts, RLS, storage, realtime.
    base44Client.js   Device-local fallback (localStorage + IndexedDB).
    localStore.js     Persistence primitives for the fallback.
    weeklySummary.js  Weekly synthesis, shared by both backends.
    changeBus.js      Realtime change fan-out.
  lib/
    conditions.js     The 9 conditions: bilingual definitions, alarm symptoms,
                      dynamic diary fields, lifestyle guidance, content cards.
    translations.js   Every UI string, IT + EN.
    dateUtils.js      Formatting, period maths, streak calculation.
    printReport.js    The printable report for the doctor.
    issUrls.js        Links to ISSalute reference pages.
    LanguageContext.jsx
    AuthContext.jsx   Session, profile, and the realtime subscription.
    authErrors.js     Supabase auth errors → messages a patient can act on.
    useDataSync.js    Re-runs a page's loader when data changes anywhere.
    useChartTheme.js  Theme-aware chart colors.
  components/
    auth/             Auth shell, password field, form error
    diary/            Greeting, garden, condition selector, diary form, onboarding
    trends/           Weekly synthesis, continuity ribbon
    ui/               Toast
  pages/
    auth/             Login, register, forgot password, reset password
    ...               One per route
supabase/
  schema.sql          Tables, row-level security, storage bucket, realtime
```

### The data layer

Pages import `db` from `src/api/client.js` and never touch a provider directly.
Two implementations sit behind it with an identical surface —
`db.entities.X.list/filter/create/bulkCreate/update/delete`,
`db.auth.me/updateMe/signIn/signUp/logout`, `db.integrations.Core.*` — so no page
changed when accounts and sync were added:

- **Supabase** when `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are set.
- **Device-local** otherwise: `localStorage` for records, IndexedDB for uploaded
  reports (photos exceed the `localStorage` quota).

### Accounts and sync

Sign-up collects a name, email and password; the name is what the greeting uses.
Sessions persist and refresh on their own, so reopening the app on any device
resumes without signing in again.

Every table is protected by row-level security keyed to `auth.uid()`, enforced by
Postgres rather than by the client. Uploaded reports live in a private bucket
under `<user-id>/…` and are read through URLs signed for one hour.

Realtime subscriptions push changes to every signed-in device: an entry saved on
a phone appears on the laptop without a refresh. A unique constraint on
`(user_id, entry_date, module)` means two devices saving the same day cannot race
into duplicate rows — the second save updates the first.

The Guide page has a JSON export and a permanent delete (see [SETUP.md](SETUP.md)
for finishing account deletion server-side).

### The weekly synthesis

The hosted app called an LLM with an empathetic, explicitly non-diagnostic prompt
and a `{headline, summary}` schema. With no model wired up, `composeWeeklySummary()`
in `src/api/weeklySummary.js` derives the same shape from the data itself — real
numbers, the same warm register, nothing asserted that the entries do not show.
Nothing leaves the device.

To use a real model, replace that one function — and put the call behind a
Supabase Edge Function, so the provider API key never reaches the browser and
diary content is only sent onward deliberately.

### Sample data

In device-local mode, development seeds ~2 weeks of diary history so Trends, the
continuity ribbon and the streak garden have something to show. A real account is
never seeded, and production seeds nothing unless explicitly asked — see
`.env.example`. A health app must not invent symptom data.

## Design system

Tokens and component classes live in `src/index.css`, lifted from the live app.

- **Fraunces** headings and key numbers · **Inter** UI · **IBM Plex Mono** data
- Brand `#4FAF82` · ink `#1A2F2A` · canvas `#F9FAFB` · alarm `#C56B6B` · amber `#B8863B`
- `.card-float` / `.card-float-lg` glassmorphism, `.input-float`, `.btn-primary`,
  `.nav-tab`, `.cond-pill`, `.toggle-chip`, `.traccia-slider`
- Dark mode is a deep green-black; every token is redefined under `.dark`

## Tone

Calm, reassuring, never diagnostic. The app records and organises — it does not
interpret. Clinical badges show public reference ranges only, the disclaimer is
always visible, and the AI summary carries its own.

## Status

[SETUP.md](SETUP.md) — connecting Supabase, and what protects the data.

[AUDIT.md](AUDIT.md) — the security and consistency audit, what was fixed, and
what is still open.
