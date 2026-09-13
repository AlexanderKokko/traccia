import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ExternalLink } from 'lucide-react'
import { useLanguage } from '@/lib/LanguageContext'
import { t } from '@/lib/translations'
import { getConditionList } from '@/lib/conditions'
import { getIssUrl } from '@/lib/issUrls'

export default function Contents() {
  const { lang } = useLanguage()
  const conditions = getConditionList(lang)
  const [filter, setFilter] = useState('all')

  const cards = (
    filter === 'all' ? conditions : conditions.filter((c) => c.key === filter)
  ).flatMap((condition) =>
    condition.contentCards.map((card, cardIndex) => ({ ...card, condition, cardIndex }))
  )

  return (
    <div>
      <h1 className="font-display text-[28px] sm:text-[34px] font-600 text-ink leading-[1.12] tracking-tight mb-1">
        {t('contents_title', lang)}
      </h1>
      <p className="text-ink/55 text-[14px] mb-5">{t('contents_subtitle', lang)}</p>

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className="toggle-chip"
          style={
            filter === 'all'
              ? { backgroundColor: '#4FAF82', borderColor: '#4FAF82', color: '#fff' }
              : undefined
          }
        >
          {t('all_filter', lang)}
        </button>
        {conditions.map((condition) => (
          <button
            key={condition.key}
            onClick={() => setFilter(condition.key)}
            className="toggle-chip"
            style={
              filter === condition.key
                ? {
                    backgroundColor: condition.color,
                    borderColor: condition.color,
                    color: '#fff',
                  }
                : undefined
            }
          >
            <span>{condition.emoji}</span>&nbsp;{condition.label}
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <AnimatePresence mode="popLayout">
          {cards.map((card, i) => {
            const url = getIssUrl(card.condition.key, card.cardIndex)
            return (
              <motion.div
                key={`${card.condition.key}-${card.cardIndex}`}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.3, delay: i * 0.03 }}
                className="card-float p-5 relative overflow-hidden"
              >
                <div
                  className="absolute top-0 left-0 w-full h-1"
                  style={{ backgroundColor: card.condition.color }}
                />
                <div className="flex items-center gap-2 mb-2.5 mt-1">
                  <div
                    className="flex items-center justify-center w-8 h-8 rounded-xl text-[16px]"
                    style={{ backgroundColor: card.condition.color + '14' }}
                  >
                    {card.condition.emoji}
                  </div>
                  <span
                    className="text-[11px] font-500 px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: card.condition.color + '14',
                      color: card.condition.color,
                    }}
                  >
                    {card.condition.label}
                  </span>
                </div>

                <h3 className="font-display text-[17px] font-600 text-ink mb-2 leading-snug">
                  {card.title}
                </h3>
                <p className="text-[13px] text-ink-soft leading-relaxed">{card.body}</p>

                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[12.5px] font-500 text-brand-dark hover:text-brand transition-colors mt-3"
                  >
                    {t('iss_link', lang)} <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
                  </a>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
