import { Info } from 'lucide-react'
import { useLanguage } from '@/lib/LanguageContext'
import { t } from '@/lib/translations'

export default function DisclaimerBanner() {
  const { lang } = useLanguage()
  return (
    <div className="bg-brand-softer border-b border-line/70 no-print">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-2">
        <div className="flex items-start gap-2">
          <Info className="w-[15px] h-[15px] text-brand-dark shrink-0 mt-0.5" strokeWidth={2} />
          <p className="text-[11.5px] leading-relaxed text-ink/55">{t('disclaimer', lang)}</p>
        </div>
      </div>
    </div>
  )
}
