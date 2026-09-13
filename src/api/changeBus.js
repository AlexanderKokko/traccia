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
