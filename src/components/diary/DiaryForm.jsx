import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Sparkles, ShieldCheck, AlertTriangle } from 'lucide-react'
import { db } from '@/api/client'
import { useLanguage } from '@/lib/LanguageContext'
import { t } from '@/lib/translations'
import { todayISO } from '@/lib/dateUtils'
import {
  getCondition,
  getPainBadges,
  getMedicationOptions,
  getBadgeStyle,
  MOOD_LEVELS,
  NO_PAIN_MODULES,
} from '@/lib/conditions'
import { toast } from '@/components/ui/toast-bus'
import RefBadge from '@/components/RefBadge'
import ModuleFields from './ModuleFields'

const DEFAULT_FORM = {
  pain: 3,
  energy: 5,
  sleep_hours: '',
  medication_taken: '',
  mood: 3,
  notes: '',
}

export default function DiaryForm({ activeModule, onSaved }) {
  const { lang } = useLanguage()
  const noneLabel = t('none_of_these', lang)
  const condition = activeModule ? getCondition(activeModule, lang) : null
  const hidesPain = activeModule && NO_PAIN_MODULES.includes(activeModule)
  const painBadges = getPainBadges(lang)
  const medicationOptions = getMedicationOptions(lang)

  const [form, setForm] = useState(DEFAULT_FORM)
  const [alarms, setAlarms] = useState([noneLabel])
  const [moduleData, setModuleData] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [existingEntry, setExistingEntry] = useState(null)

  // Load today's entry for the selected module, if there is one, so a second
  // visit edits it instead of silently logging the same day twice.
  useEffect(() => {
    let cancelled = false

    db.entities.DiaryEntry.filter(
      { entry_date: todayISO(), module: activeModule || 'base' },
      '-created_date',
      1
    )
      .then(([entry]) => {
        if (cancelled) return
        setSaved(false)
        setExistingEntry(entry || null)
        if (entry) {
          setForm({
            pain: entry.pain ?? 3,
            energy: entry.energy ?? 5,
            sleep_hours: entry.sleep_hours ?? '',
            medication_taken: entry.medication_taken || '',
            mood: entry.mood ?? 3,
            notes: entry.notes || '',
          })
          setAlarms(entry.alarm_symptoms?.length ? entry.alarm_symptoms : [noneLabel])
          setModuleData(entry.module_data || {})
        } else {
          setForm(DEFAULT_FORM)
          setAlarms([noneLabel])
          setModuleData({})
        }
      })
      .catch(() => {
        if (cancelled) return
        setSaved(false)
        setExistingEntry(null)
        setForm(DEFAULT_FORM)
        setAlarms([noneLabel])
        setModuleData({})
      })

    return () => {
      cancelled = true
    }
  }, [activeModule, noneLabel])

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const toggleAlarm = (symptom) => {
    setAlarms((prev) => {
      if (symptom === noneLabel) return [noneLabel]
      const withoutNone = prev.filter((s) => s !== noneLabel)
      return withoutNone.includes(symptom)
        ? withoutNone.filter((s) => s !== symptom)
        : [...withoutNone, symptom]
    })
    setSaved(false)
  }

  const hasAlarm = alarms.some((s) => s !== noneLabel)
  const painBadge = painBadges.find((b) => form.pain >= b.range[0] && form.pain <= b.range[1])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const payload = {
        module: activeModule || 'base',
        entry_date: todayISO(),
        pain: hidesPain ? null : form.pain,
        energy: form.energy,
        sleep_hours: form.sleep_hours ? parseFloat(form.sleep_hours) : null,
        medication_taken: form.medication_taken || null,
        mood: form.mood,
        notes: form.notes || null,
        alarm_symptoms: condition ? alarms : [],
        module_data: condition ? moduleData : {},
      }

      // One entry per day per module: saving again updates it rather than adding
      // a duplicate, which would otherwise skew every average on the Trends page.
      // With an account this is a real upsert against a unique constraint, so
      // two devices saving the same day cannot race into two rows.
      const entry = db.entities.DiaryEntry.upsert
        ? await db.entities.DiaryEntry.upsert(payload)
        : existingEntry
          ? await db.entities.DiaryEntry.update(existingEntry.id, payload)
          : await db.entities.DiaryEntry.create(payload)
      setExistingEntry(entry)

      setSaved(true)
      onSaved && onSaved()
      toast({
        title: lang === 'it' ? 'Diario salvato' : 'Diary saved',
        description: existingEntry
          ? lang === 'it'
            ? 'Registrazione di oggi aggiornata'
            : 'Your entry for today was updated'
          : lang === 'it'
            ? 'Registrazione di oggi salvata con successo'
            : 'Your entry for today was saved',
      })
    } catch (err) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: lang === 'it' ? 'Salvataggio non riuscito' : 'Save failed',
        description: String(err?.message || err),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {condition && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-[20px] border p-5 sm:p-6"
          style={{ borderColor: condition.color + '30', backgroundColor: condition.color + '08' }}
        >
          <div className="flex items-center gap-2.5 mb-2">
            <span className="text-[22px]">{condition.emoji}</span>
            <h2 className="font-display text-[19px] font-600 text-ink">
              {t('whats_this', lang)} {condition.label}
            </h2>
          </div>
          <p className="text-[13.5px] leading-relaxed text-ink-soft">{condition.definition}</p>
        </motion.div>
      )}

      <div className="card-float-lg p-5 sm:p-7">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-[20px] font-600 text-ink">{t('diary_today', lang)}</h2>
          <Sparkles className="w-4 h-4 text-brand/60" strokeWidth={2} />
        </div>

        {condition && (
          <div className="mb-6 pb-6 border-b border-line-soft">
            <p className="text-[13px] font-600 text-ink mb-3">{t('had_today', lang)}</p>
            <div className="flex flex-wrap gap-2">
              {[noneLabel, ...condition.alarmSymptoms].map((symptom) => {
                const selected = alarms.includes(symptom)
                const selectedStyle =
                  symptom === noneLabel
                    ? { backgroundColor: '#4FAF82', borderColor: '#4FAF82', color: '#fff' }
                    : { backgroundColor: '#C56B6B', borderColor: '#C56B6B', color: '#fff' }
                return (
                  <button
                    key={symptom}
                    type="button"
                    onClick={() => toggleAlarm(symptom)}
                    className="toggle-chip"
                    style={selected ? selectedStyle : undefined}
                  >
                    {symptom}
                  </button>
                )
              })}
            </div>

            <AnimatePresence>
              {hasAlarm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 rounded-2xl p-4 flex items-start gap-2.5 warn-soft"
                  style={{ border: '1px solid #C56B6B30' }}
                >
                  <AlertTriangle
                    className="w-[18px] h-[18px] text-[#C56B6B] shrink-0 mt-0.5"
                    strokeWidth={2}
                  />
                  <p className="text-[13px] text-[#8A3A45] leading-relaxed font-500">
                    {t('alarm_warning', lang)}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
          {hidesPain ? (
            <div className="card-inner p-4 sm:col-span-2">
              <p className="text-[13px] text-ink-soft leading-relaxed">
                <span className="font-600 text-brand-dark">{t('pain', lang)}:</span>{' '}
                {t('pain_hidden_note', lang)}
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <label className="text-[13px] font-500 text-ink/70">{t('pain', lang)}</label>
                  {painBadge && <RefBadge badge={painBadge} />}
                </div>
                <span className="font-mono-data text-[15px] font-600 text-ink tabular-nums">
                  {form.pain}
                  <span className="text-ink/35 font-400">/10</span>
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={10}
                value={form.pain}
                onChange={(e) => update('pain', parseInt(e.target.value))}
                className="traccia-slider w-full"
                style={{
                  background: `linear-gradient(to right, ${
                    getBadgeStyle(painBadge?.level).color || '#4FAF82'
                  } ${(form.pain / 10) * 100}%, #EBEEEC ${(form.pain / 10) * 100}%)`,
                }}
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-[13px] font-500 text-ink/70">{t('energy', lang)}</label>
              <span className="font-mono-data text-[15px] font-600 text-ink tabular-nums">
                {form.energy}
                <span className="text-ink/35 font-400">/10</span>
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              value={form.energy}
              onChange={(e) => update('energy', parseInt(e.target.value))}
              className="traccia-slider w-full"
              style={{
                background: `linear-gradient(to right, #4FAF82 ${(form.energy / 10) * 100}%, #EBEEEC ${
                  (form.energy / 10) * 100
                }%)`,
              }}
            />
          </div>

          <div>
            <label className="text-[13px] font-500 text-ink/70 block mb-1.5">
              {t('sleep_hours', lang)}
            </label>
            <input
              type="number"
              min={0}
              max={24}
              step="0.5"
              value={form.sleep_hours}
              onChange={(e) => update('sleep_hours', e.target.value)}
              placeholder={t('sleep_placeholder', lang)}
              className="input-float font-mono-data"
            />
          </div>

          <div>
            <label className="text-[13px] font-500 text-ink/70 block mb-1.5">
              {t('medication_taken', lang)}
            </label>
            <select
              value={form.medication_taken}
              onChange={(e) => update('medication_taken', e.target.value)}
              className="input-float"
            >
              <option value="">—</option>
              {medicationOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6">
          <label className="text-[13px] font-500 text-ink/70 block mb-2.5">
            {t('mood_today', lang)}
          </label>
          <div className="flex gap-2.5">
            {MOOD_LEVELS.map((level) => {
              const selected = form.mood === level.value
              return (
                <motion.button
                  key={level.value}
                  type="button"
                  onClick={() => update('mood', level.value)}
                  whileTap={{ scale: 0.92 }}
                  animate={{ scale: selected ? 1.04 : 1 }}
                  className="flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl border-[1.5px] transition-colors duration-150"
                  style={
                    selected
                      ? { borderColor: '#4FAF82', backgroundColor: '#E8F5EE' }
                      : { borderColor: '#EBEEEC', backgroundColor: 'hsl(var(--card))' }
                  }
                >
                  <span className="text-[24px] leading-none">{level.emoji}</span>
                </motion.button>
              )
            })}
          </div>
        </div>

        {condition && (
          <div className="mt-6 pt-6 border-t border-line-soft">
            <h3 className="font-display text-[17px] font-600 text-ink mb-4 flex items-center gap-2">
              <span className="text-[18px]">{condition.emoji}</span> {t('details_for', lang)}{' '}
              {condition.label}
            </h3>
            <ModuleFields fields={condition.fields} data={moduleData} onChange={setModuleData} />
          </div>
        )}

        <div className="mt-6">
          <label className="text-[13px] font-500 text-ink/70 block mb-1.5">
            {t('personal_notes', lang)}
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => update('notes', e.target.value.slice(0, 500))}
            placeholder={t('notes_placeholder', lang)}
            rows={3}
            className="input-float !h-auto py-3.5 leading-relaxed resize-none"
          />
          <div className="text-right mt-1.5">
            <span className="font-mono-data text-[11px] text-ink/35">{form.notes.length}/500</span>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? (
                <span className="spinner !w-4 !h-4 !border-2 !border-white/40 !border-t-white" />
              ) : (
                <>
                  <Check className="w-4 h-4" strokeWidth={2.6} />
                  {t('save_entry', lang)}
                </>
              )}
            </button>
            <AnimatePresence>
              {saved && (
                <motion.span
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-[13px] font-500 text-brand-dark flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" strokeWidth={2.6} /> {t('saved_success', lang)}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <p className="flex items-center gap-1.5 text-[11.5px] text-ink/40 ml-auto">
            <ShieldCheck className="w-3.5 h-3.5" strokeWidth={2} />
            {lang === 'it'
              ? 'I tuoi dati sono al sicuro e sempre riservati'
              : 'Your data is safe and always private'}
          </p>
        </div>
      </div>
    </div>
  )
}
