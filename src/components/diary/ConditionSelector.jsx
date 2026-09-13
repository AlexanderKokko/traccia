import { motion } from 'framer-motion'
import { useLanguage } from '@/lib/LanguageContext'
import { t } from '@/lib/translations'
import { getConditionList } from '@/lib/conditions'

export default function ConditionSelector({ activeModule, onSelect }) {
  const { lang } = useLanguage()
  const conditions = getConditionList(lang)

  return (
    <div>
      <p className="text-[13px] text-ink/55 mb-3.5 leading-relaxed">
        {t('condition_select_prompt', lang)}
      </p>
      <div className="flex flex-wrap gap-2">
        {conditions.map((condition) => {
          const active = activeModule === condition.key
          return (
            <motion.button
              key={condition.key}
              type="button"
              onClick={() => onSelect(active ? null : condition.key)}
              whileTap={{ scale: 0.95 }}
              className="cond-pill"
              style={
                active
                  ? {
                      borderColor: condition.color,
                      backgroundColor: condition.color + '14',
                      color: condition.color,
                      fontWeight: 600,
                    }
                  : undefined
              }
            >
              <span className="text-[16px] leading-none">{condition.emoji}</span>
              {condition.label}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
