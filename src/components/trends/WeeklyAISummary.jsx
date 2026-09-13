import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { db } from '@/api/client'
import { useLanguage } from '@/lib/LanguageContext'
import { t } from '@/lib/translations'
import { todayISO, subtractDays, formatShortDate } from '@/lib/dateUtils'
import { getCondition } from '@/lib/conditions'

export default function WeeklyAISummary({ entries }) {
  const { lang } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [failed, setFailed] = useState(false)
  const en = lang === 'en'

  const daysLogged = (() => {
    const today = todayISO()
    let count = 0
    for (let i = 0; i < 7; i++) {
      if (entries.find((e) => e.entry_date === subtractDays(today, i))) count++
    }
    return count
  })()

  const buildPayload = () => {
    const today = todayISO()
    const rows = []
    for (let i = 6; i >= 0; i--) {
      const date = subtractDays(today, i)
      const entry = entries.find((e) => e.entry_date === date)
      if (!entry) continue
      const condition = getCondition(entry.module, lang)
      const row = {
        date: formatShortDate(date, lang),
        condizione: condition ? condition.label : 'Base',
      }
      if (entry.pain != null) row.dolore = entry.pain
      if (entry.energy != null) row.energia = entry.energy
      if (entry.sleep_hours != null) row.sonno_ore = entry.sleep_hours
      if (entry.mood != null) row.umore = entry.mood
      if (entry.medication_taken) row.farmaci = entry.medication_taken
      if (entry.notes) row.note = entry.notes
      rows.push(row)
    }
    return rows
  }

  const generate = async () => {
    const payload = buildPayload()
    if (payload.length < 2) return
    setLoading(true)
    setFailed(false)

    // Same empathetic, explicitly non-diagnostic brief the hosted app sends.
    const prompt = en
      ? `You are a warm, empathetic assistant inside "Traccia", a symptom-diary app for people with chronic conditions. Read the user's diary data from the last 7 days (JSON) and write a short, encouraging weekly synthesis: one short headline (max 7 words) and a 2-3 sentence body. Gently describe patterns you notice (e.g. energy dipping on higher-pain days), acknowledge the effort of tracking, and stay non-clinical. Do NOT give medical advice, do NOT diagnose. Reply only with the JSON object. Data:\n${JSON.stringify(payload)}`
      : `Sei un assistente empatico dentro "Traccia", un'app di diario sintomi per persone con patologie croniche. Rileggi i dati del diario dell'utente degli ultimi 7 giorni (JSON) e scrivi una breve sintesi settimanale: un titolo breve (max 7 parole) e un corpo di 2-3 frasi. Descrivi con dolcezza gli andamenti osservati (es. energia calata nelle giornate con più dolore), riconosci l'impegno nel tenere il diario e resta non clinico. NON dare consigli medici, NON formulare diagnosi. Rispondi solo con l'oggetto JSON. Dati:\n${JSON.stringify(payload)}`

    try {
      const response = await db.integrations.Core.InvokeLLM({
        prompt,
        payload,
        lang,
        response_json_schema: {
          type: 'object',
          properties: { headline: { type: 'string' }, summary: { type: 'string' } },
          required: ['headline', 'summary'],
        },
      })
      setResult(response)
    } catch (err) {
      console.error(err)
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card-float p-5 sm:p-6 mb-5 overflow-hidden">
      <div>
        <h2 className="font-display text-[18px] font-600 text-ink flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand" strokeWidth={2} /> {t('ai_summary_title', lang)}
        </h2>
        <p className="text-[12px] text-ink/45 mt-0.5">{t('ai_summary_subtitle', lang)}</p>
      </div>

      {daysLogged < 2 ? (
        <p className="text-[13px] text-ink/50 italic mt-4 leading-relaxed">
          {t('ai_summary_empty', lang)}
        </p>
      ) : !result && !loading ? (
        <button onClick={generate} disabled={loading} className="btn-primary mt-4">
          <Sparkles className="w-4 h-4" strokeWidth={2} /> {t('ai_summary_cta', lang)}
        </button>
      ) : loading ? (
        <div className="flex items-center gap-2.5 mt-4 text-[13px] text-ink/55">
          <Loader2 className="w-4 h-4 animate-spin text-brand" strokeWidth={2} />
          {t('ai_summary_loading', lang)}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={result?.headline || 'err'}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="mt-4"
          >
            {failed ? (
              <div className="flex items-center gap-2 text-[13px] text-[#C56B6B] flex-wrap">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  {en ? 'Unable to generate. Try again.' : 'Generazione non riuscita. Riprova.'}
                </span>
                <button onClick={generate} className="btn-link ml-auto">
                  {t('ai_summary_regenerate', lang)}
                </button>
              </div>
            ) : (
              <>
                <p className="font-display text-[17px] font-600 text-ink mb-2 leading-snug">
                  {result.headline}
                </p>
                <p className="text-[13.5px] text-ink-soft leading-relaxed">{result.summary}</p>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {result && !failed && (
        <div className="flex items-center justify-between gap-3 mt-4">
          <p className="text-[11px] text-ink/40 italic leading-relaxed">
            {t('ai_summary_disclaimer', lang)}
          </p>
          <button
            onClick={generate}
            disabled={loading}
            className="btn-link flex items-center gap-1.5 shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} /> {t('ai_summary_regenerate', lang)}
          </button>
        </div>
      )}
    </div>
  )
}
