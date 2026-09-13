import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Plus,
  X,
  Trash2,
  CalendarDays,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { db, resolveFileUrl } from '@/api/client'
import { useLanguage } from '@/lib/LanguageContext'
import { useDataSync } from '@/lib/useDataSync'
import { t } from '@/lib/translations'
import { todayISO, formatDateInput, daysUntil } from '@/lib/dateUtils'
import { getCondition, getDocTypes, getSpecialists } from '@/lib/conditions'
import { toast } from '@/components/ui/toast-bus'

export default function Appointments() {
  const { lang } = useLanguage()
  const docTypes = getDocTypes(lang)
  const specialists = getSpecialists(lang)

  const [documents, setDocuments] = useState([])
  const [appointments, setAppointments] = useState([])
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({ specialist: '', appointment_date: '' })
  const [fileUrls, setFileUrls] = useState({})

  // Returns nothing on purpose: it is passed straight to useEffect, and a
  // returned promise would be mistaken for a cleanup function.
  const load = () => {
    Promise.all([
      db.entities.MedicalDocument.list('-doc_date'),
      db.entities.Appointment.list('appointment_date'),
      db.entities.DiaryEntry.list('-entry_date', 60),
    ])
      .then(([docs, appts, diary]) => {
        setDocuments(docs)
        setAppointments(appts)
        setEntries(diary)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(load, [])
  useDataSync(load)

  useEffect(() => {
    let cancelled = false
    const created = []
    Promise.all(documents.map(async (d) => [d.id, await resolveFileUrl(d.file_url)])).then(
      (pairs) => {
        if (cancelled) return
        const map = {}
        pairs.forEach(([id, url]) => {
          if (url) {
            map[id] = url
            created.push(url)
          }
        })
        setFileUrls(map)
      }
    )
    return () => {
      cancelled = true
      created.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [documents])

  const pastDocuments = documents.filter((d) => d.doc_date < todayISO())
  const upcoming = appointments.filter((a) => a.appointment_date >= todayISO())
  const past = appointments.filter((a) => a.appointment_date < todayISO())

  const average = (rows, key) => {
    const values = rows.map((r) => r[key]).filter((v) => v != null)
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
  }

  const painDelta = (() => {
    const thisWeek = average(entries.slice(0, 7), 'pain')
    const lastWeek = average(entries.slice(7, 14), 'pain')
    if (thisWeek == null || lastWeek == null || lastWeek === 0) return null
    return ((thisWeek - lastWeek) / lastWeek) * 100
  })()
  const painRising = painDelta != null && painDelta > 15

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.specialist || !form.appointment_date) return
    try {
      // One appointment per specialist — a new one replaces the existing entry.
      const existing = appointments.find((a) => a.specialist === form.specialist)
      if (existing) await db.entities.Appointment.delete(existing.id)
      await db.entities.Appointment.create(form)
      setForm({ specialist: '', appointment_date: '' })
      setFormOpen(false)
      load()
      toast({
        title: lang === 'it' ? 'Controllo salvato' : 'Check-up saved',
        description:
          lang === 'it'
            ? 'Appuntamento aggiunto al tuo calendario'
            : 'Appointment added to your calendar',
      })
    } catch (err) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: lang === 'it' ? 'Salvataggio non riuscito' : 'Save failed',
        description: String(err?.message || err),
      })
    }
  }

  const handleDelete = async (id) => {
    await db.entities.Appointment.delete(id)
    load()
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-display text-[28px] sm:text-[34px] font-600 text-ink leading-[1.12] tracking-tight mb-6">
        {t('appointments_title', lang)}
      </h1>

      <AnimatePresence>
        {painRising && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl p-4 mb-5 flex items-start gap-2.5 amber-soft"
            style={{ border: '1px solid #B8863B30' }}
          >
            <AlertTriangle
              className="w-[18px] h-[18px] text-[#B8863B] shrink-0 mt-0.5"
              strokeWidth={2}
            />
            <p className="text-[13px] text-[#7A5623] leading-relaxed">
              {t('pain_increase_warning', lang)}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="card-float p-5 sm:p-6 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-[18px] font-600 text-ink">
            {t('upcoming_checkups', lang)}
          </h2>
          <button onClick={() => setFormOpen(!formOpen)} className="btn-ghost !py-2 !px-3.5">
            <Plus className="w-4 h-4" strokeWidth={2.4} /> {t('add_btn', lang)}
          </button>
        </div>

        <AnimatePresence>
          {formOpen && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleSubmit}
              className="grid sm:grid-cols-2 gap-4 mb-4 p-4 card-inner overflow-hidden"
            >
              <div>
                <label className="text-[13px] font-500 text-ink/70 block mb-1.5">
                  {t('with_whom', lang)}
                </label>
                <select
                  value={form.specialist}
                  onChange={(e) => setForm({ ...form, specialist: e.target.value })}
                  className="input-float"
                >
                  <option value="">{t('select_placeholder', lang)}</option>
                  {Object.entries(specialists).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[13px] font-500 text-ink/70 block mb-1.5">
                  {t('date_label', lang)}
                </label>
                <input
                  type="date"
                  value={form.appointment_date}
                  onChange={(e) => setForm({ ...form, appointment_date: e.target.value })}
                  className="input-float"
                />
              </div>

              <div className="sm:col-span-2 flex gap-2">
                <button type="submit" className="btn-primary">
                  {t('save_checkup', lang)}
                </button>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  aria-label={lang === 'en' ? 'Close form' : 'Chiudi il modulo'}
                  className="btn-ghost"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {upcoming.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CalendarDays className="w-7 h-7 text-ink/25 mb-2" strokeWidth={1.5} />
            <p className="text-ink/45 text-sm">{t('no_future_checkups', lang)}</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {upcoming.map((appointment, i) => {
              const inDays = daysUntil(appointment.appointment_date)
              return (
                <motion.div
                  key={appointment.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-3 p-4 card-inner"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-brand-soft">
                    <CalendarDays className="w-[18px] h-[18px] text-brand-dark" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-500 text-ink">
                      {specialists[appointment.specialist] || appointment.specialist}
                    </p>
                    <p className="text-[12px] text-ink/45 font-mono-data">
                      {formatDateInput(appointment.appointment_date, lang)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[13px] font-600 text-brand-dark font-mono-data px-2.5 py-1 rounded-full bg-brand-soft">
                      {inDays === 0
                        ? t('today', lang)
                        : inDays === 1
                          ? t('tomorrow', lang)
                          : t('in_days', lang).replace('{n}', inDays)}
                    </span>
                    <button
                      onClick={() => handleDelete(appointment.id)}
                      aria-label={`${lang === 'en' ? 'Delete check-up with' : 'Elimina controllo con'} ${
                        specialists[appointment.specialist] || appointment.specialist
                      }`}
                      className="text-ink/35 hover:text-[#C56B6B] transition-colors"
                    >
                      <Trash2 className="w-[16px] h-[16px]" strokeWidth={2} />
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}

        {past.length > 0 && (
          <div className="mt-3 pt-3 border-t border-line-soft space-y-1">
            {past.map((appointment) => (
              <div
                key={appointment.id}
                className="flex items-center justify-between p-2 text-[13px]"
              >
                <span className="text-ink/45">
                  {specialists[appointment.specialist]} —{' '}
                  {formatDateInput(appointment.appointment_date, lang)}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#B8863B]">{t('past_date_update', lang)}</span>
                  <button
                    onClick={() => handleDelete(appointment.id)}
                    aria-label={`${lang === 'en' ? 'Delete check-up with' : 'Elimina controllo con'} ${
                      specialists[appointment.specialist] || appointment.specialist
                    }`}
                    className="text-ink/35 hover:text-[#C56B6B]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card-float p-5 sm:p-6 mb-5">
        <h2 className="font-display text-[18px] font-600 text-ink mb-4">
          {t('past_checkups', lang)}
        </h2>
        {pastDocuments.length === 0 ? (
          <p className="text-ink/45 text-sm">{t('no_past_docs', lang)}</p>
        ) : (
          <div className="space-y-2.5">
            {pastDocuments.map((doc, i) => {
              const meta = docTypes[doc.doc_type] || { label: doc.doc_type, emoji: '📄' }
              const condition = doc.linked_condition
                ? getCondition(doc.linked_condition, lang)
                : null
              const url = fileUrls[doc.id]
              return (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-3 p-3.5 card-inner"
                >
                  <span className="text-[20px]">{meta.emoji}</span>
                  <div className="flex-1">
                    <p className="text-[13.5px] font-500 text-ink">{meta.label}</p>
                    <p className="text-[11.5px] text-ink/45 font-mono-data">
                      {formatDateInput(doc.doc_date, lang)}
                      {condition ? ` · ${condition.emoji} ${condition.label}` : ''}
                    </p>
                  </div>
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-link flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {t('open_file', lang)}
                    </a>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      <div className="card-float p-5 sm:p-6">
        <h2 className="font-display text-[18px] font-600 text-ink mb-4">
          {t('prepare_visit', lang)}
        </h2>
        <ul className="space-y-3">
          {[t('prep_1', lang), t('prep_2', lang), t('prep_3', lang), t('prep_4', lang)].map(
            (step, i) => (
              <li key={i} className="flex items-start gap-3">
                <CheckCircle2
                  className="w-[18px] h-[18px] text-brand shrink-0 mt-0.5"
                  strokeWidth={2}
                />
                <span className="text-[13.5px] text-ink-soft leading-relaxed">{step}</span>
              </li>
            )
          )}
        </ul>
      </div>
    </div>
  )
}
