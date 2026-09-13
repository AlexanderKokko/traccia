# Traccia — full source bundle

Every source file of the app in one document, so a chat session can hold the
whole codebase at once.

**Deliberately excluded**, because they are large generated data files and would
crowd out the code:

- `src/lib/conditions.js` (1,831 lines) — the 9 chronic conditions: bilingual
  definitions, alarm symptoms, dynamic diary fields, lifestyle guidance,
  educational cards. Helpers: `getCondition(key, lang)`, `getConditionList(lang)`,
  `getPainBadges`, `getMedicationOptions`, `getDocTypes`, `getSpecialists`,
  `getFrequencies`, `getBadgeStyle`, `MOOD_LEVELS`, `NO_PAIN_MODULES`.
- `src/lib/translations.js` (430 lines) — every UI string as `{ it: {...}, en: {...} }`,
  read through `t(key, lang)`. Both languages must stay in sync.

Ask for either if you need to change them.

Read `CLAUDE.md` for conventions before editing anything.

---

## Entry point & routing

### `src/main.jsx`

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from 'next-themes'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { seedDemoDataOnce } from './api/base44Client'
import { isCloudBacked } from './api/client'
import './index.css'

// Sample history makes the Trends page meaningful during development. A real
// account is never seeded: sample entries exist only in the device-local
// fallback, and only in development unless explicitly asked for.
const seedDemo =
  !isCloudBacked &&
  (import.meta.env.DEV
    ? import.meta.env.VITE_SEED_DEMO !== 'false'
    : import.meta.env.VITE_SEED_DEMO === 'true')

if (seedDemo) seedDemoDataOnce()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
```

### `src/App.jsx`

```jsx
import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import { LanguageProvider } from '@/lib/LanguageContext'
import { AuthProvider } from '@/lib/AuthContext'
import { ToastProvider } from '@/components/ui/toast'
import ScrollToTop from '@/components/ScrollToTop'
import ProtectedRoute from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'
import Home from '@/pages/Home'
import Login from '@/pages/auth/Login'
import PageNotFound from '@/pages/PageNotFound'

// The diary is the landing page and stays in the main bundle. Everything else —
// notably Trends (Recharts) and Docs (marked + DOMPurify) — loads on demand, so
// the first paint is not paying for charts the user may never open.
const Register = lazy(() => import('@/pages/auth/Register'))
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'))
const Patologies = lazy(() => import('@/pages/Patologies'))
const Documents = lazy(() => import('@/pages/Documents'))
const Trends = lazy(() => import('@/pages/Trends'))
const Appointments = lazy(() => import('@/pages/Appointments'))
const Therapies = lazy(() => import('@/pages/Therapies'))
const Contents = lazy(() => import('@/pages/Contents'))
const Docs = lazy(() => import('@/pages/Docs'))

function RouteFallback() {
  return (
    <div className="flex justify-center py-20">
      <div className="spinner" />
    </div>
  )
}

function Lazy({ children }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <BrowserRouter>
              <ScrollToTop />
              <Routes>
                {/* Public — the way in */}
                <Route path="/login" element={<Login />} />
                <Route
                  path="/register"
                  element={
                    <Lazy>
                      <Register />
                    </Lazy>
                  }
                />
                <Route
                  path="/forgot-password"
                  element={
                    <Lazy>
                      <ForgotPassword />
                    </Lazy>
                  }
                />
                <Route
                  path="/reset-password"
                  element={
                    <Lazy>
                      <ResetPassword />
                    </Lazy>
                  }
                />

                {/* The diary itself — never reachable without a session */}
                <Route
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/" element={<Home />} />
                  <Route
                    path="/patologie"
                    element={
                      <Lazy>
                        <Patologies />
                      </Lazy>
                    }
                  />
                  <Route
                    path="/referti"
                    element={
                      <Lazy>
                        <Documents />
                      </Lazy>
                    }
                  />
                  <Route
                    path="/andamento"
                    element={
                      <Lazy>
                        <Trends />
                      </Lazy>
                    }
                  />
                  <Route
                    path="/controlli"
                    element={
                      <Lazy>
                        <Appointments />
                      </Lazy>
                    }
                  />
                  <Route
                    path="/terapie"
                    element={
                      <Lazy>
                        <Therapies />
                      </Lazy>
                    }
                  />
                  <Route
                    path="/contenuti"
                    element={
                      <Lazy>
                        <Contents />
                      </Lazy>
                    }
                  />
                  <Route
                    path="/docs"
                    element={
                      <Lazy>
                        <Docs />
                      </Lazy>
                    }
                  />
                  <Route path="*" element={<PageNotFound />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </ToastProvider>
        </QueryClientProvider>
      </AuthProvider>
    </LanguageProvider>
  )
}
```

---

## Data layer

### `src/api/client.js`

```jsx
/**
 * Backend facade.
 *
 * The app talks to `db` and never to a specific provider. Two implementations
 * sit behind it and expose an identical surface:
 *
 *   - Supabase  — accounts, row-level security, cross-device sync. Used whenever
 *                 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set.
 *   - Local     — localStorage + IndexedDB, single implicit user, no sync. The
 *                 fallback so the app still runs with no project configured.
 *
 * Because the surface is the same, no page knows or cares which one is active.
 */
import { isSupabaseConfigured } from './supabaseClient'
import { supabaseData, subscribeToChanges } from './supabaseData'
import {
  base44 as localData,
  resolveFileUrl as resolveLocalFile,
  removeStoredFile as removeLocalFile,
  exportAllData as exportLocalData,
  eraseAllData as eraseLocalData,
} from './base44Client'

export const isCloudBacked = isSupabaseConfigured

export const db = isCloudBacked ? supabaseData : localData

export function resolveFileUrl(handle) {
  return isCloudBacked ? supabaseData.resolveFileUrl(handle) : resolveLocalFile(handle)
}

export function removeStoredFile(handle) {
  return isCloudBacked ? supabaseData.removeStoredFile(handle) : removeLocalFile(handle)
}

export { subscribeToChanges }

/**
 * Right of access: everything the account holds, as one JSON object. Uploaded
 * files are referenced by their storage key rather than inlined.
 */
export async function exportAllData() {
  if (!isCloudBacked) return exportLocalData()

  const user = await db.auth.me()
  const names = ['DiaryEntry', 'Pathology', 'MedicalDocument', 'Appointment', 'Therapy']
  const entries = await Promise.all(
    names.map(async (name) => [name, await db.entities[name].list('-created_date')])
  )

  return {
    exported_at: new Date().toISOString(),
    app: 'Traccia',
    user,
    entities: Object.fromEntries(entries),
  }
}

/**
 * Right to erasure: removes every record and uploaded file belonging to the
 * account. Irreversible — callers must confirm first.
 *
 * The auth user itself is deliberately left in place: deleting it needs the
 * service-role key, which must never reach the browser. See README for the Edge
 * Function that completes the deletion server-side.
 */
export async function eraseAllData() {
  if (!isCloudBacked) return eraseLocalData()

  const documents = await db.entities.MedicalDocument.list('-created_date')
  await Promise.all(documents.map((doc) => removeStoredFile(doc.file_url).catch(() => {})))

  const names = ['DiaryEntry', 'Pathology', 'MedicalDocument', 'Appointment', 'Therapy']
  for (const name of names) {
    const rows = await db.entities[name].list('-created_date')
    for (const row of rows) {
      await db.entities[name].delete(row.id)
    }
  }

  await db.auth.updateMe({ display_name: null })
}
```

### `src/api/supabaseClient.js`

```jsx
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * True once the project credentials are present. Without them the app falls
 * back to the device-local store, so it still runs — but nothing syncs and
 * there are no accounts. See README.
 */
export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        // The session lives in localStorage and is refreshed in the background,
        // so reopening the app on any device resumes without a new sign-in.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
```

### `src/api/supabaseData.js`

```jsx
/**
 * Supabase-backed implementation of the entity/auth surface the pages already
 * use. Keeping the shape identical to the local client means no page had to
 * change when accounts and sync were added.
 *
 * Two mappings happen here so the UI can stay as it was:
 *   - `created_date` (what the pages sort by)  ↔  `created_at` (the column)
 *   - `file_url`     (what the pages render)   ↔  `file_path` (the storage key)
 */
import { supabase } from './supabaseClient'
import { emitDataChange } from './changeBus'

const BUCKET = 'medical-documents'

const TABLES = {
  DiaryEntry: 'diary_entries',
  Pathology: 'pathologies',
  MedicalDocument: 'medical_documents',
  Appointment: 'appointments',
  Therapy: 'therapies',
}

/** Columns the UI refers to by a different name than the database does. */
const ALIASES = { created_date: 'created_at' }

function column(field) {
  return ALIASES[field] || field
}

function toRow(record) {
  if (!record) return record
  const { created_at, file_path, ...rest } = record
  return {
    ...rest,
    ...(created_at !== undefined ? { created_date: created_at } : {}),
    ...(file_path !== undefined ? { file_url: file_path } : {}),
  }
}

function toColumns(data) {
  const { created_date, file_url, id, user_id, ...rest } = data
  return {
    ...rest,
    ...(file_url !== undefined ? { file_path: file_url } : {}),
  }
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) throw new Error('Not signed in')
  return data.user.id
}

function applySort(query, sort) {
  if (!sort) return query
  const descending = sort.startsWith('-')
  return query.order(column(descending ? sort.slice(1) : sort), { ascending: !descending })
}

function entity(name) {
  const table = TABLES[name]

  return {
    async list(sort, limit) {
      let query = applySort(supabase.from(table).select('*'), sort)
      if (limit) query = query.limit(limit)
      const { data, error } = await query
      if (error) throw error
      return data.map(toRow)
    },

    async filter(where, sort, limit) {
      let query = supabase.from(table).select('*')
      Object.entries(where || {}).forEach(([key, value]) => {
        query = query.eq(column(key), value)
      })
      query = applySort(query, sort)
      if (limit) query = query.limit(limit)
      const { data, error } = await query
      if (error) throw error
      return data.map(toRow)
    },

    async get(id) {
      const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return toRow(data)
    },

    async create(record) {
      const user_id = await currentUserId()
      const { data, error } = await supabase
        .from(table)
        .insert({ ...toColumns(record), user_id })
        .select()
        .single()
      if (error) throw error
      emitDataChange(name)
      return toRow(data)
    },

    async bulkCreate(records) {
      if (!records.length) return []
      const user_id = await currentUserId()
      const { data, error } = await supabase
        .from(table)
        .insert(records.map((r) => ({ ...toColumns(r), user_id })))
        .select()
      if (error) throw error
      emitDataChange(name)
      return data.map(toRow)
    },

    async update(id, record) {
      const { data, error } = await supabase
        .from(table)
        .update(toColumns(record))
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      emitDataChange(name)
      return toRow(data)
    },

    async delete(id) {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) throw error
      emitDataChange(name)
      return { id }
    },
  }
}

/**
 * One entry per day per module, enforced by a unique constraint in the database.
 * Saving the diary again for the same day updates that row rather than adding a
 * second one, which would skew every average on the Trends page.
 */
async function upsertDiaryEntry(record) {
  const user_id = await currentUserId()
  const { data, error } = await supabase
    .from(TABLES.DiaryEntry)
    .upsert({ ...toColumns(record), user_id }, { onConflict: 'user_id,entry_date,module' })
    .select()
    .single()
  if (error) throw error
  emitDataChange('DiaryEntry')
  return toRow(data)
}

/* ------------------------------- auth ------------------------------- */

const auth = {
  async me() {
    const { data, error } = await supabase.auth.getUser()
    if (error || !data?.user) throw new Error('Not signed in')

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, onboarded_at')
      .eq('id', data.user.id)
      .maybeSingle()

    return {
      id: data.user.id,
      email: data.user.email,
      display_name: profile?.display_name || data.user.user_metadata?.display_name || null,
      onboarded_at: profile?.onboarded_at || null,
      full_name: null,
      created_date: data.user.created_at,
    }
  },

  async updateMe(patch) {
    const id = await currentUserId()
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id, ...patch })
      .select()
      .single()
    if (error) throw error
    // Mirror onto the auth user so the name survives a profile read failure.
    if (patch.display_name) {
      await supabase.auth.updateUser({ data: { display_name: patch.display_name } })
    }
    emitDataChange('profiles')
    return data
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  },

  async signUp(email, password, displayName) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName || null },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    })
    if (error) throw error
    return data
  },

  async requestPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  },

  async updatePassword(password) {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  },

  async logout(redirectTo = '/login') {
    await supabase.auth.signOut()
    window.location.href = redirectTo
  },
}

/* --------------------------- file storage --------------------------- */

/** Uploads to <uid>/<random>.<ext>; storage policies check that first segment. */
async function uploadFile({ file }) {
  const user_id = await currentUserId()
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
  const path = `${user_id}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error

  return { file_url: path }
}

/** The bucket is private, so rendering a document needs a short-lived signed URL. */
async function resolveFileUrl(filePath) {
  if (!filePath) return null
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, 3600)
  if (error) {
    console.error('Could not sign document URL', error)
    return null
  }
  return data.signedUrl
}

async function removeStoredFile(filePath) {
  if (!filePath) return
  const { error } = await supabase.storage.from(BUCKET).remove([filePath])
  if (error) console.error('Could not delete stored document', error)
}

/* ------------------------ weekly AI synthesis ----------------------- */

/**
 * Derived from the user's own numbers, exactly as in the local client — no model
 * is called and no diary data leaves the device for a third party. Swapping in a
 * real model means replacing this one function (ideally behind a Supabase Edge
 * Function, so the API key never reaches the browser).
 */
import { composeWeeklySummary } from './weeklySummary'

/* ------------------------------ client ------------------------------ */

export const supabaseData = {
  auth,
  entities: {
    DiaryEntry: { ...entity('DiaryEntry'), upsert: upsertDiaryEntry },
    Pathology: entity('Pathology'),
    MedicalDocument: entity('MedicalDocument'),
    Appointment: entity('Appointment'),
    Therapy: entity('Therapy'),
  },
  integrations: {
    Core: {
      InvokeLLM: composeWeeklySummary,
      UploadFile: uploadFile,
      UploadPublicFile: uploadFile,
    },
  },
  resolveFileUrl,
  removeStoredFile,
}

/**
 * Subscribes to every table this user owns and reports changes through the
 * change bus, so a diary entry saved on a phone appears on the laptop without a
 * refresh. Returns an unsubscribe function.
 */
export function subscribeToChanges(userId) {
  const channel = supabase.channel(`traccia:${userId}`)

  Object.entries(TABLES).forEach(([name, table]) => {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
      () => emitDataChange(name)
    )
  })

  channel.subscribe()
  return () => supabase.removeChannel(channel)
}
```

### `src/api/base44Client.js`

```jsx
/**
 * Base44-compatible client.
 *
 * The published app runs on Base44 (auth + entity database + Core integrations).
 * This build ships a local, offline implementation with the **same call surface**,
 * so everything works without a backend and swapping in the hosted SDK is a
 * one-file change:
 *
 *   import { createClient } from '@base44/sdk'
 *   export const base44 = createClient({ appId: '…' })
 *
 * Entity semantics mirrored from the hosted SDK:
 *   - `list(sort, limit)` where `sort` is a field name, `-field` for descending
 *   - `filter(where, sort, limit)`
 *   - `create`, `bulkCreate`, `delete`
 *   - every record gets `id` and `created_date`
 */
import {
  table,
  newId,
  readJSON,
  writeJSON,
  putFile,
  getFile,
  deleteFile,
  clearFiles,
  listOwnedKeys,
  removeKey,
} from './localStore'
import { getCondition } from '@/lib/conditions'
import { composeWeeklySummary } from './weeklySummary'
import { todayISO, subtractDays } from '@/lib/dateUtils'

const LATENCY = 90 // ms — keeps loading states honest during development

const wait = (ms = LATENCY) => new Promise((r) => setTimeout(r, ms))

function sortRows(rows, sort) {
  if (!sort) return rows
  const desc = sort.startsWith('-')
  const field = desc ? sort.slice(1) : sort
  return [...rows].sort((a, b) => {
    const av = a[field]
    const bv = b[field]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    if (av === bv) return 0
    return (av < bv ? -1 : 1) * (desc ? -1 : 1)
  })
}

function matches(row, where) {
  return Object.entries(where || {}).every(([k, v]) => row[k] === v)
}

function entity(name) {
  return {
    async list(sort, limit) {
      await wait()
      const rows = sortRows(table.read(name), sort)
      return limit ? rows.slice(0, limit) : rows
    },

    async filter(where, sort, limit) {
      await wait()
      const rows = sortRows(
        table.read(name).filter((r) => matches(r, where)),
        sort
      )
      return limit ? rows.slice(0, limit) : rows
    },

    async get(id) {
      await wait()
      return table.read(name).find((r) => r.id === id) || null
    },

    async create(data) {
      await wait()
      const row = { ...data, id: newId(), created_date: new Date().toISOString() }
      table.write(name, [row, ...table.read(name)])
      return row
    },

    async bulkCreate(items) {
      await wait()
      const rows = items.map((data) => ({
        ...data,
        id: newId(),
        created_date: new Date().toISOString(),
      }))
      table.write(name, [...rows, ...table.read(name)])
      return rows
    },

    async update(id, data) {
      await wait()
      const rows = table.read(name).map((r) => (r.id === id ? { ...r, ...data } : r))
      table.write(name, rows)
      return rows.find((r) => r.id === id) || null
    },

    async delete(id) {
      await wait()
      table.write(
        name,
        table.read(name).filter((r) => r.id !== id)
      )
      return { id }
    },
  }
}

/* ------------------------------- auth ------------------------------- */

const auth = {
  async me() {
    await wait(40)
    return readJSON('user', {
      id: 'local-user',
      display_name: null,
      onboarded_at: null,
      full_name: null,
      email: null,
    })
  },

  async updateMe(patch) {
    await wait()
    const user = await auth.me()
    const next = { ...user, ...patch }
    writeJSON('user', next)
    return next
  },

  async logout(redirectTo = '/') {
    writeJSON('user', {
      id: 'local-user',
      display_name: null,
      onboarded_at: null,
      full_name: null,
      email: null,
    })
    window.location.href = redirectTo
  },
}

/* --------------------------- integrations --------------------------- */

async function uploadFile({ file }) {
  await wait(400)
  const id = newId()
  await putFile(id, file)
  return { file_url: `traccia-file:${id}` }
}

/** Resolve a `traccia-file:` handle into a blob URL the browser can render. */
export async function resolveFileUrl(fileUrl) {
  if (!fileUrl || !fileUrl.startsWith('traccia-file:')) return fileUrl
  const blob = await getFile(fileUrl.slice('traccia-file:'.length))
  return blob ? URL.createObjectURL(blob) : null
}

export async function removeStoredFile(fileUrl) {
  if (fileUrl && fileUrl.startsWith('traccia-file:')) {
    await deleteFile(fileUrl.slice('traccia-file:'.length))
  }
}

/* ------------------------------ client ------------------------------ */

export const base44 = {
  auth,
  entities: {
    DiaryEntry: entity('DiaryEntry'),
    Pathology: entity('Pathology'),
    MedicalDocument: entity('MedicalDocument'),
    Appointment: entity('Appointment'),
    Therapy: entity('Therapy'),
  },
  integrations: {
    Core: {
      InvokeLLM: composeWeeklySummary,
      UploadFile: uploadFile,
      UploadPublicFile: uploadFile,
    },
  },
}

const ENTITY_NAMES = ['DiaryEntry', 'Pathology', 'MedicalDocument', 'Appointment', 'Therapy']

/**
 * Right of access: everything the app holds about this user, as one JSON object.
 * Uploaded files are referenced by handle, not inlined — they are exported
 * separately by the caller if needed.
 */
export async function exportAllData() {
  const user = await auth.me()
  return {
    exported_at: new Date().toISOString(),
    app: 'Traccia',
    user,
    entities: Object.fromEntries(ENTITY_NAMES.map((name) => [name, table.read(name)])),
  }
}

/**
 * Right to erasure: removes every record, uploaded file and preference this app
 * has stored on the device. Irreversible — callers must confirm first.
 */
export async function eraseAllData() {
  listOwnedKeys().forEach(removeKey)
  try {
    await clearFiles()
  } catch (err) {
    console.error('Could not clear the file store', err)
  }
  // Keep the "already seeded" marker so sample data cannot reappear after
  // someone has deliberately deleted everything.
  writeJSON('seeded', true)
}

/**
 * Seeds two weeks of plausible diary history the first time the app runs, so the
 * Trends page, the continuity ribbon and the garden streak have something to show.
 */
export function seedDemoDataOnce() {
  if (readJSON('seeded', false)) return
  writeJSON('seeded', true)

  if (table.read('DiaryEntry').length > 0) return

  const modules = ['emicrania', 'endometriosi']
  const entries = []
  for (let i = 13; i >= 0; i--) {
    if (i === 4 || i === 9) continue // a couple of missed days, for a realistic ribbon
    const module = modules[i % modules.length]
    const condition = getCondition(module, 'it')
    const pain = Math.max(0, Math.min(10, Math.round(4 + Math.sin(i / 2) * 3)))
    entries.push({
      id: newId(),
      created_date: new Date(Date.now() - i * 86400000).toISOString(),
      module,
      entry_date: subtractDays(todayISO(), i),
      pain,
      energy: Math.max(0, Math.min(10, 9 - pain + (i % 3))),
      sleep_hours: 6 + (i % 4) * 0.5,
      medication_taken: i % 5 === 0 ? 'later' : 'yes',
      mood: Math.max(1, Math.min(5, 5 - Math.round(pain / 3))),
      notes:
        i === 2
          ? 'Giornata pesante, ho ridotto le attività nel pomeriggio.'
          : i === 7
            ? 'Meglio dopo una camminata lunga.'
            : null,
      alarm_symptoms: ['Nessuno di questi'],
      module_data: condition
        ? Object.fromEntries(
            condition.fields
              .filter((f) => f.type === 'slider')
              .map((f) => [f.key, Math.max(f.min ?? 0, Math.min(f.max ?? 10, pain))])
          )
        : {},
    })
  }
  table.write('DiaryEntry', entries.reverse())
}
```

### `src/api/localStore.js`

```jsx
// Tiny persistence layer used by the local Base44-compatible client.
// Records live in localStorage (small JSON); uploaded files live in IndexedDB
// (blobs, too large for localStorage quota).

const NS = 'traccia'

function readTable(name) {
  try {
    return JSON.parse(localStorage.getItem(`${NS}:${name}`) || '[]')
  } catch {
    return []
  }
}

function writeTable(name, rows) {
  try {
    localStorage.setItem(`${NS}:${name}`, JSON.stringify(rows))
  } catch (err) {
    console.error(`Could not persist ${name}`, err)
    throw err
  }
}

export function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(`${NS}:${key}`)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function writeJSON(key, value) {
  try {
    localStorage.setItem(`${NS}:${key}`, JSON.stringify(value))
  } catch (err) {
    console.error(`Could not persist ${key}`, err)
  }
}

export const table = { read: readTable, write: writeTable }

/** Every localStorage key this app owns, so erasure can be complete. */
export function listOwnedKeys() {
  const keys = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(`${NS}:`)) keys.push(key)
    }
  } catch {
    /* storage unavailable */
  }
  return keys
}

export function removeKey(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* storage unavailable */
  }
}

export function newId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`
}

/* ---------------- File store (IndexedDB) ---------------- */

const DB_NAME = 'traccia-files'
const STORE = 'files'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function putFile(id, file) {
  const db = await openDb()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(file, id)
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function getFile(id) {
  const db = await openDb()
  const file = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return file
}

export async function clearFiles() {
  const db = await openDb()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).clear()
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function deleteFile(id) {
  const db = await openDb()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}
```

### `src/api/weeklySummary.js`

```jsx
/**
 * Weekly synthesis — shared by both backends.
 *
 * The hosted app called an LLM with an empathetic, explicitly non-diagnostic prompt
 * and a `{headline, summary}` schema. With no model wired up we derive the same shape
 * from the data itself: real numbers, the same warm non-clinical register, and nothing
 * asserted that the entries do not show. Nothing leaves the device.
 *
 * To use a real model, replace this function — and put the call behind a Supabase Edge
 * Function so the provider API key never reaches the browser, and so diary content is
 * only sent onward deliberately.
 */
export async function composeWeeklySummary({ payload, lang = 'it' }) {
  await new Promise((r) => setTimeout(r, 900))
  const days = payload || []
  const en = lang === 'en'
  if (days.length < 2) throw new Error('not enough data')

  const avg = (key) => {
    const vals = days.map((d) => d[key]).filter((v) => v != null)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }

  const pain = avg('dolore')
  const energy = avg('energia')
  const sleep = avg('sonno_ore')
  const mood = avg('umore')

  const withBoth = days.filter((d) => d.dolore != null && d.energia != null)
  const inverse =
    withBoth.length >= 3 &&
    withBoth.filter((d) => d.dolore > (pain ?? 0) && d.energia < (energy ?? 0)).length >=
      Math.ceil(withBoth.length / 3)

  const first = days[0]
  const last = days[days.length - 1]
  const painTrend =
    first?.dolore != null && last?.dolore != null ? last.dolore - first.dolore : null

  const headline = en
    ? days.length >= 6
      ? 'A steady week of tracking'
      : 'A few days, gently noted'
    : days.length >= 6
      ? 'Una settimana seguita con costanza'
      : 'Qualche giorno, annotato con cura'

  const parts = []
  parts.push(
    en
      ? `You logged ${days.length} ${days.length === 1 ? 'day' : 'days'} this week.`
      : `Hai registrato ${days.length} ${days.length === 1 ? 'giorno' : 'giorni'} questa settimana.`
  )

  if (pain != null) {
    parts.push(
      en
        ? `Pain sat around ${pain.toFixed(1)}/10 on average${
            painTrend != null && Math.abs(painTrend) >= 1
              ? painTrend < 0
                ? ', easing towards the end of the week'
                : ', climbing a little towards the end of the week'
              : ''
          }.`
        : `Il dolore si è mantenuto intorno a ${pain.toFixed(1)}/10 in media${
            painTrend != null && Math.abs(painTrend) >= 1
              ? painTrend < 0
                ? ', in calo verso fine settimana'
                : ', in leggera salita verso fine settimana'
              : ''
          }.`
    )
  }

  if (inverse) {
    parts.push(
      en
        ? 'Energy tended to dip on the days when pain was higher.'
        : "L'energia tendeva a calare nelle giornate con più dolore."
    )
  } else if (energy != null) {
    parts.push(
      en
        ? `Energy averaged ${energy.toFixed(1)}/10.`
        : `L'energia è stata in media ${energy.toFixed(1)}/10.`
    )
  }

  if (sleep != null) {
    parts.push(
      en
        ? `You slept about ${sleep.toFixed(1)} hours a night.`
        : `Hai dormito circa ${sleep.toFixed(1)} ore a notte.`
    )
  }

  if (mood != null && mood >= 3.5) {
    parts.push(en ? 'Mood held up well.' : "L'umore ha retto bene.")
  }

  parts.push(
    en
      ? 'Keeping the diary this consistently is real effort — it is what makes these patterns visible at all.'
      : 'Tenere il diario con questa costanza è un impegno vero: è ciò che rende visibili questi andamenti.'
  )

  return { headline, summary: parts.join(' ') }
}
```

### `src/api/changeBus.js`

```jsx
/**
 * Minimal pub/sub used to push realtime updates into pages that load their data
 * in an effect. Supabase reports a row change on any of the user's tables, and
 * every subscribed page re-runs its own load().
 *
 * This is deliberately small. The tidier long-term answer is to move the entity
 * reads onto React Query and invalidate its cache here instead — see AUDIT.md §5.2.
 */
const listeners = new Set()

export function onDataChange(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function emitDataChange(table) {
  listeners.forEach((listener) => {
    try {
      listener(table)
    } catch (err) {
      console.error('Data change listener failed', err)
    }
  })
}
```

---

## Lib

### `src/lib/AuthContext.jsx`

```jsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from '@/api/supabaseClient'
import { subscribeToChanges } from '@/api/supabaseData'
import { db } from '@/api/client'

const AuthContext = createContext({
  user: null,
  profile: null,
  isLoading: true,
  requiresAuth: false,
  refreshProfile: () => {},
})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // A promise chain rather than async/await: nothing here runs synchronously, so
  // an effect can call it without kicking off a cascading render.
  const refreshProfile = useCallback(
    () =>
      db.auth
        .me()
        .then(setProfile)
        .catch(() => setProfile(null)),
    []
  )

  useEffect(() => {
    // With no project configured the app runs against the device-local store,
    // where there is a single implicit user and nothing to sign in to.
    if (!isSupabaseConfigured) {
      db.auth
        .me()
        .then(setProfile)
        .catch(() => {})
        .finally(() => setIsLoading(false))
      return
    }

    let cancelled = false

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setUser(data.session?.user ?? null)
      setIsLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      // Drop the cached profile the moment the session ends, so a signed-out
      // device cannot briefly show the previous patient's name.
      if (!session) setProfile(null)
      setIsLoading(false)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  // Load the profile, and keep every signed-in device in step, for as long as
  // this user is signed in.
  useEffect(() => {
    if (!isSupabaseConfigured || !user) return
    refreshProfile()
    return subscribeToChanges(user.id)
  }, [user, refreshProfile])

  const value = useMemo(
    () => ({
      user,
      profile,
      isLoading,
      requiresAuth: isSupabaseConfigured,
      isAuthenticated: isSupabaseConfigured ? Boolean(user) : true,
      refreshProfile,
    }),
    [user, profile, isLoading, refreshProfile]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// The provider and its hook belong together; Fast Refresh's one-export-per-file
// rule does not apply to a context module.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
```

### `src/lib/LanguageContext.jsx`

```jsx
import { createContext, useContext, useEffect, useState } from 'react'

const LanguageContext = createContext({ lang: 'it', toggleLang: () => {} })

const STORAGE_KEY = 'traccia_lang'

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'it'
    } catch {
      return 'it'
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      /* storage unavailable — language simply won't persist */
    }
    document.documentElement.lang = lang
  }, [lang])

  const toggleLang = () => setLang((l) => (l === 'it' ? 'en' : 'it'))

  return (
    <LanguageContext.Provider value={{ lang, toggleLang }}>{children}</LanguageContext.Provider>
  )
}

// The provider and its hook belong together; Fast Refresh's one-export-per-file
// rule does not apply to a context module.
// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() {
  return useContext(LanguageContext)
}
```

### `src/lib/authErrors.js`

```jsx
import { t } from './translations'

/**
 * Turns a Supabase auth error into something a patient can act on.
 *
 * Deliberately vague on sign-in: "incorrect email or password" rather than
 * saying which, so the form cannot be used to discover whether a given person
 * has a Traccia account.
 */
export function authErrorMessage(error, lang) {
  const raw = String(error?.message || error || '').toLowerCase()

  if (raw.includes('invalid login credentials')) return t('auth_err_invalid', lang)
  if (raw.includes('email not confirmed')) return t('auth_err_not_confirmed', lang)
  if (raw.includes('already registered') || raw.includes('already been registered')) {
    return t('auth_err_email_taken', lang)
  }
  if (raw.includes('rate limit') || raw.includes('too many')) return t('auth_err_rate_limit', lang)
  if (raw.includes('password should be at least')) return t('auth_err_password_short', lang)

  return t('auth_err_generic', lang)
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const MIN_PASSWORD_LENGTH = 8
```

### `src/lib/dateUtils.js`

```jsx
const MONTHS = {
  it: [
    'gennaio',
    'febbraio',
    'marzo',
    'aprile',
    'maggio',
    'giugno',
    'luglio',
    'agosto',
    'settembre',
    'ottobre',
    'novembre',
    'dicembre',
  ],
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
}

const WEEKDAYS = {
  it: ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
}

/** "lunedì 8 settembre 2025" / "Monday, September 8 2025" */
export function formatLongDate(date, lang = 'it') {
  const d = typeof date === 'string' ? new Date(date) : date
  const weekday = WEEKDAYS[lang][d.getDay()]
  const day = d.getDate()
  const month = MONTHS[lang][d.getMonth()]
  const year = d.getFullYear()
  return lang === 'en'
    ? `${weekday}, ${month} ${day} ${year}`
    : `${weekday} ${day} ${month} ${year}`
}

/** "8 settembre 2025" / "September 8, 2025" */
export function formatShortDate(date, lang = 'it') {
  const d = typeof date === 'string' ? new Date(date) : date
  return lang === 'en'
    ? `${MONTHS[lang][d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
    : `${d.getDate()} ${MONTHS[lang][d.getMonth()]} ${d.getFullYear()}`
}

/** "08/09/2025" — falls back to a localized "not specified" label. */
export function formatDateInput(iso, lang = 'it') {
  if (!iso) return lang === 'en' ? 'Date not specified' : 'Data non specificata'
  const d = new Date(iso)
  const dd = d.getDate().toString().padStart(2, '0')
  const mm = (d.getMonth() + 1).toString().padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

/** Today in local time as YYYY-MM-DD. */
export function todayISO() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0]
}

/** YYYY-MM-DD, `days` before `iso`. */
export function subtractDays(iso, days) {
  const d = new Date(iso)
  d.setDate(d.getDate() - days)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]
}

/** Whole days between today and `iso` (negative in the past). */
export function daysUntil(iso) {
  const target = new Date(iso)
  target.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target - today) / 86400000)
}

export function getGreeting(lang = 'it') {
  const h = new Date().getHours()
  if (lang === 'en') return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  return h < 12 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera'
}

export function getPeriodDays(period) {
  switch (period) {
    case '7g':
      return 7
    case '14g':
      return 14
    case '30g':
      return 30
    case '90g':
      return 90
    default:
      return 7
  }
}

export function getPeriodLabel(period, lang = 'it') {
  const labels = {
    it: {
      '7g': 'Ultimi 7 giorni',
      '14g': 'Ultime 2 settimane',
      '30g': 'Ultimo mese',
      '90g': 'Ultimi 3 mesi',
    },
    en: {
      '7g': 'Last 7 days',
      '14g': 'Last 2 weeks',
      '30g': 'Last month',
      '90g': 'Last 3 months',
    },
  }
  return (labels[lang] || labels.it)[period] || (labels[lang] || labels.it)['7g']
}

/**
 * Consecutive days with a diary entry, counting back from today.
 * A missing entry for *today* is tolerated (the day is not over yet).
 */
export function computeStreak(entries) {
  const dates = new Set(entries.map((e) => e.entry_date))
  let cursor = todayISO()
  if (!dates.has(cursor)) {
    cursor = subtractDays(cursor, 1)
    if (!dates.has(cursor)) return 0
  }
  let streak = 0
  while (dates.has(cursor)) {
    streak++
    cursor = subtractDays(cursor, 1)
  }
  return streak
}
```

### `src/lib/printReport.js`

```jsx
import { formatShortDate } from './dateUtils'
import { getCondition, getSpecialists } from './conditions'

/** The report shows the specialist's localized name, not the raw enum key. */
function specialistLabel(key, lang) {
  return getSpecialists(lang)[key] || key
}

/**
 * Escapes everything that reaches the report from user input. Diary notes,
 * medication names and free-text module answers are typed by the user and are
 * interpolated straight into this HTML document, so they must never be able to
 * close a tag or open a <script>.
 */
function esc(value) {
  if (value == null) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Builds the printable report handed to the doctor. Self-contained HTML — it is
 * opened in a new window and printed, so it carries its own styles.
 */
export function buildReportHtml(entries, appointments, therapies, from, to, lang = 'it') {
  const en = lang === 'en'
  const noneLabel = en ? 'None of these' : 'Nessuno di questi'

  const entryRows = entries
    .map((entry) => {
      const condition = getCondition(entry.module, lang)
      const flag = entry.alarm_symptoms?.some((s) => s !== noneLabel) ? ' ⚠️' : ''
      const moduleLabel = condition ? `${condition.emoji} ${condition.label}` : 'Base'

      let detail = ''
      if (condition && entry.module_data) {
        const rows = condition.fields
          .filter((f) => {
            const v = entry.module_data[f.key]
            return v != null && v !== '' && !(Array.isArray(v) && v.length === 0)
          })
          .map((f) => {
            const v = entry.module_data[f.key]
            return `<tr><td style="color:#6B7C76">${esc(f.label)}</td><td>${esc(
              Array.isArray(v) ? v.join(', ') : v
            )}</td></tr>`
          })
          .join('')
        if (rows) {
          detail = `<table style="margin-top:4px;font-size:11px;width:100%">${rows}</table>`
        }
      }

      const medication =
        entry.medication_taken === 'yes'
          ? en
            ? 'Yes'
            : 'Sì'
          : entry.medication_taken === 'later'
            ? en
              ? 'Later'
              : 'Più tardi'
            : entry.medication_taken === 'no'
              ? 'No'
              : '—'

      return `<tr>
      <td>${esc(formatShortDate(entry.entry_date, lang))}</td>
      <td>${esc(moduleLabel)}</td>
      <td>${esc(entry.pain ?? '—')}</td>
      <td>${esc(entry.energy ?? '—')}</td>
      <td>${esc(entry.sleep_hours ?? '—')}</td>
      <td>${esc(entry.mood ?? '—')}${flag}</td>
      <td>${esc(medication)}</td>
      <td>${esc(entry.notes || '')}</td>
    </tr>${detail ? `<tr><td colspan="8">${detail}</td></tr>` : ''}`
    })
    .join('')

  const therapyRows = therapies
    .map(
      (th) =>
        `<tr><td>${esc(th.name)}</td><td>${esc(th.dosage || '—')}</td><td>${esc(th.time || '—')}</td><td>${
          th.frequency === 'ogni_giorno'
            ? en
              ? 'Every day'
              : 'Ogni giorno'
            : th.frequency === 'settimanale'
              ? en
                ? 'Weekly'
                : 'Settimanale'
              : en
                ? 'As needed'
                : 'Al bisogno'
        }</td></tr>`
    )
    .join('')

  const appointmentRows = appointments
    .map(
      (a) =>
        `<tr><td>${esc(specialistLabel(a.specialist, lang))}</td><td>${esc(
          formatShortDate(a.appointment_date, lang)
        )}</td></tr>`
    )
    .join('')

  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"><title>${
    en ? 'Traccia Report' : 'Report Traccia'
  }</title>
  <style>
    body { font-family: 'Inter', system-ui, sans-serif; color: #1A2F2A; max-width: 800px; margin: 0 auto; padding: 32px; }
    h1 { font-family: Georgia, serif; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0; }
    th, td { border: 1px solid #EBEEEC; padding: 6px 8px; text-align: left; font-size: 12px; }
    th { background: #F4F7F5; font-weight: 600; }
    .disclaimer { font-size: 11px; color: #7A8B85; margin-top: 24px; border-top: 1px solid #EBEEEC; padding-top: 12px; }
    .header { margin-bottom: 24px; }
  </style></head><body>
  <div class="header">
    <h1>🌿 ${en ? 'Symptom Diary Report — Traccia' : 'Report Diario Sintomi — Traccia'}</h1>
    <p style="color:#7A8B85">${en ? 'Period' : 'Periodo'}: ${formatShortDate(
      from,
      lang
    )} — ${formatShortDate(to, lang)}</p>
  </div>
  <h3>${en ? 'Current therapies' : 'Terapie in corso'}</h3>
  ${
    therapyRows
      ? `<table><tr><th>${en ? 'Medication' : 'Farmaco'}</th><th>${
          en ? 'Dosage' : 'Dosaggio'
        }</th><th>${en ? 'Time' : 'Orario'}</th><th>${
          en ? 'Frequency' : 'Frequenza'
        }</th></tr>${therapyRows}</table>`
      : `<p>${en ? 'No therapy recorded.' : 'Nessuna terapia registrata.'}</p>`
  }
  <h3>${en ? 'Upcoming scheduled check-ups' : 'Prossimi controlli programmati'}</h3>
  ${
    appointmentRows
      ? `<table><tr><th>${en ? 'Specialist' : 'Specialista'}</th><th>${
          en ? 'Date' : 'Data'
        }</th></tr>${appointmentRows}</table>`
      : `<p>${en ? 'No check-up scheduled.' : 'Nessun controllo programmato.'}</p>`
  }
  <h3>${en ? 'Day-by-day log' : 'Registro giorno per giorno'}</h3>
  <table>
    <tr><th>${en ? 'Date' : 'Data'}</th><th>${en ? 'Module' : 'Modulo'}</th><th>${
      en ? 'Pain' : 'Dolore'
    }</th><th>${en ? 'Energy' : 'Energia'}</th><th>${en ? 'Sleep' : 'Sonno'}</th><th>${
      en ? 'Mood' : 'Umore'
    }</th><th>${en ? 'Medication' : 'Farmaci'}</th><th>${en ? 'Notes' : 'Note'}</th></tr>
    ${entryRows || `<tr><td colspan="8">${en ? 'No entries.' : 'Nessuna registrazione.'}</td></tr>`}
  </table>
  <div class="disclaimer">
    ${
      en
        ? 'This document is a patient self-record generated by the Traccia app. It is not a medical report. The data reported is entered by the user and does not replace the clinical assessment of the treating doctor.'
        : "Questo documento è un'autoregistrazione del paziente generata dall'app Traccia. Non è un referto medico. I dati riportati sono inseriti dall'utente e non sostituiscono la valutazione clinica del medico curante."
    }
  </div>
  </body></html>`
}
```

### `src/lib/issUrls.js`

```jsx
// Deep links to ISSalute (Istituto Superiore di Sanità) — public, non-diagnostic
// reference pages. Conditions with more than one relevant page map card index → URL.
const ISS_URLS = {
  endometriosi: 'https://www.issalute.it/index.php/la-salute-dalla-a-alla-z-menu/e/endometriosi',
  ibd: {
    0: 'https://www.issalute.it/index.php/la-salute-dalla-a-alla-z-menu/m/mici-malattie-infiammatorie-croniche-dell-intestino',
    1: 'https://www.issalute.it/index.php/la-salute-dalla-a-alla-z-menu/m/malattia-di-crohn',
  },
  emicrania: 'https://www.issalute.it/index.php/la-salute-dalla-a-alla-z-menu/e/emicrania',
  diabete: 'https://www.issalute.it/index.php/la-salute-dalla-a-alla-z-menu/d/diabete-di-tipo-2',
  pcos: 'https://www.issalute.it/index.php/la-salute-dalla-a-alla-z-menu/o/ovaio-policistico',
  ipertiroidismo:
    'https://www.issalute.it/index.php/la-salute-dalla-a-alla-z-menu/i/ipertiroidismo',
  ipotiroidismo: 'https://www.issalute.it/index.php/la-salute-dalla-a-alla-z-menu/i/ipotiroidismo',
  fibromialgia: 'https://www.issalute.it/index.php/la-salute-dalla-a-alla-z-menu/f/fibromialgia',
  artrite_reumatoide:
    'https://www.issalute.it/index.php/la-salute-dalla-a-alla-z-menu/a/artrite-reumatoide',
}

export function getIssUrl(conditionKey, cardIndex = 0) {
  const entry = ISS_URLS[conditionKey]
  if (!entry) return null
  return typeof entry === 'string' ? entry : entry[cardIndex] || entry[0]
}
```

### `src/lib/useChartTheme.js`

```jsx
import { useTheme } from 'next-themes'

/**
 * Recharts draws into SVG with literal color props, so it cannot inherit the
 * theme tokens from CSS. This resolves the grid/axis/tooltip colors for the
 * active theme in one place.
 */
export function useChartTheme() {
  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme === 'dark'

  return {
    dark,
    grid: dark ? 'rgba(255,255,255,0.08)' : '#EEF1F0',
    tick: dark ? '#8FA09A' : '#7A8B85',
    tooltip: {
      borderRadius: 12,
      border: `1px solid ${dark ? 'rgba(255,255,255,0.10)' : '#EBEEEC'}`,
      backgroundColor: dark ? '#16221E' : '#FFFFFF',
      color: dark ? '#E8F1ED' : '#1A2F2A',
      fontSize: 12,
      boxShadow: dark ? '0 8px 24px -6px rgba(0,0,0,0.6)' : '0 8px 24px -6px rgba(16,24,22,0.1)',
    },
    dotStroke: dark ? '#16221E' : '#FFFFFF',
  }
}
```

### `src/lib/useDataSync.js`

```jsx
import { useEffect } from 'react'
import { onDataChange } from '@/api/changeBus'

/**
 * Re-runs a page's own loader whenever the data changes — either locally, or on
 * another device, via the realtime subscription opened by AuthProvider.
 *
 * `reload` is called on the leading edge and then at most every 400ms, so a bulk
 * write does not trigger a burst of fetches.
 */
export function useDataSync(reload) {
  useEffect(() => {
    let timer = null
    return onDataChange(() => {
      if (timer) return
      timer = setTimeout(() => {
        timer = null
      }, 400)
      reload()
    })
  }, [reload])
}
```

### `src/lib/query-client.js`

```jsx
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
})
```

---

## Auth screens

### `src/pages/auth/Login.jsx`

```jsx
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { db } from '@/api/client'
import { useAuth } from '@/lib/AuthContext'
import { useLanguage } from '@/lib/LanguageContext'
import { t } from '@/lib/translations'
import { authErrorMessage, EMAIL_PATTERN } from '@/lib/authErrors'
import AuthLayout from '@/components/auth/AuthLayout'
import FormError from '@/components/auth/FormError'
import PasswordField from '@/components/auth/PasswordField'

export default function Login() {
  const { lang } = useLanguage()
  const { isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!isLoading && isAuthenticated) {
    return <Navigate to={location.state?.from || '/'} replace />
  }

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return

    if (!EMAIL_PATTERN.test(email.trim())) {
      setError(t(email.trim() ? 'auth_err_email_invalid' : 'auth_err_email_required', lang))
      return
    }

    setBusy(true)
    setError('')
    try {
      await db.auth.signIn(email.trim(), password)
      navigate(location.state?.from || '/', { replace: true })
    } catch (err) {
      setError(authErrorMessage(err, lang))
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title={t('auth_login_title', lang)}
      subtitle={t('auth_login_subtitle', lang)}
      footer={
        <>
          {t('auth_no_account', lang)}{' '}
          <Link to="/register" className="text-brand-dark font-500 hover:text-brand">
            {t('auth_sign_up', lang)}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <label htmlFor="email" className="text-[13px] font-500 text-ink/70 block mb-1.5">
          {t('auth_email', lang)}
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('auth_email_placeholder', lang)}
          autoComplete="email"
          autoFocus
          className="input-float mb-4"
        />

        <label htmlFor="password" className="text-[13px] font-500 text-ink/70 block mb-1.5">
          {t('auth_password', lang)}
        </label>
        <PasswordField
          id="password"
          value={password}
          onChange={setPassword}
          placeholder={t('auth_password_placeholder', lang)}
          autoComplete="current-password"
        />

        <FormError message={error} />

        <button type="submit" disabled={busy} className="btn-primary w-full mt-5">
          {busy ? (
            <span className="spinner !w-4 !h-4 !border-2 !border-white/40 !border-t-white" />
          ) : (
            <>
              {t('auth_sign_in', lang)} <ArrowRight className="w-4 h-4" strokeWidth={2.4} />
            </>
          )}
        </button>

        <div className="text-center mt-4">
          <Link to="/forgot-password" className="btn-link">
            {t('auth_forgot', lang)}
          </Link>
        </div>
      </form>
    </AuthLayout>
  )
}
```

### `src/pages/auth/Register.jsx`

```jsx
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, MailCheck } from 'lucide-react'
import { db } from '@/api/client'
import { useAuth } from '@/lib/AuthContext'
import { useLanguage } from '@/lib/LanguageContext'
import { t } from '@/lib/translations'
import { authErrorMessage, EMAIL_PATTERN, MIN_PASSWORD_LENGTH } from '@/lib/authErrors'
import AuthLayout from '@/components/auth/AuthLayout'
import FormError from '@/components/auth/FormError'
import PasswordField from '@/components/auth/PasswordField'

/** Every word capitalised — the saved display name is always presented this way. */
function capitalizeName(value) {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export default function Register() {
  const { lang } = useLanguage()
  const { isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)

  if (!isLoading && isAuthenticated) return <Navigate to="/" replace />

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return

    if (!name.trim()) return setError(t('auth_err_name_required', lang))
    if (!EMAIL_PATTERN.test(email.trim())) {
      return setError(t(email.trim() ? 'auth_err_email_invalid' : 'auth_err_email_required', lang))
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return setError(t('auth_err_password_short', lang))
    }

    setBusy(true)
    setError('')
    try {
      const result = await db.auth.signUp(email.trim(), password, capitalizeName(name))
      // With email confirmation on, there is no session yet — tell the user to
      // go and open the link rather than dropping them on a login screen.
      if (result?.session) navigate('/', { replace: true })
      else setCheckEmail(true)
    } catch (err) {
      setError(authErrorMessage(err, lang))
    } finally {
      setBusy(false)
    }
  }

  if (checkEmail) {
    return (
      <AuthLayout
        title={t('auth_check_email_title', lang)}
        subtitle={t('auth_check_email_body', lang)}
        footer={
          <Link to="/login" className="text-brand-dark font-500 hover:text-brand">
            {t('auth_back_to_login', lang)}
          </Link>
        }
      >
        <div className="flex items-center justify-center py-2">
          <MailCheck className="w-10 h-10 text-brand" strokeWidth={1.6} />
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={t('auth_register_title', lang)}
      subtitle={t('auth_register_subtitle', lang)}
      footer={
        <>
          {t('auth_has_account', lang)}{' '}
          <Link to="/login" className="text-brand-dark font-500 hover:text-brand">
            {t('auth_sign_in', lang)}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <label htmlFor="name" className="text-[13px] font-500 text-ink/70 block mb-1.5">
          {t('auth_name', lang)}
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('auth_name_placeholder', lang)}
          autoComplete="given-name"
          autoFocus
          className="input-float mb-4"
        />

        <label htmlFor="email" className="text-[13px] font-500 text-ink/70 block mb-1.5">
          {t('auth_email', lang)}
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('auth_email_placeholder', lang)}
          autoComplete="email"
          className="input-float mb-4"
        />

        <label htmlFor="password" className="text-[13px] font-500 text-ink/70 block mb-1.5">
          {t('auth_password', lang)}
        </label>
        <PasswordField
          id="password"
          value={password}
          onChange={setPassword}
          placeholder={t('auth_password_placeholder', lang)}
          autoComplete="new-password"
        />
        <p className="text-[11.5px] text-ink/40 mt-1.5">
          {lang === 'en'
            ? `At least ${MIN_PASSWORD_LENGTH} characters.`
            : `Almeno ${MIN_PASSWORD_LENGTH} caratteri.`}
        </p>

        <FormError message={error} />

        <button type="submit" disabled={busy} className="btn-primary w-full mt-5">
          {busy ? (
            <span className="spinner !w-4 !h-4 !border-2 !border-white/40 !border-t-white" />
          ) : (
            <>
              {t('auth_sign_up', lang)} <ArrowRight className="w-4 h-4" strokeWidth={2.4} />
            </>
          )}
        </button>
      </form>
    </AuthLayout>
  )
}
```

### `src/pages/auth/ForgotPassword.jsx`

```jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { db } from '@/api/client'
import { useLanguage } from '@/lib/LanguageContext'
import { t } from '@/lib/translations'
import { authErrorMessage, EMAIL_PATTERN } from '@/lib/authErrors'
import AuthLayout from '@/components/auth/AuthLayout'
import FormError from '@/components/auth/FormError'

export default function ForgotPassword() {
  const { lang } = useLanguage()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    if (!EMAIL_PATTERN.test(email.trim())) {
      return setError(t(email.trim() ? 'auth_err_email_invalid' : 'auth_err_email_required', lang))
    }

    setBusy(true)
    setError('')
    try {
      await db.auth.requestPasswordReset(email.trim())
    } catch (err) {
      // Rate limiting is worth surfacing; anything else stays quiet, so this
      // form cannot be used to find out who has an account.
      const message = authErrorMessage(err, lang)
      if (message === t('auth_err_rate_limit', lang)) {
        setError(message)
        setBusy(false)
        return
      }
      console.error(err)
    }
    setSent(true)
    setBusy(false)
  }

  return (
    <AuthLayout
      title={t('auth_forgot_title', lang)}
      subtitle={sent ? t('auth_forgot_sent', lang) : t('auth_forgot_subtitle', lang)}
      footer={
        <Link to="/login" className="text-brand-dark font-500 hover:text-brand">
          {t('auth_back_to_login', lang)}
        </Link>
      }
    >
      {sent ? (
        <div className="flex items-center justify-center py-2">
          <MailCheck className="w-10 h-10 text-brand" strokeWidth={1.6} />
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <label htmlFor="email" className="text-[13px] font-500 text-ink/70 block mb-1.5">
            {t('auth_email', lang)}
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('auth_email_placeholder', lang)}
            autoComplete="email"
            autoFocus
            className="input-float"
          />

          <FormError message={error} />

          <button type="submit" disabled={busy} className="btn-primary w-full mt-5">
            {busy ? (
              <span className="spinner !w-4 !h-4 !border-2 !border-white/40 !border-t-white" />
            ) : (
              t('auth_forgot_cta', lang)
            )}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}
```

### `src/pages/auth/ResetPassword.jsx`

```jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { db } from '@/api/client'
import { useLanguage } from '@/lib/LanguageContext'
import { t } from '@/lib/translations'
import { authErrorMessage, MIN_PASSWORD_LENGTH } from '@/lib/authErrors'
import AuthLayout from '@/components/auth/AuthLayout'
import FormError from '@/components/auth/FormError'
import PasswordField from '@/components/auth/PasswordField'

/**
 * Reached from the emailed reset link. Supabase turns the link into a recovery
 * session on load (detectSessionInUrl), so the new password can simply be set.
 */
export default function ResetPassword() {
  const { lang } = useLanguage()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    if (password.length < MIN_PASSWORD_LENGTH) {
      return setError(t('auth_err_password_short', lang))
    }
    if (password !== confirm) return setError(t('auth_err_password_mismatch', lang))

    setBusy(true)
    setError('')
    try {
      await db.auth.updatePassword(password)
      setDone(true)
      setTimeout(() => navigate('/', { replace: true }), 1600)
    } catch (err) {
      setError(authErrorMessage(err, lang))
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title={t('auth_reset_title', lang)}
      subtitle={done ? t('auth_reset_done', lang) : t('auth_reset_subtitle', lang)}
      footer={
        <Link to="/login" className="text-brand-dark font-500 hover:text-brand">
          {t('auth_back_to_login', lang)}
        </Link>
      }
    >
      {done ? (
        <div className="flex items-center justify-center py-2">
          <Check className="w-10 h-10 text-brand" strokeWidth={2} />
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <label htmlFor="password" className="text-[13px] font-500 text-ink/70 block mb-1.5">
            {t('auth_password_new', lang)}
          </label>
          <PasswordField
            id="password"
            value={password}
            onChange={setPassword}
            placeholder={t('auth_password_placeholder', lang)}
            autoComplete="new-password"
          />

          <label htmlFor="confirm" className="text-[13px] font-500 text-ink/70 block mb-1.5 mt-4">
            {t('auth_password_confirm', lang)}
          </label>
          <PasswordField
            id="confirm"
            value={confirm}
            onChange={setConfirm}
            placeholder={t('auth_password_placeholder', lang)}
            autoComplete="new-password"
          />

          <FormError message={error} />

          <button type="submit" disabled={busy} className="btn-primary w-full mt-5">
            {busy ? (
              <span className="spinner !w-4 !h-4 !border-2 !border-white/40 !border-t-white" />
            ) : (
              t('auth_reset_cta', lang)
            )}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}
```

### `src/components/auth/AuthLayout.jsx`

```jsx
import { motion } from 'framer-motion'
import { Leaf } from 'lucide-react'
import { useLanguage } from '@/lib/LanguageContext'
import { t } from '@/lib/translations'
import ThemeToggle from '@/components/ThemeToggle'

/**
 * The shell every auth screen sits in — the same card, gradient and typography
 * as the rest of the app, so signing in feels like part of Traccia rather than
 * a bolted-on gate.
 */
export default function AuthLayout({ title, subtitle, children, footer }) {
  const { lang, toggleLang } = useLanguage()

  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-6 px-1">
          <div className="flex items-center gap-2">
            <span className="text-[22px] leading-none">🌿</span>
            <span className="font-display text-[20px] font-600 tracking-tight text-ink">
              Traccia
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={toggleLang}
              aria-label={lang === 'it' ? 'Switch to English' : 'Passa all’italiano'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-line bg-background text-xs font-500 text-ink-soft hover:border-brand/40 transition-colors"
            >
              <span className="text-[13px] leading-none">{lang === 'it' ? '🇮🇹' : '🇬🇧'}</span>
              <span className="text-ink-soft">{lang.toUpperCase()}</span>
            </button>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="card-float-lg p-7 sm:p-8 relative overflow-hidden"
        >
          <div className="pointer-events-none absolute inset-0 modal-sheen" />

          <div className="relative">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-soft mx-auto mb-5">
              <Leaf className="w-7 h-7 text-brand" strokeWidth={2.2} />
            </div>

            <h1 className="font-display text-[24px] font-600 text-ink text-center mb-2">{title}</h1>
            <p className="text-ink/55 text-sm text-center mb-6 leading-relaxed">{subtitle}</p>

            {children}
          </div>
        </motion.div>

        {footer && <div className="text-center mt-5 text-[13px] text-ink-soft">{footer}</div>}

        <p className="text-[11.5px] text-ink/40 text-center mt-6 leading-relaxed px-4">
          {t('auth_privacy_note', lang)}
        </p>
      </div>
    </div>
  )
}
```

### `src/components/auth/FormError.jsx`

```jsx
import { AlertTriangle } from 'lucide-react'

export default function FormError({ message }) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="mt-3 rounded-2xl p-3.5 flex items-start gap-2.5 warn-soft"
      style={{ border: '1px solid #C56B6B30' }}
    >
      <AlertTriangle className="w-[17px] h-[17px] text-[#C56B6B] shrink-0 mt-0.5" strokeWidth={2} />
      <p className="text-[12.5px] text-[#8A3A45] leading-relaxed font-500">{message}</p>
    </div>
  )
}
```

### `src/components/auth/PasswordField.jsx`

```jsx
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useLanguage } from '@/lib/LanguageContext'

export default function PasswordField({ value, onChange, placeholder, autoComplete, id }) {
  const { lang } = useLanguage()
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="input-float !pr-12"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={
          visible
            ? lang === 'en'
              ? 'Hide password'
              : 'Nascondi la password'
            : lang === 'en'
              ? 'Show password'
              : 'Mostra la password'
        }
        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/35 hover:text-ink/60 transition-colors p-1"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )
}
```

---

## Shell components

### `src/components/Layout.jsx`

```jsx
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import DisclaimerBanner from './DisclaimerBanner'
import LocalModeBanner from './LocalModeBanner'
import { useLanguage } from '@/lib/LanguageContext'

export default function Layout() {
  const { lang } = useLanguage()

  return (
    <div className="min-h-screen bg-canvas">
      <a href="#contenuto" className="skip-link no-print">
        {lang === 'en' ? 'Skip to content' : 'Vai al contenuto'}
      </a>
      <Navbar />
      <LocalModeBanner />
      <DisclaimerBanner />
      <main id="contenuto" className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <Outlet />
      </main>
    </div>
  )
}
```

### `src/components/Navbar.jsx`

```jsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  BookOpen,
  Stethoscope,
  FileText,
  TrendingUp,
  CalendarCheck,
  Pill,
  Sparkles,
  LifeBuoy,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { db, isCloudBacked } from '@/api/client'
import { useLanguage } from '@/lib/LanguageContext'
import { t } from '@/lib/translations'
import ThemeToggle from '@/components/ThemeToggle'

export default function Navbar() {
  const { pathname } = useLocation()
  const { lang, toggleLang } = useLanguage()
  const [userName, setUserName] = useState(null)

  const navRef = useRef(null)
  const activeTabRef = useRef(null)
  const [edges, setEdges] = useState({ overflows: false, atStart: true, atEnd: true })
  const { overflows, atStart, atEnd } = edges

  /** Whether the tab strip overflows, and which ends still have content past them. */
  const measureEdges = useCallback(() => {
    const el = navRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setEdges({
      overflows: max > 1,
      atStart: el.scrollLeft <= 1,
      atEnd: el.scrollLeft >= max - 1,
    })
  }, [])

  useEffect(() => {
    const el = navRef.current
    if (!el) return

    // Measured after paint, never synchronously in the effect body: layout has
    // to have happened for scrollWidth to mean anything.
    const raf = requestAnimationFrame(measureEdges)

    el.addEventListener('scroll', measureEdges, { passive: true })
    const observer = new ResizeObserver(measureEdges)
    observer.observe(el)

    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('scroll', measureEdges)
      observer.disconnect()
    }
  }, [measureEdges])

  const scrollTabs = (direction) => {
    const el = navRef.current
    if (!el) return

    const step = direction * Math.max(el.clientWidth * 0.7, 160)
    const max = el.scrollWidth - el.clientWidth
    const target = Math.max(0, Math.min(el.scrollLeft + step, max))
    const start = el.scrollLeft

    el.scrollTo({ left: target, behavior: 'smooth' })

    // Smooth scrolling is animation-driven, and there are environments where
    // that animation never runs — which would leave the arrow silently doing
    // nothing. If the strip has not budged at all shortly after, jump there
    // instead. An animation that *is* running is left alone to finish.
    window.setTimeout(() => {
      if (el.scrollLeft === start && start !== target) {
        el.scrollTo({ left: target, behavior: 'instant' })
      }
    }, 250)
  }

  // Keep the current section visible — otherwise navigating to a tab that is
  // off-screen leaves the user with no indication of where they are.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      activeTabRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    })
    return () => cancelAnimationFrame(raf)
  }, [pathname])

  useEffect(() => {
    db.auth
      .me()
      .then((u) => setUserName(u.display_name || u.full_name || null))
      .catch(() => {})
  }, [])

  const handleLogout = () => db.auth.logout(isCloudBacked ? '/login' : '/')

  const tabs = [
    { label: t('nav_diary', lang), path: '/', icon: BookOpen },
    { label: t('nav_pathologies', lang), path: '/patologie', icon: Stethoscope },
    { label: t('nav_documents', lang), path: '/referti', icon: FileText },
    { label: t('nav_trends', lang), path: '/andamento', icon: TrendingUp },
    { label: t('nav_appointments', lang), path: '/controlli', icon: CalendarCheck },
    { label: t('nav_therapies', lang), path: '/terapie', icon: Pill },
    { label: t('nav_contents', lang), path: '/contenuti', icon: Sparkles },
    { label: lang === 'en' ? 'Guide' : 'Guida', path: '/docs', icon: LifeBuoy },
  ]

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-line no-print">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 shrink-0 group">
            <span className="text-[22px] leading-none transition-transform group-hover:scale-105">
              🌿
            </span>
            <span className="font-display text-[20px] font-600 tracking-tight text-ink">
              Traccia
            </span>
          </Link>

          <div className="flex items-center gap-2 shrink-0">
            {userName && (
              <span className="text-[13px] text-ink-soft hidden sm:inline max-w-[120px] truncate">
                {userName}
              </span>
            )}

            {/* Without accounts there is nothing to log out of — the button would
                only reset the local name, which is not what it says it does. */}
            {isCloudBacked && userName && (
              <button onClick={handleLogout} className="btn-ghost !py-1.5 !px-3 !text-[13px]">
                <LogOut className="w-3.5 h-3.5" strokeWidth={2} />
                <span className="hidden sm:inline">{t('logout', lang)}</span>
              </button>
            )}

            <ThemeToggle />

            <button
              onClick={toggleLang}
              aria-label={lang === 'it' ? 'Switch to English' : 'Passa all\u2019italiano'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-line bg-background text-xs font-500 text-ink-soft hover:border-brand/40 transition-colors"
            >
              <span className="text-[13px] leading-none">{lang === 'it' ? '🇮🇹' : '🇬🇧'}</span>
              <span className="text-ink-soft">{lang.toUpperCase()}</span>
            </button>
          </div>
        </div>

        {/*
          Eight tabs do not fit the 3xl container, so the row scrolls, and the
          scrollbar is hidden — which left no sign that anything was off-screen.
          The arrows sit *beside* the scrolling row rather than on top of it:
          overlaid, they covered the very tab labels they were meant to reveal.
          They only take up space when the row actually overflows.
        */}
        <div className="flex items-center gap-1 pb-2.5">
          {overflows && (
            <ScrollArrow
              direction="left"
              disabled={atStart}
              onClick={() => scrollTabs(-1)}
              label={lang === 'en' ? 'Scroll sections left' : 'Scorri le sezioni a sinistra'}
            />
          )}

          <nav
            ref={navRef}
            aria-label={lang === 'en' ? 'Sections' : 'Sezioni'}
            style={edgeMask(overflows, atStart, atEnd)}
            className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1 min-w-0 scroll-smooth"
          >
            {tabs.map((tab) => {
              const active = pathname === tab.path
              const Icon = tab.icon
              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  ref={active ? activeTabRef : undefined}
                  aria-current={active ? 'page' : undefined}
                  className={`nav-tab shrink-0 ${active ? 'active' : ''}`}
                >
                  <Icon className="w-[15px] h-[15px]" strokeWidth={2} />
                  {tab.label}
                </Link>
              )
            })}
          </nav>

          {overflows && (
            <ScrollArrow
              direction="right"
              disabled={atEnd}
              onClick={() => scrollTabs(1)}
              label={lang === 'en' ? 'Scroll sections right' : 'Scorri le sezioni a destra'}
            />
          )}
        </div>
      </div>
    </header>
  )
}

/**
 * Softens whichever edge is actually clipped, so the last tab fades out instead
 * of being chopped mid-word. Purely cosmetic — it masks the row's own edge and
 * never covers a control.
 */
function edgeMask(overflows, atStart, atEnd) {
  if (!overflows) return undefined

  const left = atStart ? 'black 0' : 'transparent 0, black 20px'
  const right = atEnd ? 'black 100%' : 'black calc(100% - 20px), transparent 100%'
  const gradient = `linear-gradient(to right, ${left}, ${right})`

  return { maskImage: gradient, WebkitMaskImage: gradient }
}

/**
 * Scrolls the tab strip one screenful. Hidden from assistive technology: the
 * tabs are already reachable by keyboard and listed in the nav landmark, so
 * announcing these would only add noise.
 */
function ScrollArrow({ direction, disabled, onClick, label }) {
  const Chevron = direction === 'left' ? ChevronLeft : ChevronRight

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      tabIndex={-1}
      aria-hidden="true"
      title={label}
      className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full border border-line bg-background text-ink-soft transition-all hover:text-ink hover:border-brand/40 disabled:opacity-25 disabled:pointer-events-none"
    >
      <Chevron className="w-3.5 h-3.5" strokeWidth={2.2} />
    </button>
  )
}
```

### `src/components/ThemeToggle.jsx`

```jsx
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { useLanguage } from '@/lib/LanguageContext'

/**
 * Light/dark switch, shared by the app header and the sign-in screens so the
 * control looks and behaves identically everywhere.
 *
 * Which icon shows is decided in CSS, not in React. next-themes puts the `dark`
 * class on <html> in a blocking script before first paint, so the correct icon
 * is painted immediately — no hydration flag, and no flicker on load.
 */
export default function ThemeToggle({ className = '' }) {
  const { lang } = useLanguage()
  const { resolvedTheme, setTheme } = useTheme()

  const isDark = resolvedTheme === 'dark'

  const label = isDark
    ? lang === 'en'
      ? 'Switch to light theme'
      : 'Passa al tema chiaro'
    : lang === 'en'
      ? 'Switch to dark theme'
      : 'Passa al tema scuro'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={label}
      title={label}
      className={`flex items-center justify-center px-3 py-1.5 rounded-full border border-line bg-background text-xs font-500 text-ink-soft hover:border-brand/40 transition-colors ${className}`}
    >
      <Moon className="w-3.5 h-3.5 dark:hidden" strokeWidth={2} />
      <Sun className="w-3.5 h-3.5 hidden dark:block" strokeWidth={2} />
    </button>
  )
}
```

### `src/components/DisclaimerBanner.jsx`

```jsx
import { Info } from 'lucide-react'
import { useLanguage } from '@/lib/LanguageContext'
import { t } from '@/lib/translations'

export default function DisclaimerBanner() {
  const { lang } = useLanguage()
  return (
    <div className="bg-brand-softer border-b border-line/70 no-print">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-2">
        <div className="flex items-start gap-2">
          <Info className="w-[15px] h-[15px] text-brand-dark shrink-0 mt-0.5" strokeWidth={2} />
          <p className="text-[11.5px] leading-relaxed text-ink/55">{t('disclaimer', lang)}</p>
        </div>
      </div>
    </div>
  )
}
```

### `src/components/LocalModeBanner.jsx`

```jsx
import { CloudOff } from 'lucide-react'
import { isCloudBacked } from '@/api/client'
import { useLanguage } from '@/lib/LanguageContext'
import { t } from '@/lib/translations'

/**
 * Without Supabase credentials the app still runs, but against the device-local
 * store: no account, no sync. That has to be visible — someone must never
 * believe a diary is backed up when it only exists in one browser.
 */
export default function LocalModeBanner() {
  const { lang } = useLanguage()
  if (isCloudBacked) return null

  return (
    <div className="amber-soft border-b border-[#B8863B]/20 no-print">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-2">
        <div className="flex items-start gap-2">
          <CloudOff className="w-[15px] h-[15px] text-[#B8863B] shrink-0 mt-0.5" strokeWidth={2} />
          <p className="text-[11.5px] leading-relaxed text-[#7A5623]">
            <span className="font-600">{t('sync_offline_title', lang)}</span>{' '}
            {t('sync_offline_body', lang)}
          </p>
        </div>
      </div>
    </div>
  )
}
```

### `src/components/ProtectedRoute.jsx`

```jsx
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'

/**
 * Gates the diary behind a session. While the session is being restored it
 * shows a spinner rather than flashing the login screen at someone who is
 * already signed in.
 */
export default function ProtectedRoute({ children }) {
  const { isLoading, isAuthenticated } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="spinner" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}
```

### `src/components/ErrorBoundary.jsx`

```jsx
import { Component } from 'react'

/**
 * Last line of defence: a render error in one page must not leave the user
 * staring at a blank screen in an app they rely on daily.
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
        <div className="card-float-lg p-8 max-w-md w-full text-center">
          <p className="text-[40px] mb-3">🌿</p>
          <h1 className="font-display text-[22px] font-600 text-ink mb-2">
            Qualcosa è andato storto
          </h1>
          <p className="text-[13.5px] text-ink-soft leading-relaxed mb-6">
            I tuoi dati sono al sicuro. Ricarica la pagina per riprendere da dove eri.
            <br />
            <span className="text-ink/45">
              Your data is safe. Reload the page to pick up where you left off.
            </span>
          </p>
          <button onClick={() => window.location.reload()} className="btn-primary">
            Ricarica · Reload
          </button>
        </div>
      </div>
    )
  }
}
```

### `src/components/ScrollToTop.jsx`

```jsx
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}
```

### `src/components/RefBadge.jsx`

```jsx
import { getBadgeStyle } from '@/lib/conditions'

/**
 * Reference-range badge. It only ever shows a public reference range label —
 * never an interpretation of the user's value.
 */
export default function RefBadge({ badge }) {
  if (!badge) return null
  const style = getBadgeStyle(badge.level)
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-600 font-mono-data whitespace-nowrap"
      style={style}
    >
      {badge.label}
    </span>
  )
}
```

### `src/components/PrivacyControls.jsx`

```jsx
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ShieldCheck, Download, Trash2, AlertTriangle } from 'lucide-react'
import { exportAllData, eraseAllData } from '@/api/client'
import { useLanguage } from '@/lib/LanguageContext'
import { toast } from '@/components/ui/toast-bus'

/**
 * The two rights a health diary has to make actionable: access (export) and
 * erasure. Both act on everything this app has stored on the device.
 */
export default function PrivacyControls() {
  const { lang } = useLanguage()
  const en = lang === 'en'
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  const handleExport = async () => {
    try {
      const data = await exportAllData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `traccia-dati-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast({
        title: en ? 'Export ready' : 'Esportazione pronta',
        description: en
          ? 'Your diary, therapies and appointments were downloaded as JSON.'
          : 'Diario, terapie e controlli sono stati scaricati in formato JSON.',
      })
    } catch (err) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: en ? 'Export failed' : 'Esportazione non riuscita',
        description: String(err?.message || err),
      })
    }
  }

  const handleErase = async () => {
    setBusy(true)
    try {
      await eraseAllData()
      window.location.href = '/'
    } catch (err) {
      console.error(err)
      setBusy(false)
      toast({
        variant: 'destructive',
        title: en ? 'Deletion failed' : 'Eliminazione non riuscita',
        description: String(err?.message || err),
      })
    }
  }

  return (
    <section className="card-float p-5 sm:p-6 mb-5">
      <h2 className="font-display text-[18px] font-600 text-ink flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-brand" strokeWidth={2} />
        {en ? 'Your data' : 'I tuoi dati'}
      </h2>
      <p className="text-[13px] text-ink-soft leading-relaxed mt-2 mb-4">
        {en
          ? 'Your diary is stored on this device only. You can take a full copy with you at any time, or delete everything permanently.'
          : 'Il tuo diario è salvato solo su questo dispositivo. Puoi portarne con te una copia completa in qualsiasi momento, oppure eliminare tutto definitivamente.'}
      </p>

      <div className="flex flex-wrap gap-2.5">
        <button onClick={handleExport} className="btn-ghost">
          <Download className="w-4 h-4 text-brand" strokeWidth={2} />
          {en ? 'Export my data (JSON)' : 'Esporta i miei dati (JSON)'}
        </button>
        <button onClick={() => setConfirming(true)} className="btn-ghost !text-[#C56B6B]">
          <Trash2 className="w-4 h-4" strokeWidth={2} />
          {en ? 'Delete everything' : 'Elimina tutto'}
        </button>
      </div>

      <AnimatePresence>
        {confirming && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 rounded-2xl p-4 warn-soft overflow-hidden"
            style={{ border: '1px solid #C56B6B30' }}
          >
            <div className="flex items-start gap-2.5 mb-3">
              <AlertTriangle
                className="w-[18px] h-[18px] text-[#C56B6B] shrink-0 mt-0.5"
                strokeWidth={2}
              />
              <p className="text-[13px] text-[#8A3A45] leading-relaxed font-500">
                {en
                  ? 'This permanently deletes every diary entry, condition, document, appointment and therapy on this device. It cannot be undone — export a copy first if you want to keep one.'
                  : 'Questa azione elimina definitivamente ogni voce di diario, condizione, documento, controllo e terapia su questo dispositivo. Non è reversibile: esporta prima una copia se vuoi conservarla.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleErase}
                disabled={busy}
                className="btn-primary !bg-none"
                style={{ background: 'linear-gradient(135deg, #C97A7A, #B05858)' }}
              >
                {busy ? (
                  <span className="spinner !w-4 !h-4 !border-2 !border-white/40 !border-t-white" />
                ) : en ? (
                  'Yes, delete everything'
                ) : (
                  'Sì, elimina tutto'
                )}
              </button>
              <button onClick={() => setConfirming(false)} className="btn-ghost">
                {en ? 'Cancel' : 'Annulla'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
```

### `src/components/ui/toast.jsx`

```jsx
import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, AlertTriangle, X } from 'lucide-react'
import { useLanguage } from '@/lib/LanguageContext'
import { registerToastHandler } from './toast-bus'

export function ToastProvider({ children }) {
  const { lang } = useLanguage()
  const [items, setItems] = useState([])

  const push = useCallback((options) => {
    const id = Math.random().toString(36).slice(2)
    setItems((prev) => [...prev, { id, ...options }])
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4200)
  }, [])

  useEffect(() => {
    // registerToastHandler returns the unregister function — a real cleanup.
    return registerToastHandler(push)
  }, [push])

  return (
    <>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2.5 no-print pointer-events-none"
      >
        <AnimatePresence>
          {items.map((item) => {
            const destructive = item.variant === 'destructive'
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="card-float-lg pointer-events-auto flex items-start gap-3 p-4 pr-3 w-[320px] max-w-[calc(100vw-2.5rem)]"
              >
                <div
                  className="flex items-center justify-center w-7 h-7 rounded-full shrink-0 mt-0.5"
                  style={{ backgroundColor: destructive ? '#FBEAEC' : '#E8F5EE' }}
                >
                  {destructive ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-[#C56B6B]" strokeWidth={2.4} />
                  ) : (
                    <Check className="w-3.5 h-3.5 text-brand-dark" strokeWidth={2.8} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-600 text-ink leading-snug">{item.title}</p>
                  {item.description && (
                    <p className="text-[12.5px] text-ink/55 leading-relaxed mt-0.5">
                      {item.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setItems((prev) => prev.filter((t) => t.id !== item.id))}
                  className="text-ink/30 hover:text-ink/60 transition-colors shrink-0"
                  aria-label={lang === 'en' ? 'Dismiss' : 'Chiudi'}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </>
  )
}
```

### `src/components/ui/toast-bus.js`

```jsx
/**
 * Imperative bridge so non-component code (save handlers, catch blocks) can raise
 * a toast without threading the context through. The provider registers itself on
 * mount; before that, and after unmount, calls are simply dropped.
 */
let handler = null

export function registerToastHandler(fn) {
  handler = fn
  return () => {
    if (handler === fn) handler = null
  }
}

export function toast(options) {
  if (handler) handler(options)
  else console.warn('toast() called before the ToastProvider mounted', options)
}
```

---

## Diary

### `src/pages/Home.jsx`

```jsx
import { useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import GreetingCard from '@/components/diary/GreetingCard'
import ConditionSelector from '@/components/diary/ConditionSelector'
import DiaryForm from '@/components/diary/DiaryForm'
import OnboardingTour from '@/components/diary/OnboardingTour'

export default function Home() {
  const { profile, isLoading, refreshProfile } = useAuth()
  const [activeModule, setActiveModule] = useState(null)
  const [tourDone, setTourDone] = useState(false)
  const [tourName, setTourName] = useState(null)

  if (isLoading || !profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="spinner" />
      </div>
    )
  }

  // The tour covers conditions and theme. It is keyed on its own marker rather
  // than on the display name, which now arrives with the account at sign-up, and
  // the marker lives on the profile so the tour does not reappear on a second
  // device.
  const needsTour = !tourDone && !profile.onboarded_at

  const handleTourDone = (chosenName) => {
    setTourName(chosenName)
    setTourDone(true)
    refreshProfile()
  }

  // The profile is the source of truth; the tour's answer only fills the gap
  // until the refreshed profile arrives.
  const name = profile.display_name || tourName

  return (
    <div>
      {needsTour && (
        <OnboardingTour onDone={handleTourDone} knownName={profile.display_name || null} />
      )}

      <GreetingCard userName={name} />

      <div className="card-float p-5 sm:p-6 mb-5">
        <ConditionSelector activeModule={activeModule} onSelect={setActiveModule} />
      </div>

      <DiaryForm activeModule={activeModule} />
    </div>
  )
}
```

### `src/components/diary/GreetingCard.jsx`

```jsx
import { motion } from 'framer-motion'
import { useLanguage } from '@/lib/LanguageContext'
import { t } from '@/lib/translations'
import { formatLongDate, getGreeting } from '@/lib/dateUtils'
import ZenGardenMini from './ZenGardenMini'

export default function GreetingCard({ userName }) {
  const { lang } = useLanguage()

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="relative mb-6 overflow-hidden card-float-lg px-6 sm:px-8 py-7 sm:py-9"
    >
      <div className="pointer-events-none absolute inset-0 card-sheen" />

      <div className="relative flex items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          <p className="font-mono-data text-[11px] text-ink/45 uppercase tracking-[0.12em] mb-2">
            {formatLongDate(new Date(), lang)}
          </p>
          <h1 className="font-display text-[28px] sm:text-[34px] font-600 text-ink leading-[1.12] tracking-tight">
            {getGreeting(lang)}
            {userName ? (
              <>
                ,<br className="hidden sm:block" />{' '}
                <span className="text-brand-dark">{userName}</span> 👋
              </>
            ) : (
              <> 👋</>
            )}
          </h1>
          <p className="text-ink/55 text-[14px] sm:text-[15px] mt-2.5 max-w-md leading-relaxed">
            {t('subtitle_home', lang)}
          </p>
        </div>

        <div className="hidden sm:flex shrink-0 w-[120px] h-[120px] lg:w-[140px] lg:h-[140px] items-center justify-center">
          <ZenGardenMini variant="greeting" />
        </div>
      </div>
    </motion.div>
  )
}
```

### `src/components/diary/ZenGardenMini.jsx`

```jsx
import { useEffect, useState } from 'react'
import { db } from '@/api/client'
import { useLanguage } from '@/lib/LanguageContext'
import { t } from '@/lib/translations'
import { computeStreak } from '@/lib/dateUtils'

/**
 * Compact procedural garden. The logging streak decides how many stems grow,
 * how tall they are, and (from 14 days) whether they flower.
 *
 * `variant="header"` renders a 36px pill; `variant="greeting"` a 92px scene
 * with the streak number beneath it.
 */
export default function ZenGardenMini({ variant = 'header' }) {
  const { lang } = useLanguage()
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    db.entities.DiaryEntry.list('-entry_date', 400)
      .then((entries) => setStreak(computeStreak(entries)))
      .catch(() => setStreak(0))
  }, [])

  const tier = streak >= 14 ? 3 : streak >= 7 ? 2 : streak >= 3 ? 1 : streak >= 1 ? 0 : -1
  const big = variant === 'greeting'

  const width = big ? 92 : 44
  const height = big ? 46 : 22
  const pad = big ? 12 : 6

  const stemCount = streak === 0 ? 0 : Math.min(streak, big ? 6 : 5)
  const positions =
    stemCount === 1
      ? [width / 2]
      : Array.from({ length: stemCount }).map(
          (_, i) => pad + (i * (width - pad * 2)) / (stemCount - 1)
        )

  const stemHeight = (big ? 14 : 7) + Math.min(streak, 12) * (big ? 2.2 : 1)
  const leafRx = big ? 6 : 3
  const leafRy = big ? 3.2 : 1.6
  const stemWidth = big ? 2.6 : 1.4
  const flowerR = big ? 3.4 : 1.8

  const dayLabel = t(streak === 1 ? 'garden_day' : 'garden_days', lang)
  const title = tier === -1 ? t('garden_msg_0', lang) : `${streak} ${dayLabel}`

  const svg = (
    <svg
      viewBox={`0 0 ${width} ${height + 4}`}
      preserveAspectRatio="xMidYMax meet"
      className={big ? 'w-[92px] h-[54px]' : 'w-[36px] h-[22px]'}
      style={{ flexShrink: 0 }}
    >
      <path
        d={`M0 ${height} L${width} ${height}`}
        stroke="hsl(var(--garden-ground-2))"
        strokeWidth={big ? 2.5 : 2}
        strokeLinecap="round"
      />
      {tier === -1 && (
        <circle
          cx={width / 2}
          cy={height - (big ? 3 : 2)}
          r={big ? 3 : 1.8}
          fill="#8C7355"
          opacity={0.6}
        />
      )}
      {positions.map((x, i) => (
        <g key={i}>
          <path
            d={`M ${x} ${height} Q ${x - (big ? 3 : 2)} ${height - stemHeight / 2} ${x} ${height - stemHeight}`}
            stroke="#4FAF82"
            strokeWidth={stemWidth}
            fill="none"
            strokeLinecap="round"
          />
          <ellipse
            cx={x - (big ? 5 : 3)}
            cy={height - stemHeight * 0.5}
            rx={leafRx}
            ry={leafRy}
            fill="#54B88E"
            transform={`rotate(-26 ${x - (big ? 5 : 3)} ${height - stemHeight * 0.5})`}
          />
          <ellipse
            cx={x + (big ? 5 : 3)}
            cy={height - stemHeight * 0.7}
            rx={leafRx}
            ry={leafRy}
            fill="#4FAF82"
            transform={`rotate(26 ${x + (big ? 5 : 3)} ${height - stemHeight * 0.7})`}
          />
          {tier >= 3 && <circle cx={x} cy={height - stemHeight} r={flowerR} fill="#E8B86B" />}
        </g>
      ))}
    </svg>
  )

  if (big) {
    return (
      <div className="flex flex-col items-center gap-1.5" title={title}>
        {svg}
        <div className="flex items-baseline gap-1">
          <span className="font-display text-[26px] font-700 text-brand-dark tabular-nums leading-none">
            {streak}
          </span>
          <span className="text-[11px] text-ink/45">{dayLabel}</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 h-[30px] rounded-full border border-line bg-background hover:border-brand/40 transition-colors"
      title={title}
    >
      {svg}
      <span className="font-display text-[14px] font-700 text-brand-dark tabular-nums leading-none">
        {streak}
      </span>
      <span className="text-[10px] text-ink/45 leading-none hidden sm:inline">{dayLabel}</span>
    </div>
  )
}
```

### `src/components/diary/ConditionSelector.jsx`

```jsx
import { motion } from 'framer-motion'
import { useLanguage } from '@/lib/LanguageContext'
import { t } from '@/lib/translations'
import { getConditionList } from '@/lib/conditions'

export default function ConditionSelector({ activeModule, onSelect }) {
  const { lang } = useLanguage()
  const conditions = getConditionList(lang)

  return (
    <div>
      <p className="text-[13px] text-ink/55 mb-3.5 leading-relaxed">
        {t('condition_select_prompt', lang)}
      </p>
      <div className="flex flex-wrap gap-2">
        {conditions.map((condition) => {
          const active = activeModule === condition.key
          return (
            <motion.button
              key={condition.key}
              type="button"
              onClick={() => onSelect(active ? null : condition.key)}
              whileTap={{ scale: 0.95 }}
              className="cond-pill"
              style={
                active
                  ? {
                      borderColor: condition.color,
                      backgroundColor: condition.color + '14',
                      color: condition.color,
                      fontWeight: 600,
                    }
                  : undefined
              }
            >
              <span className="text-[16px] leading-none">{condition.emoji}</span>
              {condition.label}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
```

### `src/components/diary/DiaryForm.jsx`

```jsx
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Sparkles, ShieldCheck, AlertTriangle } from 'lucide-react'
import { db } from '@/api/client'
import { useLanguage } from '@/lib/LanguageContext'
import { t } from '@/lib/translations'
import { todayISO } from '@/lib/dateUtils'
import {
  getCondition,
  getPainBadges,
  getMedicationOptions,
  getBadgeStyle,
  MOOD_LEVELS,
  NO_PAIN_MODULES,
} from '@/lib/conditions'
import { toast } from '@/components/ui/toast-bus'
import RefBadge from '@/components/RefBadge'
import ModuleFields from './ModuleFields'

const DEFAULT_FORM = {
  pain: 3,
  energy: 5,
  sleep_hours: '',
  medication_taken: '',
  mood: 3,
  notes: '',
}

export default function DiaryForm({ activeModule, onSaved }) {
  const { lang } = useLanguage()
  const noneLabel = t('none_of_these', lang)
  const condition = activeModule ? getCondition(activeModule, lang) : null
  const hidesPain = activeModule && NO_PAIN_MODULES.includes(activeModule)
  const painBadges = getPainBadges(lang)
  const medicationOptions = getMedicationOptions(lang)

  const [form, setForm] = useState(DEFAULT_FORM)
  const [alarms, setAlarms] = useState([noneLabel])
  const [moduleData, setModuleData] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [existingEntry, setExistingEntry] = useState(null)

  // Load today's entry for the selected module, if there is one, so a second
  // visit edits it instead of silently logging the same day twice.
  useEffect(() => {
    let cancelled = false

    db.entities.DiaryEntry.filter(
      { entry_date: todayISO(), module: activeModule || 'base' },
      '-created_date',
      1
    )
      .then(([entry]) => {
        if (cancelled) return
        setSaved(false)
        setExistingEntry(entry || null)
        if (entry) {
          setForm({
            pain: entry.pain ?? 3,
            energy: entry.energy ?? 5,
            sleep_hours: entry.sleep_hours ?? '',
            medication_taken: entry.medication_taken || '',
            mood: entry.mood ?? 3,
            notes: entry.notes || '',
          })
          setAlarms(entry.alarm_symptoms?.length ? entry.alarm_symptoms : [noneLabel])
          setModuleData(entry.module_data || {})
        } else {
          setForm(DEFAULT_FORM)
          setAlarms([noneLabel])
          setModuleData({})
        }
      })
      .catch(() => {
        if (cancelled) return
        setSaved(false)
        setExistingEntry(null)
        setForm(DEFAULT_FORM)
        setAlarms([noneLabel])
        setModuleData({})
      })

    return () => {
      cancelled = true
    }
  }, [activeModule, noneLabel])

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const toggleAlarm = (symptom) => {
    setAlarms((prev) => {
      if (symptom === noneLabel) return [noneLabel]
      const withoutNone = prev.filter((s) => s !== noneLabel)
      return withoutNone.includes(symptom)
        ? withoutNone.filter((s) => s !== symptom)
        : [...withoutNone, symptom]
    })
    setSaved(false)
  }

  const hasAlarm = alarms.some((s) => s !== noneLabel)
  const painBadge = painBadges.find((b) => form.pain >= b.range[0] && form.pain <= b.range[1])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const payload = {
        module: activeModule || 'base',
        entry_date: todayISO(),
        pain: hidesPain ? null : form.pain,
        energy: form.energy,
        sleep_hours: form.sleep_hours ? parseFloat(form.sleep_hours) : null,
        medication_taken: form.medication_taken || null,
        mood: form.mood,
        notes: form.notes || null,
        alarm_symptoms: condition ? alarms : [],
        module_data: condition ? moduleData : {},
      }

      // One entry per day per module: saving again updates it rather than adding
      // a duplicate, which would otherwise skew every average on the Trends page.
      // With an account this is a real upsert against a unique constraint, so
      // two devices saving the same day cannot race into two rows.
      const entry = db.entities.DiaryEntry.upsert
        ? await db.entities.DiaryEntry.upsert(payload)
        : existingEntry
          ? await db.entities.DiaryEntry.update(existingEntry.id, payload)
          : await db.entities.DiaryEntry.create(payload)
      setExistingEntry(entry)

      setSaved(true)
      onSaved && onSaved()
      toast({
        title: lang === 'it' ? 'Diario salvato' : 'Diary saved',
        description: existingEntry
          ? lang === 'it'
            ? 'Registrazione di oggi aggiornata'
            : 'Your entry for today was updated'
          : lang === 'it'
            ? 'Registrazione di oggi salvata con successo'
            : 'Your entry for today was saved',
      })
    } catch (err) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: lang === 'it' ? 'Salvataggio non riuscito' : 'Save failed',
        description: String(err?.message || err),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {condition && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-[20px] border p-5 sm:p-6"
          style={{ borderColor: condition.color + '30', backgroundColor: condition.color + '08' }}
        >
          <div className="flex items-center gap-2.5 mb-2">
            <span className="text-[22px]">{condition.emoji}</span>
            <h2 className="font-display text-[19px] font-600 text-ink">
              {t('whats_this', lang)} {condition.label}
            </h2>
          </div>
          <p className="text-[13.5px] leading-relaxed text-ink-soft">{condition.definition}</p>
        </motion.div>
      )}

      <div className="card-float-lg p-5 sm:p-7">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-[20px] font-600 text-ink">{t('diary_today', lang)}</h2>
          <Sparkles className="w-4 h-4 text-brand/60" strokeWidth={2} />
        </div>

        {condition && (
          <div className="mb-6 pb-6 border-b border-line-soft">
            <p className="text-[13px] font-600 text-ink mb-3">{t('had_today', lang)}</p>
            <div className="flex flex-wrap gap-2">
              {[noneLabel, ...condition.alarmSymptoms].map((symptom) => {
                const selected = alarms.includes(symptom)
                const selectedStyle =
                  symptom === noneLabel
                    ? { backgroundColor: '#4FAF82', borderColor: '#4FAF82', color: '#fff' }
                    : { backgroundColor: '#C56B6B', borderColor: '#C56B6B', color: '#fff' }
                return (
                  <button
                    key={symptom}
                    type="button"
                    onClick={() => toggleAlarm(symptom)}
                    className="toggle-chip"
                    style={selected ? selectedStyle : undefined}
                  >
                    {symptom}
                  </button>
                )
              })}
            </div>

            <AnimatePresence>
              {hasAlarm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 rounded-2xl p-4 flex items-start gap-2.5 warn-soft"
                  style={{ border: '1px solid #C56B6B30' }}
                >
                  <AlertTriangle
                    className="w-[18px] h-[18px] text-[#C56B6B] shrink-0 mt-0.5"
                    strokeWidth={2}
                  />
                  <p className="text-[13px] text-[#8A3A45] leading-relaxed font-500">
                    {t('alarm_warning', lang)}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
          {hidesPain ? (
            <div className="card-inner p-4 sm:col-span-2">
              <p className="text-[13px] text-ink-soft leading-relaxed">
                <span className="font-600 text-brand-dark">{t('pain', lang)}:</span>{' '}
                {t('pain_hidden_note', lang)}
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <label className="text-[13px] font-500 text-ink/70">{t('pain', lang)}</label>
                  {painBadge && <RefBadge badge={painBadge} />}
                </div>
                <span className="font-mono-data text-[15px] font-600 text-ink tabular-nums">
                  {form.pain}
                  <span className="text-ink/35 font-400">/10</span>
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={10}
                value={form.pain}
                onChange={(e) => update('pain', parseInt(e.target.value))}
                className="traccia-slider w-full"
                style={{
                  background: `linear-gradient(to right, ${
                    getBadgeStyle(painBadge?.level).color || '#4FAF82'
                  } ${(form.pain / 10) * 100}%, #EBEEEC ${(form.pain / 10) * 100}%)`,
                }}
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-[13px] font-500 text-ink/70">{t('energy', lang)}</label>
              <span className="font-mono-data text-[15px] font-600 text-ink tabular-nums">
                {form.energy}
                <span className="text-ink/35 font-400">/10</span>
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              value={form.energy}
              onChange={(e) => update('energy', parseInt(e.target.value))}
              className="traccia-slider w-full"
              style={{
                background: `linear-gradient(to right, #4FAF82 ${(form.energy / 10) * 100}%, #EBEEEC ${
                  (form.energy / 10) * 100
                }%)`,
              }}
            />
          </div>

          <div>
            <label className="text-[13px] font-500 text-ink/70 block mb-1.5">
              {t('sleep_hours', lang)}
            </label>
            <input
              type="number"
              min={0}
              max={24}
              step="0.5"
              value={form.sleep_hours}
              onChange={(e) => update('sleep_hours', e.target.value)}
              placeholder={t('sleep_placeholder', lang)}
              className="input-float font-mono-data"
            />
          </div>

          <div>
            <label className="text-[13px] font-500 text-ink/70 block mb-1.5">
              {t('medication_taken', lang)}
            </label>
            <select
              value={form.medication_taken}
              onChange={(e) => update('medication_taken', e.target.value)}
              className="input-float"
            >
              <option value="">—</option>
              {medicationOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6">
          <label className="text-[13px] font-500 text-ink/70 block mb-2.5">
            {t('mood_today', lang)}
          </label>
          <div className="flex gap-2.5">
            {MOOD_LEVELS.map((level) => {
              const selected = form.mood === level.value
              return (
                <motion.button
                  key={level.value}
                  type="button"
                  onClick={() => update('mood', level.value)}
                  whileTap={{ scale: 0.92 }}
                  animate={{ scale: selected ? 1.04 : 1 }}
                  className="flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl border-[1.5px] transition-colors duration-150"
                  style={
                    selected
                      ? { borderColor: '#4FAF82', backgroundColor: '#E8F5EE' }
                      : { borderColor: '#EBEEEC', backgroundColor: 'hsl(var(--card))' }
                  }
                >
                  <span className="text-[24px] leading-none">{level.emoji}</span>
                </motion.button>
              )
            })}
          </div>
        </div>

        {condition && (
          <div className="mt-6 pt-6 border-t border-line-soft">
            <h3 className="font-display text-[17px] font-600 text-ink mb-4 flex items-center gap-2">
              <span className="text-[18px]">{condition.emoji}</span> {t('details_for', lang)}{' '}
              {condition.label}
            </h3>
            <ModuleFields fields={condition.fields} data={moduleData} onChange={setModuleData} />
          </div>
        )}

        <div className="mt-6">
          <label className="text-[13px] font-500 text-ink/70 block mb-1.5">
            {t('personal_notes', lang)}
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => update('notes', e.target.value.slice(0, 500))}
            placeholder={t('notes_placeholder', lang)}
            rows={3}
            className="input-float !h-auto py-3.5 leading-relaxed resize-none"
          />
          <div className="text-right mt-1.5">
            <span className="font-mono-data text-[11px] text-ink/35">{form.notes.length}/500</span>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? (
                <span className="spinner !w-4 !h-4 !border-2 !border-white/40 !border-t-white" />
              ) : (
                <>
                  <Check className="w-4 h-4" strokeWidth={2.6} />
                  {t('save_entry', lang)}
                </>
              )}
            </button>
            <AnimatePresence>
              {saved && (
                <motion.span
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-[13px] font-500 text-brand-dark flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" strokeWidth={2.6} /> {t('saved_success', lang)}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <p className="flex items-center gap-1.5 text-[11.5px] text-ink/40 ml-auto">
            <ShieldCheck className="w-3.5 h-3.5" strokeWidth={2} />
            {lang === 'it'
              ? 'I tuoi dati sono al sicuro e sempre riservati'
              : 'Your data is safe and always private'}
          </p>
        </div>
      </div>
    </div>
  )
}
```

### `src/components/diary/ModuleFields.jsx`

```jsx
import RefBadge from '@/components/RefBadge'

/** Renders a condition's dynamic diary fields from its `fields` definition. */
export default function ModuleFields({ fields, data, onChange }) {
  const set = (key, value) => onChange({ ...data, [key]: value })

  const toggleInList = (key, option) => {
    const current = data[key] || []
    set(key, current.includes(option) ? current.filter((v) => v !== option) : [...current, option])
  }

  return (
    <div className="space-y-5">
      {fields.map((field) => {
        if (field.showIf && data[field.showIf.field] !== field.showIf.value) return null
        const value = data[field.key]

        switch (field.type) {
          case 'slider':
            return (
              <SliderField
                key={field.key}
                field={field}
                value={value}
                onChange={(v) => set(field.key, v)}
              />
            )

          case 'select':
            return (
              <Field
                key={field.key}
                label={field.label}
                badge={field.badge ? field.badge(value, data) : null}
              >
                <select
                  value={value || ''}
                  onChange={(e) => set(field.key, e.target.value)}
                  className="input-float"
                >
                  <option value="">—</option>
                  {field.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
            )

          case 'number':
            return (
              <Field
                key={field.key}
                label={field.label}
                badge={field.badge ? field.badge(value, data) : null}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step={field.step || '1'}
                    value={value ?? ''}
                    onChange={(e) =>
                      set(field.key, e.target.value === '' ? null : parseFloat(e.target.value))
                    }
                    placeholder={field.placeholder || ''}
                    className="input-float !w-36 font-mono-data"
                  />
                  {field.unit && <span className="text-[13px] text-ink/50">{field.unit}</span>}
                </div>
              </Field>
            )

          case 'chips':
            return (
              <Field key={field.key} label={field.label}>
                <div className="flex flex-wrap gap-2">
                  {field.options.map((opt) => {
                    const selected = (value || []).includes(opt)
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggleInList(field.key, opt)}
                        className="toggle-chip"
                        style={
                          selected
                            ? {
                                backgroundColor: '#4FAF82',
                                borderColor: '#4FAF82',
                                color: '#fff',
                              }
                            : undefined
                        }
                      >
                        {opt}
                      </button>
                    )
                  })}
                </div>
              </Field>
            )

          case 'checkbox':
            return (
              <Field key={field.key} label={field.label}>
                <div className="flex flex-wrap gap-4">
                  {field.options.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(value || []).includes(opt)}
                        onChange={() => toggleInList(field.key, opt)}
                        className="w-[18px] h-[18px] rounded-[5px] accent-[#4FAF82]"
                      />
                      <span className="text-[13.5px] text-ink-soft">{opt}</span>
                    </label>
                  ))}
                </div>
              </Field>
            )

          case 'text':
            return (
              <Field key={field.key} label={field.label}>
                <input
                  type="text"
                  value={value || ''}
                  onChange={(e) => set(field.key, e.target.value)}
                  placeholder={field.placeholder || ''}
                  className="input-float"
                />
              </Field>
            )

          default:
            return null
        }
      })}
    </div>
  )
}

function Field({ label, badge, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <label className="text-[13px] font-500 text-ink/70">{label}</label>
        {badge && <RefBadge badge={badge} />}
      </div>
      {children}
    </div>
  )
}

function SliderField({ field, value, onChange }) {
  const current = value ?? field.min
  const pct = ((current - field.min) / (field.max - field.min)) * 100

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[13px] font-500 text-ink/70">{field.label}</label>
        <span className="font-mono-data text-[14px] font-600 text-ink tabular-nums">{current}</span>
      </div>
      <input
        type="range"
        min={field.min}
        max={field.max}
        value={current}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="traccia-slider w-full"
        style={{ background: `linear-gradient(to right, #4FAF82 ${pct}%, #EBEEEC ${pct}%)` }}
      />
    </div>
  )
}
```

### `src/components/diary/OnboardingTour.jsx`

```jsx
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { Leaf, ArrowRight, ChevronLeft, Check, Sun, Moon } from 'lucide-react'
import { db } from '@/api/client'
import { useLanguage } from '@/lib/LanguageContext'
import { t } from '@/lib/translations'
import { getConditionList } from '@/lib/conditions'

/** Every word capitalised — the saved display name is always presented this way. */
function capitalizeName(value) {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export default function OnboardingTour({ onDone, knownName = null }) {
  const { lang } = useLanguage()
  const { setTheme } = useTheme()

  // With an account the name came from sign-up, so the tour is conditions + theme.
  // In device-local mode there is no sign-up, so it still asks for a name first.
  const steps = knownName ? ['conditions', 'theme'] : ['name', 'conditions', 'theme']
  const [stepIndex, setStepIndex] = useState(0)
  const step = steps[stepIndex]
  const [name, setName] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const conditions = getConditionList(lang)
  const en = lang === 'en'

  const submitName = async (e) => {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      await db.auth.updateMe({ display_name: capitalizeName(name) })
    } catch (err) {
      console.error('Onboarding name save failed:', err)
      setError(
        en ? 'Save failed, but you can continue.' : 'Salvataggio non riuscito, ma puoi continuare.'
      )
    } finally {
      setBusy(false)
      setStepIndex(stepIndex + 1)
    }
  }

  const toggleCondition = (key) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const submitConditions = async () => {
    if (busy) return
    setBusy(true)
    if (selected.size > 0) {
      try {
        await db.entities.Pathology.bulkCreate([...selected].map((condition) => ({ condition })))
      } catch (err) {
        console.error('Onboarding pathologies save failed:', err)
      }
    }
    setBusy(false)
    setStepIndex(stepIndex + 1)
  }

  const finish = async (theme) => {
    setTheme(theme)
    try {
      await db.auth.updateMe({ onboarded_at: new Date().toISOString() })
    } catch (err) {
      console.error('Could not record onboarding completion', err)
    }
    onDone(knownName || capitalizeName(name) || null)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-md p-4 overflow-y-auto"
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="card-float-lg max-w-md w-full p-7 sm:p-8 relative overflow-hidden my-auto"
        >
          <div className="pointer-events-none absolute inset-0 modal-sheen" />

          <div className="relative">
            <div className="flex items-center justify-center gap-2 mb-6">
              {steps.map((stepName, i) => (
                <div
                  key={stepName}
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: i === stepIndex ? 28 : 8,
                    backgroundColor: i <= stepIndex ? '#4FAF82' : '#DDE3DF',
                  }}
                />
              ))}
            </div>

            <AnimatePresence mode="wait">
              {step === 'name' && (
                <motion.div
                  key="name"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-soft mx-auto mb-5">
                    <Leaf className="w-7 h-7 text-brand" strokeWidth={2.2} />
                  </div>
                  <h2 className="font-display text-[24px] font-600 text-ink text-center mb-2">
                    {t('onboarding_title', lang)}
                  </h2>
                  <p className="text-ink/55 text-sm text-center mb-6">
                    {t('onboarding_question', lang)}
                  </p>
                  <form onSubmit={submitName}>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('onboarding_placeholder', lang)}
                      autoFocus
                      className="input-float"
                    />
                    {error && (
                      <p className="mt-2 text-[12px] text-[#C56B6B] leading-relaxed">{error}</p>
                    )}
                    <button
                      type="submit"
                      disabled={!name.trim() || busy}
                      className="btn-primary w-full mt-4"
                    >
                      {busy ? (
                        <span className="spinner !w-4 !h-4 !border-2 !border-white/40 !border-t-white" />
                      ) : (
                        <>
                          {t('onboarding_continue', lang)}{' '}
                          <ArrowRight className="w-4 h-4" strokeWidth={2.4} />
                        </>
                      )}
                    </button>
                  </form>
                </motion.div>
              )}

              {step === 'conditions' && (
                <motion.div
                  key="conditions"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.25 }}
                >
                  <h2 className="font-display text-[22px] font-600 text-ink text-center mb-2">
                    {t('onboarding_conditions_title', lang)}
                  </h2>
                  <p className="text-ink/55 text-[13px] text-center mb-5 leading-relaxed max-w-[340px] mx-auto">
                    {t('onboarding_conditions_intro', lang)}
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 max-h-[280px] overflow-y-auto no-scrollbar px-1 py-1">
                    {conditions.map((condition) => {
                      const active = selected.has(condition.key)
                      return (
                        <button
                          key={condition.key}
                          onClick={() => toggleCondition(condition.key)}
                          className="cond-pill"
                          style={
                            active
                              ? {
                                  backgroundColor: condition.color + '18',
                                  borderColor: condition.color,
                                  color: condition.color,
                                }
                              : undefined
                          }
                        >
                          <span>{condition.emoji}</span> {condition.label}
                          {active && <Check className="w-3.5 h-3.5" strokeWidth={2.6} />}
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-[11px] text-ink/40 text-center mt-3 italic">
                    {t('onboarding_conditions_skip', lang)}
                  </p>
                  <button
                    onClick={submitConditions}
                    disabled={busy}
                    className="btn-primary w-full mt-5"
                  >
                    {busy ? (
                      <span className="spinner !w-4 !h-4 !border-2 !border-white/40 !border-t-white" />
                    ) : (
                      <>
                        {t('onboarding_continue', lang)}{' '}
                        <ArrowRight className="w-4 h-4" strokeWidth={2.4} />
                      </>
                    )}
                  </button>
                </motion.div>
              )}

              {step === 'theme' && (
                <motion.div
                  key="theme"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.25 }}
                >
                  <h2 className="font-display text-[22px] font-600 text-ink text-center mb-2">
                    {t('onboarding_theme_title', lang)}
                  </h2>
                  <p className="text-ink/55 text-[13px] text-center mb-5">
                    {t('onboarding_theme_subtitle', lang)}
                  </p>
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <button
                      onClick={() => finish('light')}
                      className="rounded-2xl border-2 p-5 flex flex-col items-center gap-2 transition-all hover:scale-[1.02] bg-white"
                      style={{ borderColor: '#4FAF82' }}
                    >
                      <Sun className="w-7 h-7 text-[#B8863B]" strokeWidth={2} />
                      <span className="text-[13px] font-600 text-ink">
                        {t('onboarding_light', lang)}
                      </span>
                    </button>
                    <button
                      onClick={() => finish('dark')}
                      className="rounded-2xl border-2 p-5 flex flex-col items-center gap-2 transition-all hover:scale-[1.02]"
                      style={{
                        borderColor: '#4FAF82',
                        backgroundColor: '#16221E',
                        color: '#E8F1ED',
                      }}
                    >
                      <Moon className="w-7 h-7 text-[#4FAF82]" strokeWidth={2} />
                      <span className="text-[13px] font-600" style={{ color: '#E8F1ED' }}>
                        {t('onboarding_dark', lang)}
                      </span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {stepIndex > 0 && (
              <button
                onClick={() => setStepIndex(stepIndex - 1)}
                className="btn-link flex items-center gap-1 mx-auto mt-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2} /> {en ? 'Back' : 'Indietro'}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
```

---

## Other pages

### `src/pages/Patologies.jsx`

```jsx
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, X, Trash2 } from 'lucide-react'
import { db } from '@/api/client'
import { useLanguage } from '@/lib/LanguageContext'
import { useDataSync } from '@/lib/useDataSync'
import { t } from '@/lib/translations'
import { formatDateInput } from '@/lib/dateUtils'
import { getConditionList, getCondition } from '@/lib/conditions'
import { toast } from '@/components/ui/toast-bus'

const EMPTY = {
  condition: '',
  custom_name: '',
  diagnosis_date: '',
  yearOnly: false,
  diagnosis_year: '',
}

export default function Patologies() {
  const { lang } = useLanguage()
  const conditions = getConditionList(lang)
  const [pathologies, setPathologies] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)

  const load = () => {
    db.entities.Pathology.list('-created_date')
      .then(setPathologies)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(load, [])
  useDataSync(load)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.condition) return
    try {
      await db.entities.Pathology.create({
        condition: form.condition,
        custom_name: form.condition === 'altro' ? form.custom_name : null,
        diagnosis_date: form.yearOnly ? null : form.diagnosis_date || null,
        diagnosis_year: form.yearOnly && form.diagnosis_year ? parseInt(form.diagnosis_year) : null,
      })
      setForm(EMPTY)
      setFormOpen(false)
      load()
      toast({
        title: lang === 'it' ? 'Patologia aggiunta' : 'Pathology added',
        description:
          lang === 'it'
            ? 'La condizione è stata salvata nel tuo profilo'
            : 'The condition was saved to your profile',
      })
    } catch (err) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: lang === 'it' ? 'Salvataggio non riuscito' : 'Save failed',
        description: String(err?.message || err),
      })
    }
  }

  const handleDelete = async (id) => {
    await db.entities.Pathology.delete(id)
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-[28px] sm:text-[34px] font-600 text-ink leading-[1.12] tracking-tight">
            {t('my_pathologies_title', lang)}
          </h1>
          <p className="text-ink/55 text-[14px] mt-1.5">{t('my_pathologies_subtitle', lang)}</p>
        </div>
        <button onClick={() => setFormOpen(!formOpen)} className="btn-primary shrink-0">
          <Plus className="w-4 h-4" strokeWidth={2.4} />
          <span className="hidden sm:inline">{t('add_pathology', lang)}</span>
        </button>
      </div>

      <AnimatePresence>
        {formOpen && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="card-float p-5 sm:p-6 mb-6 space-y-4 overflow-hidden"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[13px] font-500 text-ink/70 block mb-1.5">
                  {t('condition_label', lang)}
                </label>
                <select
                  value={form.condition}
                  onChange={(e) => setForm({ ...form, condition: e.target.value })}
                  className="input-float"
                >
                  <option value="">{t('select_placeholder', lang)}</option>
                  {conditions.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.emoji} {c.label}
                    </option>
                  ))}
                  <option value="altro">📄 {t('other', lang)}</option>
                </select>
              </div>

              <div>
                <label className="text-[13px] font-500 text-ink/70 block mb-1.5">
                  {t('diagnosis_date_label', lang)}
                </label>
                {form.yearOnly ? (
                  <input
                    type="number"
                    min={1940}
                    max={new Date().getFullYear()}
                    value={form.diagnosis_year}
                    onChange={(e) => setForm({ ...form, diagnosis_year: e.target.value })}
                    placeholder={lang === 'it' ? 'es. 2021' : 'e.g. 2021'}
                    className="input-float font-mono-data"
                  />
                ) : (
                  <input
                    type="date"
                    value={form.diagnosis_date}
                    onChange={(e) => setForm({ ...form, diagnosis_date: e.target.value })}
                    className="input-float"
                  />
                )}
                <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.yearOnly}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        yearOnly: e.target.checked,
                        diagnosis_date: e.target.checked ? '' : form.diagnosis_date,
                        diagnosis_year: e.target.checked ? form.diagnosis_year : '',
                      })
                    }
                    className="w-[16px] h-[16px] rounded-[5px] accent-[#4FAF82]"
                  />
                  <span className="text-[13px] text-ink-soft">{t('year_only', lang)}</span>
                </label>
              </div>
            </div>

            {form.condition === 'altro' && (
              <div>
                <label className="text-[13px] font-500 text-ink/70 block mb-1.5">
                  {t('pathology_name_label', lang)}
                </label>
                <input
                  type="text"
                  value={form.custom_name}
                  onChange={(e) => setForm({ ...form, custom_name: e.target.value })}
                  placeholder={t('pathology_name_placeholder', lang)}
                  className="input-float"
                />
              </div>
            )}

            <div className="flex gap-2">
              <button type="submit" className="btn-primary">
                {t('save_pathology', lang)}
              </button>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                aria-label={lang === 'en' ? 'Close form' : 'Chiudi il modulo'}
                className="btn-ghost"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="spinner" />
        </div>
      ) : pathologies.length === 0 ? (
        <div className="card-float p-12 text-center">
          <p className="text-ink/45 text-sm">{t('no_pathologies', lang)}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {pathologies.map((p, i) => {
            const condition = getCondition(p.condition, lang)
            const label = condition ? condition.label : p.custom_name || t('other', lang)
            const emoji = condition ? condition.emoji : '📄'
            const color = condition ? condition.color : '#7A8B85'

            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card-float p-5 relative overflow-hidden"
              >
                <div
                  className="absolute top-0 left-0 w-full h-1"
                  style={{ backgroundColor: color }}
                />
                <div className="flex items-start justify-between mb-3 mt-1">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex items-center justify-center w-10 h-10 rounded-2xl text-[20px]"
                      style={{ backgroundColor: color + '14' }}
                    >
                      {emoji}
                    </div>
                    <h3 className="font-display text-[17px] font-600 text-ink">{label}</h3>
                  </div>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-ink/35 hover:text-[#C56B6B] transition-colors"
                    aria-label={t('remove', lang)}
                  >
                    <Trash2 className="w-[17px] h-[17px]" strokeWidth={2} />
                  </button>
                </div>

                <p className="text-[12px] text-ink/45 mb-3 font-mono-data">
                  {p.diagnosis_year
                    ? `${t('diagnosed_in_year', lang)} ${p.diagnosis_year}`
                    : p.diagnosis_date
                      ? `${t('diagnosed_on', lang)}: ${formatDateInput(p.diagnosis_date, lang)}`
                      : t('date_not_specified', lang)}
                </p>

                {condition && (
                  <div>
                    <p className="text-[10px] font-600 text-brand-dark uppercase tracking-[0.1em] mb-1.5">
                      {t('monitored_data', lang)}
                    </p>
                    <p className="text-[13px] text-ink-soft leading-relaxed">
                      {condition.fields.map((f) => f.label).join(' · ')}
                    </p>
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

### `src/pages/Documents.jsx`

```jsx
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, X, Trash2, FileText, Camera, ExternalLink } from 'lucide-react'
import { db, resolveFileUrl, removeStoredFile } from '@/api/client'
import { useLanguage } from '@/lib/LanguageContext'
import { useDataSync } from '@/lib/useDataSync'
import { t } from '@/lib/translations'
import { formatDateInput } from '@/lib/dateUtils'
import { getConditionList, getCondition, getDocTypes } from '@/lib/conditions'
import { toast } from '@/components/ui/toast-bus'

const EMPTY = { doc_type: '', doc_date: '', description: '', linked_condition: '' }

/** Only formats a medical report is plausibly in, and a size a browser can hold. */
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
const MAX_FILE_BYTES = 15 * 1024 * 1024

export default function Documents() {
  const { lang } = useLanguage()
  const docTypes = getDocTypes(lang)
  const conditions = getConditionList(lang)

  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [pending, setPending] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [previewUrls, setPreviewUrls] = useState({})

  const cameraRef = useRef(null)
  const fileRef = useRef(null)

  const load = () => {
    db.entities.MedicalDocument.list('-doc_date')
      .then(setDocuments)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(load, [])
  useDataSync(load)

  // The staged file's preview URL is created once, when the file is picked, and
  // revoked when it is replaced or cleared. Creating it inline during render
  // would leak one object URL on every keystroke in the form.
  useEffect(() => {
    const url = pending?.previewUrl
    if (!url) return
    return () => URL.revokeObjectURL(url)
  }, [pending])

  // Stored files are blobs; resolve them to object URLs for preview and opening.
  useEffect(() => {
    let cancelled = false
    const created = []
    Promise.all(documents.map(async (doc) => [doc.id, await resolveFileUrl(doc.file_url)])).then(
      (pairs) => {
        if (cancelled) return
        const map = {}
        pairs.forEach(([id, url]) => {
          if (url) {
            map[id] = url
            created.push(url)
          }
        })
        setPreviewUrls(map)
      }
    )
    return () => {
      cancelled = true
      created.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [documents])

  const resetForm = () => {
    setForm(EMPTY)
    setPending(null)
    setFormOpen(false)
  }

  const handleFilePicked = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // let the same file be re-picked after an error
    if (!file) return

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({
        variant: 'destructive',
        title: lang === 'it' ? 'Formato non supportato' : 'Unsupported format',
        description:
          lang === 'it'
            ? 'Puoi caricare una foto (JPG, PNG, WebP) o un PDF.'
            : 'You can upload a photo (JPG, PNG, WebP) or a PDF.',
      })
      return
    }

    if (file.size > MAX_FILE_BYTES) {
      toast({
        variant: 'destructive',
        title: lang === 'it' ? 'File troppo grande' : 'File too large',
        description:
          lang === 'it'
            ? 'Il limite è 15 MB. Prova a ridurre la qualità della foto.'
            : 'The limit is 15 MB. Try reducing the photo quality.',
      })
      return
    }

    const isImage = file.type.startsWith('image')
    setPending({
      file,
      name: file.name,
      type: isImage ? 'image' : 'pdf',
      previewUrl: isImage ? URL.createObjectURL(file) : null,
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.doc_type || !form.doc_date || !pending) return
    setUploading(true)
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file: pending.file })
      await db.entities.MedicalDocument.create({
        doc_type: form.doc_type,
        doc_date: form.doc_date,
        description: form.description || null,
        linked_condition: form.linked_condition || null,
        file_url,
        file_type: pending.type,
        file_name: pending.name,
      })
      resetForm()
      load()
      toast({
        title: lang === 'it' ? 'Documento salvato' : 'Document saved',
        description:
          lang === 'it' ? 'Referto caricato con successo' : 'Document uploaded successfully',
      })
    } catch (err) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: lang === 'it' ? 'Caricamento non riuscito' : 'Upload failed',
        description: String(err?.message || err),
      })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (doc) => {
    await removeStoredFile(doc.file_url)
    await db.entities.MedicalDocument.delete(doc.id)
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-[28px] sm:text-[34px] font-600 text-ink leading-[1.12] tracking-tight">
            {t('documents_title', lang)}
          </h1>
          <p className="text-ink/55 text-[14px] mt-1.5">{t('documents_subtitle', lang)}</p>
        </div>
        <button onClick={() => setFormOpen(!formOpen)} className="btn-primary shrink-0">
          <Plus className="w-4 h-4" strokeWidth={2.4} />
          <span className="hidden sm:inline">{t('add_document', lang)}</span>
        </button>
      </div>

      <AnimatePresence>
        {formOpen && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="card-float p-5 sm:p-6 mb-6 space-y-4 overflow-hidden"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[13px] font-500 text-ink/70 block mb-1.5">
                  {t('document_type', lang)}
                </label>
                <select
                  value={form.doc_type}
                  onChange={(e) => setForm({ ...form, doc_type: e.target.value })}
                  className="input-float"
                >
                  <option value="">{t('select_placeholder', lang)}</option>
                  {Object.entries(docTypes).map(([key, meta]) => (
                    <option key={key} value={key}>
                      {meta.emoji} {meta.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[13px] font-500 text-ink/70 block mb-1.5">
                  {t('document_date', lang)}
                </label>
                <input
                  type="date"
                  value={form.doc_date}
                  onChange={(e) => setForm({ ...form, doc_date: e.target.value })}
                  className="input-float"
                />
              </div>
            </div>

            <div>
              <label className="text-[13px] font-500 text-ink/70 block mb-1.5">
                {t('description_optional', lang)}
              </label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t('description_placeholder', lang)}
                className="input-float"
              />
            </div>

            <div>
              <label className="text-[13px] font-500 text-ink/70 block mb-1.5">
                {t('linked_pathology', lang)}
              </label>
              <select
                value={form.linked_condition}
                onChange={(e) => setForm({ ...form, linked_condition: e.target.value })}
                className="input-float"
              >
                <option value="">{t('none_option', lang)}</option>
                {conditions.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.emoji} {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[13px] font-500 text-ink/70 block mb-2">
                {t('upload_document', lang)}
              </label>
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFilePicked}
                className="hidden"
              />
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,image/*"
                onChange={handleFilePicked}
                className="hidden"
              />

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="btn-ghost flex-1 !py-3"
                >
                  <Camera className="w-4 h-4 text-brand" strokeWidth={2} />
                  {t('take_photo', lang)}
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="btn-ghost flex-1 !py-3"
                >
                  <FileText className="w-4 h-4 text-brand" strokeWidth={2} />
                  {t('upload_pdf', lang)}
                </button>
              </div>

              {pending && (
                <div className="mt-3 flex items-center gap-3 card-inner p-3">
                  {pending.previewUrl ? (
                    <img
                      src={pending.previewUrl}
                      alt={
                        lang === 'it'
                          ? 'Anteprima del documento selezionato'
                          : 'Preview of the selected document'
                      }
                      className="w-11 h-11 object-cover rounded-xl"
                    />
                  ) : (
                    <div className="w-11 h-11 bg-brand rounded-xl flex items-center justify-center text-white text-[11px] font-600">
                      PDF
                    </div>
                  )}
                  <span className="text-[13px] text-ink truncate flex-1">{pending.name}</span>
                  <button
                    type="button"
                    onClick={() => setPending(null)}
                    aria-label={
                      lang === 'en' ? 'Remove selected file' : 'Rimuovi il file selezionato'
                    }
                    className="text-ink/40 hover:text-[#C56B6B]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!form.doc_type || !form.doc_date || !pending || uploading}
              className="btn-primary"
            >
              {uploading ? (
                <span className="spinner !w-4 !h-4 !border-2 !border-white/40 !border-t-white" />
              ) : (
                t('confirm_upload', lang)
              )}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="spinner" />
        </div>
      ) : documents.length === 0 ? (
        <div className="card-float p-12 text-center">
          <FileText className="w-8 h-8 text-ink/25 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-ink/45 text-sm">{t('no_documents', lang)}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc, i) => {
            const meta = docTypes[doc.doc_type] || { label: doc.doc_type, emoji: '📄' }
            const condition = doc.linked_condition ? getCondition(doc.linked_condition, lang) : null
            const url = previewUrls[doc.id]

            return (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="card-float p-4 flex items-center gap-4"
              >
                {doc.file_type === 'image' && url ? (
                  <img
                    src={url}
                    alt={doc.file_name}
                    className="w-14 h-14 object-cover rounded-2xl shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 card-inner rounded-2xl flex items-center justify-center text-[22px] shrink-0">
                    {meta.emoji}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[14px] font-500 text-ink">{meta.label}</span>
                    {condition && (
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: condition.color + '14',
                          color: condition.color,
                        }}
                      >
                        {condition.emoji} {condition.label}
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-ink/45 font-mono-data">
                    {formatDateInput(doc.doc_date, lang)}
                  </p>
                  {doc.description && (
                    <p className="text-[13px] text-ink-soft mt-1 truncate">{doc.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-link flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> {t('view_file', lang)}
                    </a>
                  )}
                  <button
                    onClick={() => handleDelete(doc)}
                    aria-label={`${lang === 'en' ? 'Delete' : 'Elimina'} ${meta.label}`}
                    className="text-ink/35 hover:text-[#C56B6B] transition-colors"
                  >
                    <Trash2 className="w-[17px] h-[17px]" strokeWidth={2} />
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

### `src/pages/Trends.jsx`

```jsx
import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, Printer, CalendarCheck, StickyNote } from 'lucide-react'
import { db } from '@/api/client'
import { useLanguage } from '@/lib/LanguageContext'
import { useDataSync } from '@/lib/useDataSync'
import { t } from '@/lib/translations'
import {
  todayISO,
  subtractDays,
  formatShortDate,
  getPeriodDays,
  getPeriodLabel,
} from '@/lib/dateUtils'
import { getCondition } from '@/lib/conditions'
import { useChartTheme } from '@/lib/useChartTheme'
import { buildReportHtml } from '@/lib/printReport'
import { toast } from '@/components/ui/toast-bus'
import WeeklyAISummary from '@/components/trends/WeeklyAISummary'
import ContinuityRibbon from '@/components/trends/ContinuityRibbon'

export default function Trends() {
  const { lang } = useLanguage()
  const chart = useChartTheme()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('7g')
  const [lifestyleModule, setLifestyleModule] = useState(null)

  const load = useCallback(() => {
    db.entities.DiaryEntry.list('-entry_date', 200)
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])
  useDataSync(load)

  const conditionOf = (key) => getCondition(key, lang)

  const days = getPeriodDays(period)
  const today = todayISO()
  const periodStart = subtractDays(today, days - 1)
  const prevStart = subtractDays(periodStart, days)
  const prevEnd = subtractDays(periodStart, 1)

  const inRange = (date, from, to) => date >= from && date <= to
  const current = entries.filter((e) => inRange(e.entry_date, periodStart, today))
  const previous = entries.filter((e) => inRange(e.entry_date, prevStart, prevEnd))

  const average = (rows, key) => {
    const values = rows.map((r) => r[key]).filter((v) => v != null)
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
  }

  const delta = (curr, prev) =>
    curr == null || prev == null || prev === 0 ? null : ((curr - prev) / prev) * 100

  /** `value` is already oriented so that positive = worse. */
  const trendOf = (value) => {
    // `null` means there is no comparable previous period — not "no change".
    // Without this guard `-null` coerces to -0 and renders a misleading "0%".
    if (value == null || Number.isNaN(value)) return null
    if (Math.abs(value) < 5) {
      return { icon: Minus, color: '#7A8B85', label: lang === 'it' ? 'stabile' : 'stable' }
    }
    return value > 0
      ? { icon: TrendingUp, color: '#C56B6B', label: lang === 'it' ? 'peggioramento' : 'worse' }
      : { icon: TrendingDown, color: '#3B9A6E', label: lang === 'it' ? 'miglioramento' : 'better' }
  }

  const recentNotes = entries.filter((e) => e.notes).slice(0, 5)

  const painSeries = [...current].reverse().map((e) => ({
    date: formatShortDate(e.entry_date, lang),
    dolore: e.pain,
    color: conditionOf(e.module)?.color || '#7A8B85',
  }))
  const energySeries = [...current]
    .reverse()
    .map((e) => ({ date: formatShortDate(e.entry_date, lang), energia: e.energy }))
  const sleepSeries = [...current]
    .reverse()
    .map((e) => ({ date: formatShortDate(e.entry_date, lang), sonno: e.sleep_hours }))
  const moodSeries = [...current]
    .reverse()
    .map((e) => ({ date: formatShortDate(e.entry_date, lang), umore: e.mood }))

  const usedModules = [...new Set(entries.map((e) => e.module))].filter((m) => m !== 'base')
  const mostRecentModule = entries.find((e) => e.module !== 'base')?.module
  const lifestyleKey = lifestyleModule || mostRecentModule
  const lifestyleCondition = lifestyleKey ? conditionOf(lifestyleKey) : null

  const ribbonDays = []
  for (let i = days - 1; i >= 0; i--) {
    const date = subtractDays(today, i)
    const entry = entries.find((e) => e.entry_date === date)
    ribbonDays.push({
      date,
      entry,
      color: entry ? conditionOf(entry.module)?.color || '#7A8B85' : null,
    })
  }

  const painNow = average(current, 'pain')
  const painPrev = average(previous, 'pain')
  const painDelta = delta(painNow, painPrev)
  const painRising = painDelta != null && painDelta > 15

  /** Picks the module-specific series worth charting for a condition. */
  const moduleSeries = (key) => {
    const condition = conditionOf(key)
    if (!condition) return null
    const field = condition.trendField
      ? condition.fields.find((f) => f.key === condition.trendField.key)
      : condition.fields.find((f) => f.type === 'number' || f.type === 'slider')
    if (!field) return null

    return {
      key: field.key,
      label: condition.trendField?.label || field.label,
      color: condition.color,
      data: entries
        .filter((e) => e.module === key && e.module_data?.[field.key] != null)
        .reverse()
        .map((e) => ({
          date: formatShortDate(e.entry_date, lang),
          value: e.module_data[field.key],
        })),
    }
  }

  const exportReport = async () => {
    const [appointments, therapies] = await Promise.all([
      db.entities.Appointment.list().catch(() => []),
      db.entities.Therapy.list().catch(() => []),
    ])
    const html = buildReportHtml(
      [...entries].reverse(),
      appointments,
      therapies,
      periodStart,
      today,
      lang
    )
    const win = window.open('', '_blank')
    if (!win) {
      toast({
        variant: 'destructive',
        title: lang === 'it' ? 'Report bloccato' : 'Report blocked',
        description:
          lang === 'it'
            ? 'Il browser ha bloccato la finestra. Consenti i popup per questo sito e riprova.'
            : 'Your browser blocked the window. Allow pop-ups for this site and try again.',
      })
      return
    }
    win.document.write(html)
    win.document.close()
    setTimeout(() => win.print(), 300)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="spinner" />
      </div>
    )
  }

  const metrics = [
    { label: t('pain', lang), curr: painNow, prev: painPrev, lowerIsBetter: true },
    {
      label: t('trend_energy', lang),
      curr: average(current, 'energy'),
      prev: average(previous, 'energy'),
      lowerIsBetter: false,
    },
    {
      label: t('trend_sleep', lang),
      curr: average(current, 'sleep_hours'),
      prev: average(previous, 'sleep_hours'),
      lowerIsBetter: false,
    },
  ]

  const smallCharts = [
    {
      title: t('trend_energy', lang),
      data: energySeries,
      key: 'energia',
      color: '#B8863B',
      domain: [0, 10],
    },
    {
      title: t('trend_sleep', lang),
      data: sleepSeries,
      key: 'sonno',
      color: '#4A6FA5',
      domain: [0, 12],
    },
    {
      title: t('trend_mood', lang),
      data: moodSeries,
      key: 'umore',
      color: '#8A5A8A',
      domain: [0, 5],
    },
  ].filter((series) => series.data.some((row) => row[series.key] != null))

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-[28px] sm:text-[34px] font-600 text-ink leading-[1.12] tracking-tight">
            {t('trends_title', lang)}
          </h1>
          <p className="text-ink/55 text-[14px] mt-1.5">{t('trends_subtitle', lang)}</p>
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="input-float !w-auto !h-10 !text-[13px] font-500"
          >
            <option value="7g">{t('last_7', lang)}</option>
            <option value="14g">{t('last_14', lang)}</option>
            <option value="30g">{t('last_30', lang)}</option>
            <option value="90g">{t('last_90', lang)}</option>
          </select>
          <button onClick={exportReport} className="btn-primary">
            <Printer className="w-4 h-4" strokeWidth={2} />
            <span className="hidden sm:inline">
              {lang === 'it' ? 'Esporta report' : 'Export report'}
            </span>
          </button>
        </div>
      </div>

      {painRising && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-4 mb-5 flex items-start gap-2.5 amber-soft"
          style={{ border: '1px solid #B8863B30' }}
        >
          <TrendingUp
            className="w-[18px] h-[18px] text-[#B8863B] shrink-0 mt-0.5"
            strokeWidth={2}
          />
          <p className="text-[13px] text-[#7A5623] leading-relaxed">
            {t('pain_increase_warning', lang)}
          </p>
        </motion.div>
      )}

      <div className="card-float p-5 sm:p-6 mb-5">
        <h2 className="font-display text-[18px] font-600 text-ink mb-1.5">
          {t('how_are_you_doing', lang)}
        </h2>
        <p className="text-[12px] text-ink/45 mb-5 leading-relaxed">
          {getPeriodLabel(period, lang)} {t('comparison_note', lang)}
        </p>

        <div className="grid sm:grid-cols-3 gap-3">
          {metrics.map((metric) => {
            const change = delta(metric.curr, metric.prev)
            const trend = change == null ? null : trendOf(metric.lowerIsBetter ? -change : change)
            const Icon = trend?.icon
            return (
              <div key={metric.label} className="card-inner p-4">
                <p className="text-[12.5px] text-ink/50 mb-1.5">{metric.label}</p>
                {metric.curr != null ? (
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-[28px] font-700 text-ink tabular-nums leading-none">
                      {metric.curr.toFixed(1)}
                    </span>
                    {trend && (
                      <span
                        className="flex items-center gap-1 text-[12px] font-500"
                        style={{ color: trend.color }}
                      >
                        <Icon className="w-3.5 h-3.5" strokeWidth={2.4} />
                        {Math.abs(change).toFixed(0)}%
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-[12.5px] text-ink/40 italic">{t('need_more_days', lang)}</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <WeeklyAISummary entries={entries} />

      {painSeries.length > 0 && painSeries.some((p) => p.dolore != null) && (
        <div className="card-float p-5 sm:p-6 mb-5">
          <h2 className="font-display text-[17px] font-600 text-ink mb-4">
            {t('pain_line', lang)}
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={painSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: chart.tick }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 10]}
                tick={{ fontSize: 11, fill: chart.tick }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip contentStyle={chart.tooltip} />
              <Line
                type="monotone"
                dataKey="dolore"
                stroke="#4FAF82"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#4FAF82' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {smallCharts.length > 0 && (
        <div className="grid sm:grid-cols-3 gap-4 mb-5">
          {smallCharts.map((small) => (
            <div key={small.key} className="card-float p-5">
              <h2 className="font-display text-[14px] font-600 text-ink mb-3">{small.title}</h2>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={small.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: chart.tick }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={small.domain}
                    tick={{ fontSize: 10, fill: chart.tick }}
                    axisLine={false}
                    tickLine={false}
                    width={24}
                  />
                  <Tooltip contentStyle={{ ...chart.tooltip, fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey={small.key}
                    stroke={small.color}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: small.color }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      )}

      {usedModules.map((key) => {
        const series = moduleSeries(key)
        if (!series || series.data.length === 0) return null
        const condition = conditionOf(key)
        return (
          <div key={key} className="card-float p-5 sm:p-6 mb-5">
            <h2 className="font-display text-[16px] font-600 text-ink mb-4 flex items-center gap-2">
              <span className="text-[18px]">{condition.emoji}</span> {t('trend_for', lang)}{' '}
              {condition.label} — {series.label}
            </h2>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={series.data}>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: chart.tick }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: chart.tick }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Tooltip contentStyle={chart.tooltip} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={series.color}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: series.color }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )
      })}

      <div className="card-float p-5 sm:p-6 mb-5">
        <h2 className="font-display text-[16px] font-600 text-ink mb-3 flex items-center gap-2">
          <CalendarCheck className="w-4 h-4 text-brand" strokeWidth={2} />{' '}
          {t('continuity_title', lang)}
        </h2>
        <ContinuityRibbon days={ribbonDays} lang={lang} />
      </div>

      {recentNotes.length > 0 && (
        <div className="card-float p-5 sm:p-6 mb-5">
          <h2 className="font-display text-[16px] font-600 text-ink mb-3 flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-brand" strokeWidth={2} /> {t('recent_notes', lang)}
          </h2>
          <div className="space-y-3">
            {recentNotes.map((note) => (
              <div key={note.id} className="border-l-2 border-brand/30 pl-3.5">
                <p className="text-[11px] text-ink/45 font-mono-data mb-0.5">
                  {formatShortDate(note.entry_date, lang)}
                </p>
                <p className="text-[13px] text-ink-soft leading-relaxed">{note.notes}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {lifestyleCondition && (
        <div className="card-float p-5 sm:p-6 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[18px]">{lifestyleCondition.emoji}</span>
            <h2 className="font-display text-[16px] font-600 text-ink">
              {t('lifestyle_title', lang)} — {lifestyleCondition.label}
            </h2>
          </div>

          {usedModules.length > 1 && (
            <select
              value={lifestyleModule || ''}
              onChange={(e) => setLifestyleModule(e.target.value || null)}
              className="input-float !w-auto !h-10 !text-[13px] mb-4"
            >
              <option value="">{t('most_recent_module', lang)}</option>
              {usedModules.map((key) => (
                <option key={key} value={key}>
                  {conditionOf(key)?.emoji} {conditionOf(key)?.label}
                </option>
              ))}
            </select>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-2xl p-4 bg-brand-soft">
              <p className="text-[13px] font-600 text-brand-dark mb-2 flex items-center gap-1.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-brand text-white text-[11px]">
                  ✓
                </span>{' '}
                {t('helps', lang)}
              </p>
              <ul className="space-y-2">
                {lifestyleCondition.lifestyle.helps.map((item, i) => (
                  <li key={i} className="text-[13px] text-ink-soft leading-relaxed pl-6 relative">
                    <span className="absolute left-0 top-0 text-brand/40">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl p-4 warn-soft">
              <p className="text-[13px] font-600 text-[#8A3A45] mb-2 flex items-center gap-1.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#C56B6B] text-white text-[11px]">
                  ✕
                </span>{' '}
                {t('avoid_title', lang)}
              </p>
              <ul className="space-y-2">
                {lifestyleCondition.lifestyle.avoid.map((item, i) => (
                  <li key={i} className="text-[13px] text-ink-soft leading-relaxed pl-6 relative">
                    <span className="absolute left-0 top-0 text-[#C56B6B]/40">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="text-[11px] text-ink/40 mt-3 italic leading-relaxed">
            {t('lifestyle_disclaimer', lang)}
          </p>
        </div>
      )}
    </div>
  )
}
```

### `src/pages/Appointments.jsx`

```jsx
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Plus,
  X,
  Trash2,
  CalendarDays,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { db, resolveFileUrl } from '@/api/client'
import { useLanguage } from '@/lib/LanguageContext'
import { useDataSync } from '@/lib/useDataSync'
import { t } from '@/lib/translations'
import { todayISO, formatDateInput, daysUntil } from '@/lib/dateUtils'
import { getCondition, getDocTypes, getSpecialists } from '@/lib/conditions'
import { toast } from '@/components/ui/toast-bus'

export default function Appointments() {
  const { lang } = useLanguage()
  const docTypes = getDocTypes(lang)
  const specialists = getSpecialists(lang)

  const [documents, setDocuments] = useState([])
  const [appointments, setAppointments] = useState([])
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({ specialist: '', appointment_date: '' })
  const [fileUrls, setFileUrls] = useState({})

  // Returns nothing on purpose: it is passed straight to useEffect, and a
  // returned promise would be mistaken for a cleanup function.
  const load = () => {
    Promise.all([
      db.entities.MedicalDocument.list('-doc_date'),
      db.entities.Appointment.list('appointment_date'),
      db.entities.DiaryEntry.list('-entry_date', 60),
    ])
      .then(([docs, appts, diary]) => {
        setDocuments(docs)
        setAppointments(appts)
        setEntries(diary)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(load, [])
  useDataSync(load)

  useEffect(() => {
    let cancelled = false
    const created = []
    Promise.all(documents.map(async (d) => [d.id, await resolveFileUrl(d.file_url)])).then(
      (pairs) => {
        if (cancelled) return
        const map = {}
        pairs.forEach(([id, url]) => {
          if (url) {
            map[id] = url
            created.push(url)
          }
        })
        setFileUrls(map)
      }
    )
    return () => {
      cancelled = true
      created.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [documents])

  const pastDocuments = documents.filter((d) => d.doc_date < todayISO())
  const upcoming = appointments.filter((a) => a.appointment_date >= todayISO())
  const past = appointments.filter((a) => a.appointment_date < todayISO())

  const average = (rows, key) => {
    const values = rows.map((r) => r[key]).filter((v) => v != null)
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
  }

  const painDelta = (() => {
    const thisWeek = average(entries.slice(0, 7), 'pain')
    const lastWeek = average(entries.slice(7, 14), 'pain')
    if (thisWeek == null || lastWeek == null || lastWeek === 0) return null
    return ((thisWeek - lastWeek) / lastWeek) * 100
  })()
  const painRising = painDelta != null && painDelta > 15

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.specialist || !form.appointment_date) return
    try {
      // One appointment per specialist — a new one replaces the existing entry.
      const existing = appointments.find((a) => a.specialist === form.specialist)
      if (existing) await db.entities.Appointment.delete(existing.id)
      await db.entities.Appointment.create(form)
      setForm({ specialist: '', appointment_date: '' })
      setFormOpen(false)
      load()
      toast({
        title: lang === 'it' ? 'Controllo salvato' : 'Check-up saved',
        description:
          lang === 'it'
            ? 'Appuntamento aggiunto al tuo calendario'
            : 'Appointment added to your calendar',
      })
    } catch (err) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: lang === 'it' ? 'Salvataggio non riuscito' : 'Save failed',
        description: String(err?.message || err),
      })
    }
  }

  const handleDelete = async (id) => {
    await db.entities.Appointment.delete(id)
    load()
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-display text-[28px] sm:text-[34px] font-600 text-ink leading-[1.12] tracking-tight mb-6">
        {t('appointments_title', lang)}
      </h1>

      <AnimatePresence>
        {painRising && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl p-4 mb-5 flex items-start gap-2.5 amber-soft"
            style={{ border: '1px solid #B8863B30' }}
          >
            <AlertTriangle
              className="w-[18px] h-[18px] text-[#B8863B] shrink-0 mt-0.5"
              strokeWidth={2}
            />
            <p className="text-[13px] text-[#7A5623] leading-relaxed">
              {t('pain_increase_warning', lang)}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="card-float p-5 sm:p-6 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-[18px] font-600 text-ink">
            {t('upcoming_checkups', lang)}
          </h2>
          <button onClick={() => setFormOpen(!formOpen)} className="btn-ghost !py-2 !px-3.5">
            <Plus className="w-4 h-4" strokeWidth={2.4} /> {t('add_btn', lang)}
          </button>
        </div>

        <AnimatePresence>
          {formOpen && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleSubmit}
              className="grid sm:grid-cols-2 gap-4 mb-4 p-4 card-inner overflow-hidden"
            >
              <div>
                <label className="text-[13px] font-500 text-ink/70 block mb-1.5">
                  {t('with_whom', lang)}
                </label>
                <select
                  value={form.specialist}
                  onChange={(e) => setForm({ ...form, specialist: e.target.value })}
                  className="input-float"
                >
                  <option value="">{t('select_placeholder', lang)}</option>
                  {Object.entries(specialists).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[13px] font-500 text-ink/70 block mb-1.5">
                  {t('date_label', lang)}
                </label>
                <input
                  type="date"
                  value={form.appointment_date}
                  onChange={(e) => setForm({ ...form, appointment_date: e.target.value })}
                  className="input-float"
                />
              </div>

              <div className="sm:col-span-2 flex gap-2">
                <button type="submit" className="btn-primary">
                  {t('save_checkup', lang)}
                </button>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  aria-label={lang === 'en' ? 'Close form' : 'Chiudi il modulo'}
                  className="btn-ghost"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {upcoming.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CalendarDays className="w-7 h-7 text-ink/25 mb-2" strokeWidth={1.5} />
            <p className="text-ink/45 text-sm">{t('no_future_checkups', lang)}</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {upcoming.map((appointment, i) => {
              const inDays = daysUntil(appointment.appointment_date)
              return (
                <motion.div
                  key={appointment.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-3 p-4 card-inner"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-brand-soft">
                    <CalendarDays className="w-[18px] h-[18px] text-brand-dark" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-500 text-ink">
                      {specialists[appointment.specialist] || appointment.specialist}
                    </p>
                    <p className="text-[12px] text-ink/45 font-mono-data">
                      {formatDateInput(appointment.appointment_date, lang)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[13px] font-600 text-brand-dark font-mono-data px-2.5 py-1 rounded-full bg-brand-soft">
                      {inDays === 0
                        ? t('today', lang)
                        : inDays === 1
                          ? t('tomorrow', lang)
                          : t('in_days', lang).replace('{n}', inDays)}
                    </span>
                    <button
                      onClick={() => handleDelete(appointment.id)}
                      aria-label={`${lang === 'en' ? 'Delete check-up with' : 'Elimina controllo con'} ${
                        specialists[appointment.specialist] || appointment.specialist
                      }`}
                      className="text-ink/35 hover:text-[#C56B6B] transition-colors"
                    >
                      <Trash2 className="w-[16px] h-[16px]" strokeWidth={2} />
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}

        {past.length > 0 && (
          <div className="mt-3 pt-3 border-t border-line-soft space-y-1">
            {past.map((appointment) => (
              <div
                key={appointment.id}
                className="flex items-center justify-between p-2 text-[13px]"
              >
                <span className="text-ink/45">
                  {specialists[appointment.specialist]} —{' '}
                  {formatDateInput(appointment.appointment_date, lang)}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#B8863B]">{t('past_date_update', lang)}</span>
                  <button
                    onClick={() => handleDelete(appointment.id)}
                    aria-label={`${lang === 'en' ? 'Delete check-up with' : 'Elimina controllo con'} ${
                      specialists[appointment.specialist] || appointment.specialist
                    }`}
                    className="text-ink/35 hover:text-[#C56B6B]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card-float p-5 sm:p-6 mb-5">
        <h2 className="font-display text-[18px] font-600 text-ink mb-4">
          {t('past_checkups', lang)}
        </h2>
        {pastDocuments.length === 0 ? (
          <p className="text-ink/45 text-sm">{t('no_past_docs', lang)}</p>
        ) : (
          <div className="space-y-2.5">
            {pastDocuments.map((doc, i) => {
              const meta = docTypes[doc.doc_type] || { label: doc.doc_type, emoji: '📄' }
              const condition = doc.linked_condition
                ? getCondition(doc.linked_condition, lang)
                : null
              const url = fileUrls[doc.id]
              return (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-3 p-3.5 card-inner"
                >
                  <span className="text-[20px]">{meta.emoji}</span>
                  <div className="flex-1">
                    <p className="text-[13.5px] font-500 text-ink">{meta.label}</p>
                    <p className="text-[11.5px] text-ink/45 font-mono-data">
                      {formatDateInput(doc.doc_date, lang)}
                      {condition ? ` · ${condition.emoji} ${condition.label}` : ''}
                    </p>
                  </div>
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-link flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {t('open_file', lang)}
                    </a>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      <div className="card-float p-5 sm:p-6">
        <h2 className="font-display text-[18px] font-600 text-ink mb-4">
          {t('prepare_visit', lang)}
        </h2>
        <ul className="space-y-3">
          {[t('prep_1', lang), t('prep_2', lang), t('prep_3', lang), t('prep_4', lang)].map(
            (step, i) => (
              <li key={i} className="flex items-start gap-3">
                <CheckCircle2
                  className="w-[18px] h-[18px] text-brand shrink-0 mt-0.5"
                  strokeWidth={2}
                />
                <span className="text-[13.5px] text-ink-soft leading-relaxed">{step}</span>
              </li>
            )
          )}
        </ul>
      </div>
    </div>
  )
}
```

### `src/pages/Therapies.jsx`

```jsx
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, X, Trash2, Pill, Bell, Check } from 'lucide-react'
import { db } from '@/api/client'
import { useLanguage } from '@/lib/LanguageContext'
import { useDataSync } from '@/lib/useDataSync'
import { t } from '@/lib/translations'
import { getFrequencies } from '@/lib/conditions'
import { toast } from '@/components/ui/toast-bus'

const EMPTY = { name: '', dosage: '', time: '', frequency: 'ogni_giorno' }

export default function Therapies() {
  const { lang } = useLanguage()
  const frequencies = getFrequencies(lang)

  const [therapies, setTherapies] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [now, setNow] = useState(new Date())
  const [acknowledged, setAcknowledged] = useState([])

  const load = () => {
    db.entities.Therapy.list('-created_date')
      .then(setTherapies)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])
  useDataSync(load)

  const currentTime = now.toTimeString().slice(0, 5)

  // A daily medication is "due" within a 5-minute window around its time.
  const due = therapies.filter((th) => {
    if (th.frequency !== 'ogni_giorno' || !th.time) return false
    if (acknowledged.includes(th.id)) return false
    const [h, m] = th.time.split(':').map(Number)
    const [nh, nm] = currentTime.split(':').map(Number)
    return Math.abs(h * 60 + m - (nh * 60 + nm)) <= 5
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name) return
    try {
      await db.entities.Therapy.create(form)
      setForm(EMPTY)
      setFormOpen(false)
      load()
      toast({
        title: lang === 'it' ? 'Terapia salvata' : 'Therapy saved',
        description:
          lang === 'it' ? 'Farmaco aggiunto alla tua lista' : 'Medication added to your list',
      })
    } catch (err) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: lang === 'it' ? 'Salvataggio non riuscito' : 'Save failed',
        description: String(err?.message || err),
      })
    }
  }

  const handleDelete = async (id) => {
    await db.entities.Therapy.delete(id)
    load()
  }

  /**
   * Dismisses the reminder for this dose. Persisting a medication history (and the
   * confirmation streak that goes with it) still needs a `MedicationLog` entity.
   */
  const markAsTaken = (therapy) => {
    setAcknowledged((prev) => [...prev, therapy.id])
    toast({
      title: lang === 'it' ? 'Segnato come preso' : 'Marked as taken',
      description: therapy.name,
    })
  }

  const frequencyLabel = (value) => frequencies.find((f) => f.value === value)?.label || value

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-display text-[28px] sm:text-[34px] font-600 text-ink leading-[1.12] tracking-tight mb-6">
        {t('therapies_title', lang)}
      </h1>

      <AnimatePresence>
        {due.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-[20px] p-5 mb-5 overflow-hidden relative"
            style={{ background: 'linear-gradient(135deg, #54B88E, #42A577)' }}
          >
            <div className="flex items-start gap-3 relative">
              <Bell className="w-5 h-5 text-white shrink-0 mt-0.5" strokeWidth={2} />
              <div className="flex-1 space-y-2">
                {due.map((therapy) => (
                  <div
                    key={therapy.id}
                    className="flex items-center justify-between flex-wrap gap-2"
                  >
                    <p className="text-white font-500 text-[13.5px]">
                      {t('med_time_to_take', lang)} <span className="font-600">{therapy.name}</span>
                      {therapy.dosage ? ` (${therapy.dosage})` : ''}
                    </p>
                    <button
                      onClick={() => markAsTaken(therapy)}
                      className="bg-white text-brand-dark font-500 px-3 py-1.5 rounded-lg text-[12px] hover:bg-brand-soft transition-colors flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> {t('mark_as_taken', lang)}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-4 gap-4">
        <p className="text-ink/55 text-[14px]">{t('therapies_subtitle', lang)}</p>
        <button onClick={() => setFormOpen(!formOpen)} className="btn-primary shrink-0">
          <Plus className="w-4 h-4" strokeWidth={2.4} />
          <span className="hidden sm:inline">{t('add_medication', lang)}</span>
        </button>
      </div>

      <AnimatePresence>
        {formOpen && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="card-float p-5 sm:p-6 mb-5 space-y-4 overflow-hidden"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[13px] font-500 text-ink/70 block mb-1.5">
                  {t('name_and_dosage', lang)}
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t('name_dosage_placeholder', lang)}
                  required
                  className="input-float"
                />
              </div>

              <div>
                <label className="text-[13px] font-500 text-ink/70 block mb-1.5">
                  {t('extra_dosage', lang)}
                </label>
                <input
                  type="text"
                  value={form.dosage}
                  onChange={(e) => setForm({ ...form, dosage: e.target.value })}
                  placeholder={t('extra_dosage_placeholder', lang)}
                  className="input-float"
                />
              </div>

              <div>
                <label className="text-[13px] font-500 text-ink/70 block mb-1.5">
                  {t('time_label', lang)}
                </label>
                <input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                  className="input-float font-mono-data"
                />
              </div>

              <div>
                <label className="text-[13px] font-500 text-ink/70 block mb-1.5">
                  {t('frequency_label', lang)}
                </label>
                <select
                  value={form.frequency}
                  onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                  className="input-float"
                >
                  {frequencies.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button type="submit" className="btn-primary">
                {t('save_medication', lang)}
              </button>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                aria-label={lang === 'en' ? 'Close form' : 'Chiudi il modulo'}
                className="btn-ghost"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {therapies.length === 0 ? (
        <div className="card-float p-12 text-center">
          <Pill className="w-8 h-8 text-ink/25 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-ink/45 text-sm">{t('no_medications', lang)}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {therapies.map((therapy, i) => (
            <motion.div
              key={therapy.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="card-float p-4 flex items-center gap-4"
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-soft shrink-0">
                <Pill className="w-5 h-5 text-brand" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-500 text-ink">{therapy.name}</p>
                <p className="text-[12px] text-ink/50">
                  {therapy.dosage && <span>{therapy.dosage} · </span>}
                  {therapy.time && <span className="font-mono-data">{therapy.time} · </span>}
                  {frequencyLabel(therapy.frequency)}
                </p>
              </div>
              <button
                onClick={() => handleDelete(therapy.id)}
                aria-label={`${lang === 'en' ? 'Delete' : 'Elimina'} ${therapy.name}`}
                className="text-ink/35 hover:text-[#C56B6B] transition-colors shrink-0"
              >
                <Trash2 className="w-[17px] h-[17px]" strokeWidth={2} />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      <p className="text-[11.5px] text-ink/40 mt-4 italic leading-relaxed">
        {t('reminder_note', lang)}
      </p>
    </div>
  )
}
```

### `src/pages/Contents.jsx`

```jsx
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ExternalLink } from 'lucide-react'
import { useLanguage } from '@/lib/LanguageContext'
import { t } from '@/lib/translations'
import { getConditionList } from '@/lib/conditions'
import { getIssUrl } from '@/lib/issUrls'

export default function Contents() {
  const { lang } = useLanguage()
  const conditions = getConditionList(lang)
  const [filter, setFilter] = useState('all')

  const cards = (
    filter === 'all' ? conditions : conditions.filter((c) => c.key === filter)
  ).flatMap((condition) =>
    condition.contentCards.map((card, cardIndex) => ({ ...card, condition, cardIndex }))
  )

  return (
    <div>
      <h1 className="font-display text-[28px] sm:text-[34px] font-600 text-ink leading-[1.12] tracking-tight mb-1">
        {t('contents_title', lang)}
      </h1>
      <p className="text-ink/55 text-[14px] mb-5">{t('contents_subtitle', lang)}</p>

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className="toggle-chip"
          style={
            filter === 'all'
              ? { backgroundColor: '#4FAF82', borderColor: '#4FAF82', color: '#fff' }
              : undefined
          }
        >
          {t('all_filter', lang)}
        </button>
        {conditions.map((condition) => (
          <button
            key={condition.key}
            onClick={() => setFilter(condition.key)}
            className="toggle-chip"
            style={
              filter === condition.key
                ? {
                    backgroundColor: condition.color,
                    borderColor: condition.color,
                    color: '#fff',
                  }
                : undefined
            }
          >
            <span>{condition.emoji}</span>&nbsp;{condition.label}
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <AnimatePresence mode="popLayout">
          {cards.map((card, i) => {
            const url = getIssUrl(card.condition.key, card.cardIndex)
            return (
              <motion.div
                key={`${card.condition.key}-${card.cardIndex}`}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.3, delay: i * 0.03 }}
                className="card-float p-5 relative overflow-hidden"
              >
                <div
                  className="absolute top-0 left-0 w-full h-1"
                  style={{ backgroundColor: card.condition.color }}
                />
                <div className="flex items-center gap-2 mb-2.5 mt-1">
                  <div
                    className="flex items-center justify-center w-8 h-8 rounded-xl text-[16px]"
                    style={{ backgroundColor: card.condition.color + '14' }}
                  >
                    {card.condition.emoji}
                  </div>
                  <span
                    className="text-[11px] font-500 px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: card.condition.color + '14',
                      color: card.condition.color,
                    }}
                  >
                    {card.condition.label}
                  </span>
                </div>

                <h3 className="font-display text-[17px] font-600 text-ink mb-2 leading-snug">
                  {card.title}
                </h3>
                <p className="text-[13px] text-ink-soft leading-relaxed">{card.body}</p>

                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[12.5px] font-500 text-brand-dark hover:text-brand transition-colors mt-3"
                  >
                    {t('iss_link', lang)} <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
                  </a>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
```

### `src/pages/Docs.jsx`

```jsx
import { useEffect, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { Download, Share2, FileText } from 'lucide-react'
import { useLanguage } from '@/lib/LanguageContext'
import { toast } from '@/components/ui/toast-bus'
import PrivacyControls from '@/components/PrivacyControls'

const DOC_PATH = '/TRACCIA_DOCS.md'
const FILE_NAME = 'TRACCIA_DOCS.md'

/**
 * The document is app-owned, but it is still fetched at runtime and injected as
 * HTML — so it goes through the same sanitizer any untrusted input would.
 */
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('href')?.startsWith('http')) {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

function renderMarkdown(source) {
  return DOMPurify.sanitize(marked.parse(source, { gfm: true, breaks: false }), {
    ADD_ATTR: ['target', 'rel'],
  })
}

export default function Docs() {
  const { lang } = useLanguage()
  const en = lang === 'en'
  const [markdown, setMarkdown] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(DOC_PATH)
      .then((res) => res.text())
      .then(setMarkdown)
      .catch(() => setMarkdown(''))
      .finally(() => setLoading(false))
  }, [])

  const download = () => {
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = FILE_NAME
    a.click()
    URL.revokeObjectURL(url)
  }

  /**
   * Shares the file itself where the Web Share API supports it; otherwise falls
   * back to downloading the .md and opening WhatsApp with a short message.
   */
  const shareOnWhatsApp = async () => {
    const file = new File([markdown], FILE_NAME, { type: 'text/markdown' })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Traccia — Documentazione' })
        return
      } catch (err) {
        if (err?.name === 'AbortError') return
        console.error(err)
      }
    }
    download()
    const text = encodeURIComponent(
      en
        ? 'Traccia — full documentation (the .md file has been downloaded, attach it here).'
        : 'Traccia — documentazione completa (il file .md è stato scaricato, allegalo qui).'
    )
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer')
    toast({
      title: en ? 'File downloaded' : 'File scaricato',
      description: en ? 'Attach it to the WhatsApp chat.' : 'Allegalo alla chat WhatsApp.',
    })
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-[28px] sm:text-[34px] font-600 text-ink leading-[1.12] tracking-tight">
            {en ? 'Guide' : 'Guida'}
          </h1>
          <p className="text-ink/55 text-[14px] mt-1.5">
            {en
              ? 'Full project documentation, in one page.'
              : 'La documentazione completa del progetto, in una pagina.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button onClick={shareOnWhatsApp} className="btn-ghost">
            <Share2 className="w-4 h-4 text-brand" strokeWidth={2} />
            <span className="hidden sm:inline">
              {en ? 'Share on WhatsApp' : 'Condividi su WhatsApp'}
            </span>
          </button>
          <button onClick={download} className="btn-primary">
            <Download className="w-4 h-4" strokeWidth={2} />
            <span className="hidden sm:inline">{en ? 'Download .md' : 'Scarica .md'}</span>
          </button>
        </div>
      </div>

      <PrivacyControls />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="spinner" />
        </div>
      ) : !markdown ? (
        <div className="card-float p-12 text-center">
          <FileText className="w-8 h-8 text-ink/25 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-ink/45 text-sm">
            {en ? 'Documentation not available.' : 'Documentazione non disponibile.'}
          </p>
        </div>
      ) : (
        <article
          className="card-float p-6 sm:p-8 docs-body"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }}
        />
      )}
    </div>
  )
}
```

### `src/pages/PageNotFound.jsx`

```jsx
import { Link } from 'react-router-dom'
import { useLanguage } from '@/lib/LanguageContext'

export default function PageNotFound() {
  const { lang } = useLanguage()
  return (
    <div className="card-float p-12 text-center">
      <p className="text-[44px] mb-2">🌿</p>
      <h1 className="font-display text-[24px] font-600 text-ink mb-1.5">
        {lang === 'en' ? 'Page not found' : 'Pagina non trovata'}
      </h1>
      <p className="text-ink/50 text-sm mb-6">
        {lang === 'en'
          ? 'The page you were looking for is not here.'
          : 'La pagina che cercavi non è qui.'}
      </p>
      <Link to="/" className="btn-primary inline-flex">
        {lang === 'en' ? 'Back to the diary' : 'Torna al diario'}
      </Link>
    </div>
  )
}
```

### `src/components/trends/WeeklyAISummary.jsx`

```jsx
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { db } from '@/api/client'
import { useLanguage } from '@/lib/LanguageContext'
import { t } from '@/lib/translations'
import { todayISO, subtractDays, formatShortDate } from '@/lib/dateUtils'
import { getCondition } from '@/lib/conditions'

export default function WeeklyAISummary({ entries }) {
  const { lang } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [failed, setFailed] = useState(false)
  const en = lang === 'en'

  const daysLogged = (() => {
    const today = todayISO()
    let count = 0
    for (let i = 0; i < 7; i++) {
      if (entries.find((e) => e.entry_date === subtractDays(today, i))) count++
    }
    return count
  })()

  const buildPayload = () => {
    const today = todayISO()
    const rows = []
    for (let i = 6; i >= 0; i--) {
      const date = subtractDays(today, i)
      const entry = entries.find((e) => e.entry_date === date)
      if (!entry) continue
      const condition = getCondition(entry.module, lang)
      const row = {
        date: formatShortDate(date, lang),
        condizione: condition ? condition.label : 'Base',
      }
      if (entry.pain != null) row.dolore = entry.pain
      if (entry.energy != null) row.energia = entry.energy
      if (entry.sleep_hours != null) row.sonno_ore = entry.sleep_hours
      if (entry.mood != null) row.umore = entry.mood
      if (entry.medication_taken) row.farmaci = entry.medication_taken
      if (entry.notes) row.note = entry.notes
      rows.push(row)
    }
    return rows
  }

  const generate = async () => {
    const payload = buildPayload()
    if (payload.length < 2) return
    setLoading(true)
    setFailed(false)

    // Same empathetic, explicitly non-diagnostic brief the hosted app sends.
    const prompt = en
      ? `You are a warm, empathetic assistant inside "Traccia", a symptom-diary app for people with chronic conditions. Read the user's diary data from the last 7 days (JSON) and write a short, encouraging weekly synthesis: one short headline (max 7 words) and a 2-3 sentence body. Gently describe patterns you notice (e.g. energy dipping on higher-pain days), acknowledge the effort of tracking, and stay non-clinical. Do NOT give medical advice, do NOT diagnose. Reply only with the JSON object. Data:\n${JSON.stringify(payload)}`
      : `Sei un assistente empatico dentro "Traccia", un'app di diario sintomi per persone con patologie croniche. Rileggi i dati del diario dell'utente degli ultimi 7 giorni (JSON) e scrivi una breve sintesi settimanale: un titolo breve (max 7 parole) e un corpo di 2-3 frasi. Descrivi con dolcezza gli andamenti osservati (es. energia calata nelle giornate con più dolore), riconosci l'impegno nel tenere il diario e resta non clinico. NON dare consigli medici, NON formulare diagnosi. Rispondi solo con l'oggetto JSON. Dati:\n${JSON.stringify(payload)}`

    try {
      const response = await db.integrations.Core.InvokeLLM({
        prompt,
        payload,
        lang,
        response_json_schema: {
          type: 'object',
          properties: { headline: { type: 'string' }, summary: { type: 'string' } },
          required: ['headline', 'summary'],
        },
      })
      setResult(response)
    } catch (err) {
      console.error(err)
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card-float p-5 sm:p-6 mb-5 overflow-hidden">
      <div>
        <h2 className="font-display text-[18px] font-600 text-ink flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand" strokeWidth={2} /> {t('ai_summary_title', lang)}
        </h2>
        <p className="text-[12px] text-ink/45 mt-0.5">{t('ai_summary_subtitle', lang)}</p>
      </div>

      {daysLogged < 2 ? (
        <p className="text-[13px] text-ink/50 italic mt-4 leading-relaxed">
          {t('ai_summary_empty', lang)}
        </p>
      ) : !result && !loading ? (
        <button onClick={generate} disabled={loading} className="btn-primary mt-4">
          <Sparkles className="w-4 h-4" strokeWidth={2} /> {t('ai_summary_cta', lang)}
        </button>
      ) : loading ? (
        <div className="flex items-center gap-2.5 mt-4 text-[13px] text-ink/55">
          <Loader2 className="w-4 h-4 animate-spin text-brand" strokeWidth={2} />
          {t('ai_summary_loading', lang)}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={result?.headline || 'err'}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="mt-4"
          >
            {failed ? (
              <div className="flex items-center gap-2 text-[13px] text-[#C56B6B] flex-wrap">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  {en ? 'Unable to generate. Try again.' : 'Generazione non riuscita. Riprova.'}
                </span>
                <button onClick={generate} className="btn-link ml-auto">
                  {t('ai_summary_regenerate', lang)}
                </button>
              </div>
            ) : (
              <>
                <p className="font-display text-[17px] font-600 text-ink mb-2 leading-snug">
                  {result.headline}
                </p>
                <p className="text-[13.5px] text-ink-soft leading-relaxed">{result.summary}</p>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {result && !failed && (
        <div className="flex items-center justify-between gap-3 mt-4">
          <p className="text-[11px] text-ink/40 italic leading-relaxed">
            {t('ai_summary_disclaimer', lang)}
          </p>
          <button
            onClick={generate}
            disabled={loading}
            className="btn-link flex items-center gap-1.5 shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} /> {t('ai_summary_regenerate', lang)}
          </button>
        </div>
      )}
    </div>
  )
}
```

### `src/components/trends/ContinuityRibbon.jsx`

```jsx
import { useState } from 'react'
import { t } from '@/lib/translations'
import { formatShortDate } from '@/lib/dateUtils'
import { getCondition } from '@/lib/conditions'
import { useChartTheme } from '@/lib/useChartTheme'

const DAY_WIDTH = 36
const BASELINE = 34
const HEIGHT = 150
const PAIN_SPAN = 64

/** Catmull-Rom-style smoothing through the daily points. */
function splinePath(points) {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
  for (let i = 0; i < points.length - 1; i++) {
    const prev = points[i - 1] || points[i]
    const curr = points[i]
    const next = points[i + 1]
    const after = points[i + 2] || next
    const c1x = curr.x + (next.x - prev.x) / 6
    const c1y = curr.y + (next.y - prev.y) / 6
    const c2x = next.x - (after.x - curr.x) / 6
    const c2y = next.y - (after.y - curr.y) / 6
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`
  }
  return d
}

/** Days with no entry — same value the legend swatch uses, so the two agree. */
const NO_ENTRY_COLOR = '#DDE3DF'

export default function ContinuityRibbon({ days, lang }) {
  const [hovered, setHovered] = useState(null)
  const chart = useChartTheme()
  const noneLabel = t('none_of_these', lang)

  const points = days.map((day, i) => {
    const hasPain = day.entry && day.entry.pain != null
    return {
      x: i * DAY_WIDTH + DAY_WIDTH / 2,
      y: hasPain ? BASELINE + (day.entry.pain / 10) * PAIN_SPAN : BASELINE,
      day,
      hasPain,
      pain: day.entry?.pain,
    }
  })

  const path = splinePath(points)
  const width = Math.max(days.length * DAY_WIDTH, 1)

  const modulesInPeriod = [
    ...new Set(days.filter((d) => d.entry && d.entry.module !== 'base').map((d) => d.entry.module)),
  ]

  const colorOf = (p) => (p.day.entry ? p.day.color || '#7A8B85' : NO_ENTRY_COLOR)

  return (
    <div>
      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${width} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="w-full"
          style={{ height: HEIGHT }}
        >
          <defs>
            <linearGradient id="ribbonGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              {points.map((p, i) => (
                <stop
                  key={i}
                  offset={`${(i / Math.max(1, days.length - 1)) * 100}%`}
                  stopColor={colorOf(p)}
                />
              ))}
            </linearGradient>
          </defs>

          <line x1="0" y1={BASELINE} x2={width} y2={BASELINE} stroke={chart.grid} strokeWidth="1" />
          <path
            d={path}
            fill="none"
            stroke="url(#ribbonGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((p, i) => {
            const r = 3.5 + (p.hasPain ? (p.pain / 10) * 3.5 : 0)
            const flagged = p.day.entry?.alarm_symptoms?.some((s) => s !== noneLabel)
            return (
              <g key={i}>
                {flagged && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={r + 3.5}
                    fill="none"
                    stroke="#C56B6B"
                    strokeWidth="1.5"
                    opacity="0.7"
                  />
                )}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  fill={colorOf(p)}
                  stroke={chart.dotStroke}
                  strokeWidth="1.5"
                />
              </g>
            )
          })}
        </svg>

        <div className="absolute inset-0 flex">
          {days.map((day, i) => {
            const top = Math.max((points[i].y / HEIGHT) * 100 - 2, 6)
            const condition = day.entry ? getCondition(day.entry.module, lang) : null
            return (
              <div
                key={i}
                className="relative flex-1 h-full"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                {hovered === i && (
                  <div
                    className="absolute z-10 pointer-events-none -translate-x-1/2 -translate-y-full px-2.5 py-1.5 rounded-lg bg-ink text-white text-[11px] leading-tight shadow-lg whitespace-nowrap"
                    style={{ left: '50%', top: `${top}%` }}
                  >
                    <div className="font-600">{formatShortDate(day.date, lang)}</div>
                    {condition && (
                      <div className="opacity-80">
                        {condition.emoji} {condition.label}
                      </div>
                    )}
                    <div className="opacity-90">
                      {day.entry
                        ? day.entry.pain != null
                          ? `${t('pain', lang)}: ${day.entry.pain}/10`
                          : t('continuity_no_pain', lang)
                        : t('no_entry', lang)}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mt-4">
        {modulesInPeriod.map((key) => {
          const condition = getCondition(key, lang)
          if (!condition) return null
          return (
            <div key={key} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: condition.color }} />
              <span className="text-[11.5px] text-ink/55">
                {condition.emoji} {condition.label}
              </span>
            </div>
          )
        })}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NO_ENTRY_COLOR }} />
          <span className="text-[11.5px] text-ink/55">{t('no_entry', lang)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full border-2 border-[#C56B6B] bg-transparent" />
          <span className="text-[11.5px] text-ink/55">{t('continuity_alarm_legend', lang)}</span>
        </div>
      </div>
    </div>
  )
}
```

---

## Styles & config

### `src/index.css`

```css
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;450;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Raw palette */
    --bg: #f9fafb;
    --surface: #ffffff;
    --ink: #1a2f2a;
    --muted: #7a8b85;
    --line: #ebeeec;
    --brand: #4faf82;
    --brand-dark: #3b9a6e;
    --brand-soft: #e8f5ee;

    /* shadcn-compatible tokens */
    --background: 210 20% 98%;
    --foreground: 166 29% 14%;
    --card: 0 0% 100%;
    --card-foreground: 166 29% 14%;
    --popover: 0 0% 100%;
    --popover-foreground: 166 29% 14%;
    --primary: 152 38% 50%;
    --primary-foreground: 0 0% 100%;
    --secondary: 140 8% 93%;
    --secondary-foreground: 166 29% 14%;
    --muted: 140 8% 93%;
    --muted-foreground: 159 7% 51%;
    --accent: 148 39% 94%;
    --accent-foreground: 152 38% 30%;
    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 98%;
    --border: 140 8% 93%;
    --input: 140 8% 93%;
    --ring: 152 38% 50%;
    --radius: 14px;

    /* Traccia semantic tokens */
    --c-ink: 166 29% 14%;
    --c-ink-soft: 160 10% 33%;
    --c-canvas: 210 20% 98%;
    --c-line: 140 8% 92%;
    --c-line-soft: 140 8% 95%;
    --c-surface2: 140 8% 96%;
    --garden-ground-1: 140 16% 90%;
    --garden-ground-2: 140 16% 84%;

    --font-heading: 'Fraunces', Georgia, serif;
    --font-display: 'Fraunces', Georgia, serif;
    --font-body: 'Inter', ui-sans-serif, system-ui, sans-serif;
    --font-mono: 'IBM Plex Mono', ui-monospace, monospace;
  }

  .dark {
    --background: 165 32% 5%;
    --foreground: 140 14% 94%;
    --card: 165 30% 9%;
    --card-foreground: 140 14% 94%;
    --popover: 165 30% 9%;
    --popover-foreground: 140 14% 94%;
    --primary: 152 40% 58%;
    --primary-foreground: 165 32% 5%;
    --secondary: 165 28% 14%;
    --secondary-foreground: 140 14% 94%;
    --muted: 165 28% 14%;
    --muted-foreground: 140 10% 68%;
    --accent: 165 28% 16%;
    --accent-foreground: 140 14% 94%;
    --destructive: 0 60% 42%;
    --destructive-foreground: 0 0% 98%;
    --border: 165 28% 18%;
    --input: 165 28% 18%;
    --ring: 152 40% 58%;

    --c-ink: 140 14% 92%;
    --c-ink-soft: 140 8% 68%;
    --c-canvas: 165 32% 5%;
    --c-line: 165 28% 18%;
    --c-line-soft: 165 28% 16%;
    --c-surface2: 165 28% 16%;
    --garden-ground-1: 165 28% 14%;
    --garden-ground-2: 165 28% 12%;
  }

  * {
    border-color: hsl(var(--border));
    outline-color: hsl(var(--ring) / 0.5);
  }

  body {
    background-color: hsl(var(--background));
    color: hsl(var(--foreground));
    font-family: var(--font-body);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
    background-image: radial-gradient(
      1100px 560px at 50% -8%,
      rgba(79, 175, 130, 0.07),
      transparent 60%
    );
    background-attachment: fixed;
  }

  h1,
  h2,
  h3,
  h4,
  .font-display {
    font-family: var(--font-heading);
    letter-spacing: -0.01em;
  }
}

@layer components {
  /* ---------- Cards ---------- */
  .card-float {
    background-color: rgba(255, 255, 255, 0.82);
    border: 1px solid rgba(255, 255, 255, 0.65);
    border-radius: 20px;
    box-shadow:
      0 1px 2px rgba(16, 24, 22, 0.03),
      0 18px 40px -14px rgba(16, 24, 22, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
  }

  .card-float-lg {
    background-color: rgba(255, 255, 255, 0.82);
    border: 1px solid rgba(255, 255, 255, 0.65);
    border-radius: 24px;
    box-shadow:
      0 1px 3px rgba(16, 24, 22, 0.04),
      0 24px 48px -16px rgba(16, 24, 22, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
  }

  .card-inner {
    background-color: #f4f7f5;
    border: 1px solid #eef1f0;
    border-radius: 16px;
  }

  .dark .card-float,
  .dark .card-float-lg {
    background-color: rgba(22, 34, 30, 0.62);
    border: 1px solid rgba(255, 255, 255, 0.06);
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.3),
      0 22px 48px -16px rgba(0, 0, 0, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }

  .dark .card-inner {
    background-color: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .dark .bg-brand-soft {
    background-color: rgba(79, 175, 130, 0.16);
  }

  .dark .bg-brand-softer {
    background-color: rgba(79, 175, 130, 0.1);
  }

  /* ---------- Inputs ---------- */
  .input-float {
    width: 100%;
    height: 52px;
    border: 1px solid #ebeeec;
    border-radius: 16px;
    background-color: #fff;
    padding: 0 16px;
    font-size: 14px;
    font-weight: 450;
    color: #1a2f2a;
    outline: none;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease,
      background-color 0.15s ease;
    appearance: none;
  }

  .input-float::placeholder {
    color: rgba(26, 47, 42, 0.38);
  }

  .input-float:hover {
    border-color: #dde3df;
  }

  .input-float:focus {
    border-color: #4faf82;
    box-shadow: 0 0 0 4px rgba(79, 175, 130, 0.12);
    background-color: #fff;
  }

  select.input-float {
    background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%237A8B85' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 16px center;
    padding-right: 40px;
  }

  .dark .input-float {
    background-color: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.08);
    color: hsl(var(--c-ink));
  }

  .dark .input-float::placeholder {
    color: rgba(255, 255, 255, 0.35);
  }

  .dark select.input-float {
    background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23a8b5b0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  }

  /* ---------- Buttons ---------- */
  .btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: linear-gradient(135deg, #54b88e, #42a577);
    color: #fff;
    font-weight: 500;
    font-size: 14px;
    border-radius: 14px;
    padding: 13px 22px;
    border: none;
    cursor: pointer;
    box-shadow:
      0 6px 18px -5px rgba(79, 175, 130, 0.45),
      inset 0 1px 0 rgba(255, 255, 255, 0.18);
    transition:
      transform 0.1s ease,
      box-shadow 0.15s ease,
      filter 0.15s ease;
  }

  .btn-primary:hover {
    filter: brightness(1.05);
    box-shadow:
      0 10px 24px -5px rgba(79, 175, 130, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.22);
  }

  .btn-primary:active {
    transform: scale(0.97);
  }

  .btn-primary:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    filter: none;
  }

  .btn-ghost {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: #fff;
    color: #1a2f2a;
    font-weight: 500;
    font-size: 14px;
    border: 1px solid #ebeeec;
    border-radius: 14px;
    padding: 11px 18px;
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      background-color 0.15s ease,
      transform 0.1s ease;
  }

  .btn-ghost:hover {
    border-color: #dde3df;
    background-color: #f9fafb;
  }

  .btn-ghost:active {
    transform: scale(0.97);
  }

  .dark .btn-ghost {
    background: rgba(255, 255, 255, 0.04);
    color: hsl(var(--c-ink));
    border-color: rgba(255, 255, 255, 0.08);
  }

  .btn-link {
    color: #4faf82;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: color 0.15s ease;
    background: none;
    border: none;
    padding: 0;
  }

  .btn-link:hover {
    color: #3b9a6e;
  }

  .btn-link.danger {
    color: #c56b6b;
  }

  .btn-link.danger:hover {
    color: #b05858;
  }

  /* ---------- Pills & chips ---------- */
  .nav-tab {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 8px 14px;
    border-radius: 999px;
    font-size: 13.5px;
    font-weight: 500;
    color: #7a8b85;
    white-space: nowrap;
    transition:
      color 0.15s ease,
      background-color 0.15s ease;
    border: none;
    background: transparent;
    cursor: pointer;
  }

  .nav-tab:hover {
    color: #465550;
  }

  .nav-tab.active {
    background-color: #e8f5ee;
    color: #1a3c34;
  }

  .dark .nav-tab {
    color: rgba(255, 255, 255, 0.55);
  }

  .dark .nav-tab:hover {
    color: rgba(255, 255, 255, 0.8);
  }

  .dark .nav-tab.active {
    background-color: rgba(79, 175, 130, 0.18);
    color: hsl(var(--c-ink));
  }

  .cond-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 14px;
    border-radius: 999px;
    font-size: 14px;
    font-weight: 500;
    border: 1.5px solid #ebeeec;
    background: #fff;
    color: #465550;
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      background-color 0.15s ease,
      transform 0.1s ease,
      box-shadow 0.15s ease;
  }

  .cond-pill:hover {
    border-color: #c8d4ce;
    box-shadow: 0 2px 8px -2px rgba(16, 24, 22, 0.06);
  }

  .cond-pill:active {
    transform: scale(0.96);
  }

  .toggle-chip {
    display: inline-flex;
    align-items: center;
    padding: 8px 14px;
    border-radius: 999px;
    font-size: 13.5px;
    font-weight: 500;
    border: 1.5px solid #ebeeec;
    background: #fff;
    color: #465550;
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      background-color 0.15s ease,
      color 0.15s ease,
      transform 0.1s ease;
  }

  .toggle-chip:hover {
    border-color: #c8d4ce;
  }

  .toggle-chip:active {
    transform: scale(0.96);
  }

  .dark .cond-pill,
  .dark .toggle-chip {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.08);
    color: hsl(var(--c-ink-soft));
  }

  /*
   * Soft brand wash laid over a card's own surface.
   *
   * This is a CSS class rather than Tailwind gradient utilities because
   * `from-*` / `via-*` stop utilities resolve to one literal color and ignore
   * the `.dark .bg-brand-softer` override — so a light mint stop stayed light
   * in dark mode and washed the whole card out white.
   */
  .card-sheen {
    background-image: linear-gradient(
      to bottom right,
      #f0f9f4,
      hsl(var(--background)) 50%,
      hsl(var(--background))
    );
  }

  .dark .card-sheen {
    background-image: linear-gradient(
      to bottom right,
      rgba(79, 175, 130, 0.14),
      hsl(var(--background)) 50%,
      hsl(var(--background))
    );
  }

  .modal-sheen {
    background-image: linear-gradient(to bottom, #f0f9f4, #ffffff);
  }

  .dark .modal-sheen {
    background-image: linear-gradient(to bottom, rgba(79, 175, 130, 0.1), transparent 60%);
  }

  /* ---------- Alert surfaces ---------- */
  .warn-soft {
    background-color: #fbeaec;
  }

  .dark .warn-soft {
    background-color: rgba(197, 107, 107, 0.16);
  }

  .amber-soft {
    background-color: #fbf0e3;
  }

  .dark .amber-soft {
    background-color: rgba(184, 134, 59, 0.16);
  }

  /* ---------- Misc ---------- */
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #eef1f0;
    border-top-color: #4faf82;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
}

@layer utilities {
  .font-500 {
    font-weight: 500;
  }
  .font-600 {
    font-weight: 600;
  }
  .font-700 {
    font-weight: 700;
  }

  .font-mono-data {
    font-family: var(--font-mono);
  }

  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }

  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
}

input[type='range'].traccia-slider {
  appearance: none;
  height: 10px;
  border-radius: 999px;
  outline: none;
}

input[type='range'].traccia-slider::-webkit-slider-thumb {
  appearance: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #fff;
  border: 3px solid #4faf82;
  cursor: pointer;
  box-shadow:
    0 2px 8px rgba(79, 175, 130, 0.3),
    0 1px 3px rgba(16, 24, 22, 0.08);
  transition:
    transform 0.1s ease,
    box-shadow 0.15s ease;
}

input[type='range'].traccia-slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
  box-shadow:
    0 4px 14px rgba(79, 175, 130, 0.4),
    0 1px 3px rgba(16, 24, 22, 0.1);
}

input[type='range'].traccia-slider::-webkit-slider-thumb:active {
  transform: scale(1.05);
}

input[type='range'].traccia-slider::-moz-range-thumb {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #fff;
  border: 3px solid #4faf82;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(79, 175, 130, 0.3);
}

@media print {
  .no-print {
    display: none !important;
  }
  .print-only {
    display: block !important;
  }
}

.print-only {
  display: none;
}

/* ---------- Docs page (rendered markdown) ---------- */
.docs-body {
  color: hsl(var(--c-ink-soft));
  font-size: 14px;
  line-height: 1.7;
}

.docs-body h1 {
  font-size: 26px;
  font-weight: 600;
  color: hsl(var(--c-ink));
  margin-bottom: 12px;
}

.docs-body h2 {
  font-size: 20px;
  font-weight: 600;
  color: hsl(var(--c-ink));
  margin: 28px 0 10px;
  padding-top: 20px;
  border-top: 1px solid hsl(var(--c-line-soft));
}

.docs-body h3 {
  font-size: 16px;
  font-weight: 600;
  color: hsl(var(--c-ink));
  margin: 20px 0 8px;
}

.docs-body h4 {
  font-size: 14px;
  font-weight: 600;
  color: hsl(var(--c-ink));
  margin: 16px 0 6px;
}

.docs-body p {
  margin-bottom: 12px;
}

.docs-body ul,
.docs-body ol {
  list-style: revert;
  padding-left: 22px;
  margin-bottom: 12px;
}

.docs-body li {
  margin-bottom: 5px;
}

.docs-body a {
  color: #3b9a6e;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.docs-body strong {
  color: hsl(var(--c-ink));
  font-weight: 600;
}

.docs-body code {
  font-family: var(--font-mono);
  font-size: 12.5px;
  background: hsl(var(--c-surface2));
  border-radius: 6px;
  padding: 1.5px 5px;
}

.docs-body pre {
  background: hsl(var(--c-surface2));
  border: 1px solid hsl(var(--c-line-soft));
  border-radius: 14px;
  padding: 14px 16px;
  overflow-x: auto;
  margin-bottom: 14px;
}

.docs-body pre code {
  background: none;
  padding: 0;
}

.docs-body hr {
  border: none;
  border-top: 1px solid hsl(var(--c-line-soft));
  margin: 24px 0;
}

.docs-body blockquote {
  border-left: 2px solid #4faf82;
  padding-left: 14px;
  color: hsl(var(--c-ink-soft));
  margin-bottom: 12px;
}

.docs-table-wrap,
.docs-body table {
  display: block;
  overflow-x: auto;
  max-width: 100%;
}

.docs-body table {
  border-collapse: collapse;
  margin-bottom: 16px;
  font-size: 13px;
}

.docs-body th,
.docs-body td {
  border: 1px solid hsl(var(--c-line));
  padding: 7px 10px;
  text-align: left;
  white-space: nowrap;
}

.docs-body th {
  background: hsl(var(--c-surface2));
  font-weight: 600;
  color: hsl(var(--c-ink));
}

/* ---------- Accessibility ---------- */

/*
 * Keyboard users must always be able to see where they are. Tailwind's reset
 * removes the UA outline, so every interactive surface gets it back explicitly.
 */
.btn-primary:focus-visible,
.btn-ghost:focus-visible,
.btn-link:focus-visible,
.nav-tab:focus-visible,
.cond-pill:focus-visible,
.toggle-chip:focus-visible,
.input-float:focus-visible,
a:focus-visible,
button:focus-visible,
select:focus-visible,
textarea:focus-visible,
[tabindex]:focus-visible {
  outline: 2px solid #4faf82;
  outline-offset: 2px;
}

input[type='range'].traccia-slider:focus-visible::-webkit-slider-thumb {
  outline: 2px solid #4faf82;
  outline-offset: 2px;
}

.skip-link {
  position: absolute;
  left: 50%;
  top: 8px;
  transform: translate(-50%, -150%);
  z-index: 100;
  background: #fff;
  color: #1a2f2a;
  border: 1px solid #ebeeec;
  border-radius: 12px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 500;
  transition: transform 0.15s ease;
}

.skip-link:focus {
  transform: translate(-50%, 0);
}

/*
 * Respect the OS setting. The app leans on motion for warmth, but that warmth
 * is nausea for some users — and this is an app for people who are unwell.
 */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### `tailwind.config.js`

```jsx
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    container: { center: true, padding: '2rem', screens: { '2xl': '1400px' } },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Traccia brand scale
        brand: {
          DEFAULT: '#4FAF82',
          dark: '#3B9A6E',
          soft: '#E8F5EE',
          softer: '#F0F9F4',
        },
        ink: {
          DEFAULT: 'hsl(var(--c-ink))',
          soft: 'hsl(var(--c-ink-soft))',
        },
        canvas: 'hsl(var(--c-canvas))',
        line: {
          DEFAULT: 'hsl(var(--c-line))',
          soft: 'hsl(var(--c-line-soft))',
        },
      },
      backgroundColor: {
        'brand-soft': '#E8F5EE',
        'brand-softer': '#F0F9F4',
      },
      textColor: {
        'brand-dark': '#3B9A6E',
        'ink-soft': 'hsl(var(--c-ink-soft))',
      },
      borderColor: {
        'line-soft': 'hsl(var(--c-line-soft))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        heading: ['var(--font-heading)'],
        body: ['var(--font-body)'],
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
```

### `vite.config.js`

```jsx
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(process.cwd(), './src') },
  },
  server: { port: 5180 },
})
```

### `eslint.config.js`

```jsx
import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist', 'node_modules'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/prop-types': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-unused-vars': [
        'error',
        // ignoreRestSiblings allows `const { drop, ...keep } = obj` — the idiom
        // used to strip database-only columns before writing a record back.
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      'no-empty': ['error', { allowEmptyCatch: true }],
      // A concise-body arrow returns its expression, and React treats an effect's
      // return value as a cleanup function — `useEffect(() => doThing(), [])`
      // then crashes with "destroy is not a function". Require a block body.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.name='useEffect'] > ArrowFunctionExpression[body.type!='BlockStatement']",
          message:
            'useEffect callbacks must use a block body: a concise arrow returns its value, which React mistakes for a cleanup function.',
        },
      ],
    },
  },
]
```

### `package.json`

```json
{
  "name": "traccia",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "format": "prettier --write \"src/**/*.{js,jsx,css}\"",
    "lint": "eslint ."
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.116.0",
    "@tanstack/react-query": "^5.59.0",
    "dompurify": "^3.4.15",
    "framer-motion": "^11.11.0",
    "lucide-react": "^0.446.0",
    "marked": "^18.0.13",
    "next-themes": "^0.3.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2",
    "recharts": "^2.12.7"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.5",
    "@vitejs/plugin-react": "^4.3.2",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.39.5",
    "eslint-plugin-react": "^7.37.5",
    "eslint-plugin-react-hooks": "^7.1.1",
    "eslint-plugin-react-refresh": "^0.5.6",
    "globals": "^17.12.0",
    "postcss": "^8.4.47",
    "prettier": "^3.3.3",
    "tailwindcss": "^3.4.13",
    "vite": "^5.4.8"
  }
}
```
