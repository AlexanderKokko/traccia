-- ============================================================================
-- Traccia — database schema
--
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- It is idempotent: running it again is safe.
--
-- Every table is protected by row-level security keyed to auth.uid(). A patient
-- can only ever read or write their own rows — this is the single most important
-- guarantee in the whole application, so the policies are deliberately explicit
-- rather than clever.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles: one row per account, created automatically on sign-up
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  -- Set once the conditions/theme tour has been completed, so it is not shown
  -- again on the user's other devices.
  onboarded_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: read own"   on public.profiles;
drop policy if exists "profiles: insert own" on public.profiles;
drop policy if exists "profiles: update own" on public.profiles;

create policy "profiles: read own"   on public.profiles for select using  (auth.uid() = id);
create policy "profiles: insert own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: update own" on public.profiles for update using  (auth.uid() = id)
                                                                with check (auth.uid() = id);

-- The display name is collected at sign-up and arrives in raw_user_meta_data.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- diary_entries
--
-- The unique constraint enforces one entry per day per module at the database
-- level. The app upserts against it, so saving twice corrects the entry instead
-- of creating a duplicate that would skew every average on the Trends page.
-- ----------------------------------------------------------------------------
create table if not exists public.diary_entries (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  module           text not null default 'base',
  entry_date       date not null,
  pain             smallint check (pain between 0 and 10),
  energy           smallint check (energy between 0 and 10),
  sleep_hours      numeric(4, 1) check (sleep_hours >= 0 and sleep_hours <= 24),
  medication_taken text check (medication_taken in ('yes', 'later', 'no')),
  mood             smallint check (mood between 1 and 5),
  notes            text check (char_length(notes) <= 500),
  alarm_symptoms   text[] not null default '{}',
  module_data      jsonb  not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, entry_date, module)
);

create index if not exists diary_entries_user_date_idx
  on public.diary_entries (user_id, entry_date desc);

-- ----------------------------------------------------------------------------
-- pathologies
-- ----------------------------------------------------------------------------
create table if not exists public.pathologies (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  condition      text not null,
  custom_name    text,
  diagnosis_date date,
  diagnosis_year smallint check (diagnosis_year between 1900 and 2200),
  created_at     timestamptz not null default now()
);

create index if not exists pathologies_user_idx on public.pathologies (user_id, created_at desc);

-- ----------------------------------------------------------------------------
-- medical_documents
--
-- file_path is the object key inside the private `medical-documents` bucket,
-- always prefixed with the owner's uid so storage policies can check it.
-- ----------------------------------------------------------------------------
create table if not exists public.medical_documents (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  doc_type         text not null,
  doc_date         date not null,
  description      text,
  linked_condition text,
  file_path        text,
  file_type        text check (file_type in ('image', 'pdf')),
  file_name        text,
  created_at       timestamptz not null default now()
);

create index if not exists medical_documents_user_idx
  on public.medical_documents (user_id, doc_date desc);

-- ----------------------------------------------------------------------------
-- appointments
-- ----------------------------------------------------------------------------
create table if not exists public.appointments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  specialist       text not null,
  appointment_date date not null,
  created_at       timestamptz not null default now()
);

create index if not exists appointments_user_idx
  on public.appointments (user_id, appointment_date);

-- ----------------------------------------------------------------------------
-- therapies
-- ----------------------------------------------------------------------------
create table if not exists public.therapies (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  dosage     text,
  time       text,
  frequency  text not null default 'ogni_giorno'
               check (frequency in ('ogni_giorno', 'settimanale', 'al_bisogno')),
  created_at timestamptz not null default now()
);

create index if not exists therapies_user_idx on public.therapies (user_id, created_at desc);

-- ----------------------------------------------------------------------------
-- Row-level security for every patient-owned table
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'diary_entries', 'pathologies', 'medical_documents', 'appointments', 'therapies'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "%s: read own"   on public.%I', t, t);
    execute format('drop policy if exists "%s: insert own" on public.%I', t, t);
    execute format('drop policy if exists "%s: update own" on public.%I', t, t);
    execute format('drop policy if exists "%s: delete own" on public.%I', t, t);

    execute format(
      'create policy "%s: read own" on public.%I for select using (auth.uid() = user_id)', t, t);
    execute format(
      'create policy "%s: insert own" on public.%I for insert with check (auth.uid() = user_id)', t, t);
    execute format(
      'create policy "%s: update own" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);
    execute format(
      'create policy "%s: delete own" on public.%I for delete using (auth.uid() = user_id)', t, t);
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- Data API exposure
--
-- Written explicitly so the schema works with "Automatically expose new tables"
-- switched OFF — the safer project setting, because a table created later is
-- then unreachable until someone deliberately grants access to it.
--
-- `anon` is deliberately given nothing. Sign-up and sign-in go through the auth
-- API, not through these tables, so there is no legitimate reason for an
-- unauthenticated caller to touch any of them. Row-level security then narrows
-- `authenticated` down to each user's own rows.
-- ----------------------------------------------------------------------------
grant usage on schema public to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'diary_entries', 'pathologies', 'medical_documents',
    'appointments', 'therapies'
  ]
  loop
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- updated_at maintenance
-- ----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists diary_entries_touch on public.diary_entries;
create trigger diary_entries_touch before update on public.diary_entries
  for each row execute function public.touch_updated_at();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- Realtime: push row changes to every signed-in device
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.diary_entries;
    alter publication supabase_realtime add table public.pathologies;
    alter publication supabase_realtime add table public.medical_documents;
    alter publication supabase_realtime add table public.appointments;
    alter publication supabase_realtime add table public.therapies;
    alter publication supabase_realtime add table public.profiles;
  end if;
exception
  when duplicate_object then null;  -- already in the publication
end;
$$;

-- ----------------------------------------------------------------------------
-- Storage: private bucket for uploaded reports
--
-- Objects are stored as <uid>/<uuid>.<ext>, and the policies check that the
-- first path segment is the caller's uid. Nothing is public; the app reads
-- files through short-lived signed URLs.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('medical-documents', 'medical-documents', false)
on conflict (id) do nothing;

-- Enforce the upload limits server-side too. The app already checks type and
-- size before uploading, but client-side validation is a courtesy to the user,
-- not a control — anyone can call the storage API directly.
update storage.buckets
set file_size_limit = 15728640,  -- 15 MB, matching the client-side cap
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'
    ]
where id = 'medical-documents';

drop policy if exists "documents: read own"   on storage.objects;
drop policy if exists "documents: insert own" on storage.objects;
drop policy if exists "documents: delete own" on storage.objects;

create policy "documents: read own" on storage.objects for select
  using (bucket_id = 'medical-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "documents: insert own" on storage.objects for insert
  with check (bucket_id = 'medical-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "documents: delete own" on storage.objects for delete
  using (bucket_id = 'medical-documents' and (storage.foldername(name))[1] = auth.uid()::text);
