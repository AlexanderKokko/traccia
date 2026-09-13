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
