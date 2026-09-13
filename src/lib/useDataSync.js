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
