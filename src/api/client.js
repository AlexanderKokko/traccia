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
