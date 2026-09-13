# Traccia — notes for Claude

A bilingual (IT/EN) symptom diary for people with chronic conditions. Rebuild of
a Base44 app; see `README.md` for architecture, `SETUP.md` for the backend,
`AUDIT.md` for known issues and what has already been fixed.

## Ground rules

**This is health data.** Special-category data under GDPR Article 9. Two things
follow:

- Never weaken row-level security or add a code path that reads another user's
  rows. Isolation is enforced in Postgres, not in the client, and it should stay
  that way.
- Never invent symptom data. Sample entries exist only in the device-local
  fallback and only in development (`VITE_SEED_DEMO`).

**Tone is clinical-adjacent, never diagnostic.** The app records and organises;
it does not interpret. Badges show public reference ranges only. Any AI output
carries its own disclaimer. Keep copy calm and reassuring.

## Conventions

- Pages import `db` from `@/api/client` — never a provider directly. Two backends
  sit behind it with an identical surface (Supabase, and a device-local
  fallback), so a page must work under both.
- All UI strings live in `src/lib/translations.js` with an `it` and an `en` key.
  Both objects must stay the same length; there is no fallback to a missing key
  beyond returning the key itself.
- Design tokens and component classes (`card-float`, `input-float`,
  `btn-primary`, `nav-tab`, …) are in `src/index.css`. Prefer them over ad-hoc
  Tailwind so light and dark stay consistent.
- Dark mode: every colour needs a dark counterpart. Tailwind gradient *stop*
  utilities (`from-*`, `via-*`, `to-*`) resolve to one literal and do **not**
  pick up `.dark` overrides — that bug shipped twice. Use a CSS class with
  explicit light/dark gradients instead.

## Before finishing any change

```bash
npm run lint && npm run build
```

Both must pass. Two lint rules exist because the mistakes they catch actually
happened here:

- `react-hooks/set-state-in-effect` — data loaders are promise chains, not
  `async` functions, so effects can call them without cascading renders.
- The `no-restricted-syntax` rule banning concise-body `useEffect` arrows.
  `useEffect(() => doThing(), [])` returns a value React treats as a cleanup
  function, and then crashes. Always use a block body.

Verify UI changes in the browser, not just by building. The app runs on
http://localhost:5180.
