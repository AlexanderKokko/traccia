# Traccia — audit report

Scope: the rebuilt application in this repository, checked against the live app at
`https://traccia-daily-flow.base44.app` and against `TRACCIA_DOCS (2).md`.

Everything under **Fixed** is already applied and verified in the running app.
Everything under **Open** is a decision or a piece of work I deliberately did not
take on my own.

---

## 1. Security — fixed

### 1.1 HTML injection into the doctor's report — *high*

`buildReportHtml()` interpolated diary notes, medication names, dosages and
free-text module answers straight into an HTML document, which is then written
into a new window with `document.write()` and printed.

A diary note of `<img src=x onerror=...>` or `<script>...</script>` executed as
code in that window. The window is same-origin, so the script had access to the
whole local data store. This is reachable by the user against themselves, but
also by anyone who can get text into their diary — for example a shared device,
or a future import/sync feature.

The live app has the same defect.

**Fixed:** every interpolated value now passes through an `esc()` helper that
escapes `& < > " '`. Verified with a payload containing both an `onerror`
attribute and a `<script>` tag — neither survives as markup.

### 1.2 Unsanitized Markdown rendered as HTML — *medium (defence in depth)*

The Guide page renders `TRACCIA_DOCS.md` through `marked` into
`dangerouslySetInnerHTML`. The file is app-owned today, but it is fetched at
runtime, so anything that can change what that path serves gets script execution.

**Fixed:** output is sanitized with DOMPurify. A hook also forces
`target="_blank"` + `rel="noopener noreferrer"` on external links in the rendered
document.

### 1.3 Unvalidated file upload — *medium*

The document uploader accepted any file of any size and stored it. Beyond the
obvious storage-exhaustion problem, it meant arbitrary content could be stored
and later handed to the browser via an object URL.

**Fixed:** an allowlist (`image/jpeg`, `image/png`, `image/webp`, `image/heic`,
`application/pdf`) and a 15 MB cap, both with a clear message to the user rather
than a silent failure.

### 1.4 Object URL leak — *low*

The staged-file preview called `URL.createObjectURL()` during render, creating a
new blob URL on every keystroke in the form and never revoking any of them.

**Fixed:** one URL per staged file, created in an effect and revoked on cleanup.

---

## 2. Security — open (needs a deployment decision)

### 2.1 No Content-Security-Policy

Nothing constrains what the page may load or execute. Serve these headers from
whatever hosts the build:

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
Strict-Transport-Security: max-age=63072000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=(self)
```

`'unsafe-inline'` for styles is required by React's inline `style` props and by
Framer Motion. `camera=(self)` keeps the "Scatta una foto" flow working.

### 2.2 Health data at rest — **mostly addressed**

With a project configured, data lives in Postgres (encrypted at rest by Supabase)
behind row-level security, and uploaded reports sit in a private bucket read
through one-hour signed URLs. That closes the gap against the GDPR claim in
section 12 of the documentation for the hosted path.

Two caveats remain:

- The **device-local fallback** still writes clear text to `localStorage` and
  IndexedDB. That is inherent to a device-local store; the amber banner now makes
  it obvious when the app is in that mode.
- Supabase can read the data, as any hosting provider can. For real patients you
  need a data processing agreement with them and a privacy notice naming them as
  processor. End-to-end encryption would remove that, but it would also break the
  printable report and any future server-side features — a product decision, not
  a technical one.

### 2.3 Authentication — **now addressed**

Superseded by the Supabase work. Accounts, sessions and per-row isolation are in
place; see [SETUP.md](SETUP.md) for what protects the data and how to verify it.
The device-local fallback still exists for running without a project, and now
says so in an amber banner rather than pretending to be an account.

What is still open there: account deletion removes every row and file but not the
`auth.users` record, which needs a service-role Edge Function (SETUP.md has it).

---

## 3. Correctness — fixed

### 3.1 Saving the diary twice in one day created duplicate entries — *high*

`DiaryForm` always called `DiaryEntry.create()`. Tapping "Salva voce di oggi"
twice produced two rows for the same day, and there was no way to correct a value
you had just entered — only to add another row on top of it.

That corrupted everything downstream: the period averages on Trends, the
"pain up more than 15%" alert on both Trends and Controlli, and the weekly AI
summary all average over raw rows.

The live app has the same defect.

**Fixed:** one entry per day per module. The form loads today's entry for the
selected module if there is one, prefills from it, and updates it on save.
Verified: three consecutive saves leave exactly one row; switching to a second
module adds exactly one more.

### 3.2 Misleading "0%" trend badge — *medium*

When a metric had no comparable previous period, `delta()` returned `null`, then
`-null` coerced to `-0`, which passed the `Math.abs(value) < 5` test and rendered
a confident "— 0%". A patient with two weeks of data saw "0% change" against a
period that does not exist.

The live app has the same defect.

**Fixed:** `null` is now distinguished from "no change" and no badge is drawn.
Verified against the 3-month period, where no previous window exists.

### 3.3 Continuity ribbon legend did not match the chart

The legend swatch for "Nessuna registrazione" was `#DDE3DF`; the dots it
described were drawn `#EEF1F0`. **Fixed** — one constant drives both.

### 3.4 Charts were unreadable in dark mode

Grid, axis ticks and tooltips were hardcoded to light values. **Fixed** with
`useChartTheme()`, which resolves them from the active theme; the continuity
ribbon uses it too.

### 3.5 The report showed a raw enum instead of the specialist's name

The printable report printed `ginecologo` rather than "Ginecologo/a". **Fixed**,
and it now respects the report language.

### 3.6 `ScrollToTop` crashed the router subtree

`useEffect(() => window.scrollTo(0, 0), [pathname])` returns the call's value,
which React then tries to use as a cleanup function. **Fixed.**

### 3.7 A blocked pop-up failed silently

"Esporta report" did nothing at all if the browser blocked the window. **Fixed** —
the user is told to allow pop-ups.

### 3.8 A regression I introduced, caught and fixed

While restructuring the Check-ups data load I made `load` a concise-body arrow
returning a promise, then passed it to `useEffect`. React treated the promise as
a cleanup function and the whole page crashed. The error boundary added in §5 is
what surfaced it as a readable message instead of a white screen, and the lint
rule in §5.9 now makes the pattern impossible. All four `load` functions were
re-checked; the three other call sites were already safe.

### 3.10 Dark mode washed out white behind the greeting card and the onboarding modal

Both overlays used Tailwind gradient *stop* utilities (`from-brand-softer`,
`to-white`). A stop utility compiles to one literal color — `#F0F9F4` — and does
not pick up the `.dark .bg-brand-softer` override, which only applies to the
`background-color` utility of the same name. In dark mode a near-white sheet was
therefore laid over both cards, washing the onboarding modal out almost entirely.

The live app has the same defect: its stylesheet has a single `.from-brand-softer`
rule and no dark counterpart.

**Fixed:** both overlays are now `.card-sheen` / `.modal-sheen` classes in
`index.css` with explicit light and dark gradients. Light mode is pixel-identical
to before; dark mode gets a subtle brand tint instead of white.

**Watch for this pattern elsewhere.** Any `from-*` / `via-*` / `to-*` utility
pointing at one of the brand literals has the same problem. The theme-aware
tokens (`hsl(var(--background))`, `hsl(var(--c-ink))`, …) are safe in gradients;
the flat hex values in `tailwind.config.js` are not.

### 3.9 Deleting all data did not stay deleted

The first version of the erasure control removed the "already seeded" marker
along with everything else, so on the next load a development build re-seeded
sample entries. Someone who had just deliberately deleted their diary would have
watched fake data appear in its place. **Fixed** — the marker survives erasure.

---

## 4. Consistency with `TRACCIA_DOCS`

| # | Documentation says | Live app does | This build |
|---|---|---|---|
| 4.1 | `NO_PAIN_MODULES` = Fibromialgia, Artrite Reumatoide | Ipertiroidismo, Ipotiroidismo | Follows the live app — **needs your decision** |
| 4.2 | A `/docs` route with a "Guida" tab | No such route | Built, per the documentation |
| 4.3 | Period selector includes 90 days | 7 / 14 / 30 only | Added 90 days |
| 4.4 | IBM Plex Mono for numeric data | Declared in CSS but never loaded | Loaded |
| 4.5 | react-leaflet, @hello-pangea/dnd, jspdf, html2canvas in the stack | Nothing uses them | Not installed |
| 4.6 | `@tanstack/react-query` in the stack | Mounted, but no query uses it | Mounted, still unused — see §5.2 |
| 4.7 | "Segna come preso" is a to-do needing `MedicationLog` | Button is inert | Dismisses the reminder for the session; no history yet |
| 4.8 | ZenGarden (large), OnboardingModal, HeroIllustration | Superseded in the live app | Not rebuilt |
| 4.9 | Auth pages, `ProtectedRoute`, `AuthContext` | Base44 boilerplate | Not rebuilt — see §5.1 |
| 4.11 | `lib/utils.js` exporting `cn` | Supports shadcn/ui primitives | Removed: the design system here is the custom classes in `index.css`, and `cn` had no consumer |

**4.1 matters clinically.** Fibromyalgia and rheumatoid arthritis are pain
conditions; hyper/hypothyroidism are not. The live app's choice looks right and
the documentation looks like the error, but this is a clinical call, not a
technical one — so I left the behaviour as the live app has it and am flagging it
rather than changing it.

### 4.10 Saving a check-up silently deletes the previous one

Adding an appointment with a specialist you already have an appointment with
deletes the old one without warning. This is the live app's behaviour and I kept
it, but it is surprising and destructive — a patient with two gynaecology
appointments cannot record both. Worth revisiting.

---

## 5. Proposals — what would make this production-grade

Roughly in the order I would do them.

### 5.1 A real backend and real auth — **done**

Supabase, with email/password accounts, session persistence and refresh,
row-level security on every table keyed to `auth.uid()`, a private storage bucket
for uploaded reports, and realtime subscriptions for cross-device sync.

The facade in `src/api/client.js` meant no page changed: both backends expose the
same surface, and the device-local one remains as a fallback.

Two design points worth recording:

- **The diary's one-entry-per-day rule is now a database constraint**
  (`unique (user_id, entry_date, module)`) and the save is a real upsert. §3.1 was
  fixed in the client; this makes it impossible rather than merely unlikely, which
  matters once two devices can write at the same moment.
- **Sign-in errors are deliberately vague** ("incorrect email or password") and
  the password-reset form always reports success, so neither can be used to find
  out whether a given person has a Traccia account.

Remaining: the service-role Edge Function that completes account deletion, and
the security headers in §2.1.

### 5.2 Adopt React Query, or drop it

It is in the documented stack and mounted in the tree, but every page hand-rolls
`useState` + `useEffect` + `.catch(() => {})` loading. Moving the entity reads
onto `useQuery` would remove that duplication, give real error states instead of
silently swallowed failures, and make the diary/Trends pages refresh consistently
after a write. About a day's work across six pages.

### 5.3 Tests

There are none. The bugs in §3.1 and §3.2 are exactly the kind a handful of unit
tests would have caught. I would start with Vitest over the pure logic —
`computeStreak`, the period/delta maths in Trends, `buildReportHtml` escaping —
then React Testing Library over the diary save flow.

### 5.4 Let people edit past days

Only today can be recorded. Anyone who misses a day — which is most people, most
weeks, and the norm during a flare — can never fill it in, and the streak garden
punishes them for it permanently. A date picker on the diary form plus the
existing upsert would cover it.

### 5.5 `MedicationLog` entity

Closes the documented to-do: a real "mark as taken" with history, a medication
adherence streak, and something concrete to show the doctor in the report.

### 5.6 Error handling the user can see

Every page still does `.catch(() => {})` on load. A failed read renders as an
empty state — indistinguishable from "you have no data", which in a health diary
is an alarming thing to show someone incorrectly. Pair this with §5.2.

### 5.7 Empty states

Trends with no entries at all renders empty cards and blank charts rather than
telling the user to record a first day.

### 5.8 Accessibility, beyond what is now done

Already applied: visible focus rings, a skip link, ARIA labels on every icon-only
button, `aria-current` on the active tab, a polite live region for toasts, and
`prefers-reduced-motion` support. Still open: the charts are invisible to a
screen reader — they need a table alternative or an `aria-label` summarising the
trend. Contrast of the lighter grey text (`text-ink/40`, `text-ink/45`) is below
WCAG AA on several labels.

### 5.9 Tooling

Added during this pass: Prettier (`npm run format`) and ESLint with the React and
React Hooks plugins (`npm run lint`). Lint is clean.

It earned its keep immediately — see §3.8. On top of the standard rules there is
one project-specific guard:

```js
"CallExpression[callee.name='useEffect'] > ArrowFunctionExpression[body.type!='BlockStatement']"
```

`useEffect(() => doThing(), [])` returns `doThing()`'s value, which React treats
as a cleanup function and then crashes on. That exact bug appeared twice in this
codebase in one afternoon, so the linter now refuses concise-body effects.

Still worth adding: CI running `lint` + `build` on every push, and TypeScript —
which would have caught the `chart`/`small` variable shadowing I hit while
theming the charts.

### 5.10 Performance

The initial bundle is now 423 KB (135 KB gzipped) after route-level code
splitting, down from 942 KB. The largest remaining chunk is Trends at 409 KB,
almost all Recharts. If that matters on mobile, a lighter chart library — or
hand-rolled SVG, which the continuity ribbon already demonstrates — would cut it
substantially.

### 5.11 PWA

The manifest exists but there is no service worker, so the app does not work
offline and cannot deliver the medication push notifications the documentation
lists as a to-do. `vite-plugin-pwa` plus a notification permission flow.

---

## 6. What I verified

- Full onboarding: name → conditions → theme, including name capitalisation.
- Diary save, in both languages, with and without a condition module selected.
- One entry per day per module, across repeat saves and module switches.
- Trends: metrics and deltas, all four periods, the pain chart, the three metric
  charts, the module-specific chart, the continuity ribbon, recent notes and the
  lifestyle panel.
- Weekly synthesis generation.
- Every route renders with a clean console.
- Dark mode, English, and a 375 px mobile viewport.
- Report escaping, against an injection payload; and the generated report parsed
  back into a DOM — correct headings, table structure, localized dates, zero
  `<script>` elements.
- The document upload lifecycle: store a file, resolve it to a blob URL, then
  delete both the record and the underlying file.
- Data export (correct shape and contents) and permanent erasure, including that
  nothing reappears after a reload.
- Toasts fire and are announced through the live region after the provider was
  refactored.
- Production build succeeds; `npm run lint` is clean.

Not driven through the real browser UI: the OS file picker and the print dialog.
Both code paths were exercised directly instead, as described above.
