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
