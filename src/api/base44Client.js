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
