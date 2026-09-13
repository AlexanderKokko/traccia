import { CloudOff } from 'lucide-react'
import { isCloudBacked } from '@/api/client'
import { useLanguage } from '@/lib/LanguageContext'
import { t } from '@/lib/translations'

/**
 * Without Supabase credentials the app still runs, but against the device-local
 * store: no account, no sync. That has to be visible — someone must never
 * believe a diary is backed up when it only exists in one browser.
 */
export default function LocalModeBanner() {
  const { lang } = useLanguage()
  if (isCloudBacked) return null

  return (
    <div className="amber-soft border-b border-[#B8863B]/20 no-print">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-2">
        <div className="flex items-start gap-2">
          <CloudOff className="w-[15px] h-[15px] text-[#B8863B] shrink-0 mt-0.5" strokeWidth={2} />
          <p className="text-[11.5px] leading-relaxed text-[#7A5623]">
            <span className="font-600">{t('sync_offline_title', lang)}</span>{' '}
            {t('sync_offline_body', lang)}
          </p>
        </div>
      </div>
    </div>
  )
}
