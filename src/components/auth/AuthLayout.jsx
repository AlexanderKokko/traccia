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
