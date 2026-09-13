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
