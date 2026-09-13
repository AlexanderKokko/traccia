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
