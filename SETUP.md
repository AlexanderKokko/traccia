# Setting up accounts and sync

Traccia stores health data, so the backend does the security work: every row is
locked to its owner by the database itself, not by the app being careful.

This takes about ten minutes.

---

## 1. Create the Supabase project

1. Sign up at [supabase.com](https://supabase.com) and create a new project.
2. **Choose an EU region** if your users are in the EU — health data is
   special-category data under GDPR Article 9, and keeping it in the EU avoids a
   transfer question you would otherwise have to answer.
3. Save the database password somewhere safe.

The **Security** options on that dialog:

| Option | Set it to | Why |
|---|---|---|
| Enable Data API | **on** | `supabase-js` talks to the Data API. The app cannot read or write anything without it. |
| Automatically expose new tables | **off** | Supabase's own recommendation. With it off, a table added later is unreachable until someone grants access on purpose — so forgetting to lock one down fails closed instead of open. `schema.sql` grants exactly what this app needs, to `authenticated` only. |
| Enable automatic RLS | **on** | A safety net: any future table gets row-level security switched on by default. `schema.sql` already enables it explicitly on all six tables, so this only guards against a later mistake — the expensive kind. |

## 2. Create the schema

Open **SQL Editor → New query**, paste the whole of
[`supabase/schema.sql`](supabase/schema.sql), and run it.

That creates the six tables, switches on row-level security with a policy per
operation per table, adds the private storage bucket for uploaded reports, and
enables realtime so a change on one device appears on the others.

It is safe to run again later — every statement is idempotent.

## 3. Point the app at the project

**Project Settings → API** gives you two values. Put them in `.env.local`:

```bash
cp .env.example .env.local
```

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

The **anon** key is meant to be in the browser — it only grants what row-level
security allows. The **service_role** key must never appear in this file, in the
client, or in the repository: it bypasses RLS completely.

Restart the dev server. The amber "Modalità locale" banner disappears, and the
app now asks people to sign in.

## 4. Configure auth

**Authentication → Providers → Email**

- Leave **Confirm email** on. It keeps someone from signing up with an address
  they do not control, which matters when that address is the only way back into
  a medical diary.

**Authentication → URL Configuration**

- Site URL: `http://localhost:5180` in development, your real domain in production.
- Redirect URLs: add `<your-domain>/reset-password` and `<your-domain>/login`.

Without those, the password-reset and confirmation links will refuse to open.

## 5. Check it works

1. Go to `/register` and create an account.
2. Confirm the email.
3. Sign in, record a diary entry.
4. Open the same account in a different browser — the entry is already there.
5. Save a second entry for the same day on one device; the other updates in
   place rather than growing a duplicate.

---

## What protects the data

| | |
|---|---|
| **Passwords** | Hashed by Supabase (bcrypt). The app never sees or stores one. |
| **Sessions** | Short-lived JWT plus a refresh token, rotated automatically. |
| **Row access** | `auth.uid() = user_id` on select, insert, update and delete, for every table. Enforced by Postgres, so a bug in the client cannot leak another patient's diary. |
| **Uploaded reports** | Private bucket. Objects live under `<user-id>/…` and the storage policy checks that prefix. The app reads them through URLs signed for one hour. |
| **In transit** | TLS to Supabase. |
| **At rest** | Encrypted by Supabase at the disk level. |

### Verifying the isolation yourself

Worth doing once, because it is the guarantee everything else rests on. Create
two accounts, add an entry to each, then in the SQL editor:

```sql
-- as account A's JWT, this must return only A's rows
select count(*) from diary_entries;
```

Or simpler: sign in as A in one browser and B in another, and confirm neither
sees the other's diary.

---

## Still open

**Account deletion is only partial.** "Elimina tutto" on the Guide page removes
every row and uploaded file, but not the `auth.users` record — deleting that
needs the service_role key, which must not reach the browser. To finish the job
properly, add an Edge Function:

```ts
// supabase/functions/delete-account/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!jwt) return new Response('Unauthorized', { status: 401 })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data, error } = await admin.auth.getUser(jwt)
  if (error || !data.user) return new Response('Unauthorized', { status: 401 })

  // Cascades to every table via `references auth.users (id) on delete cascade`
  await admin.auth.admin.deleteUser(data.user.id)
  return new Response(null, { status: 204 })
})
```

**Before real patients use this**, you also want: a data processing agreement
with Supabase, a privacy notice naming them as processor, backup and retention
policies, and the security headers listed in [AUDIT.md](AUDIT.md) §2.1.
