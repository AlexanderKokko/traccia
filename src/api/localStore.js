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
