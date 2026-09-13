import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, X, Trash2, Pill, Bell, Check } from 'lucide-react'
import { db } from '@/api/client'
import { useLanguage } from '@/lib/LanguageContext'
import { useDataSync } from '@/lib/useDataSync'
import { t } from '@/lib/translations'
import { getFrequencies } from '@/lib/conditions'
import { toast } from '@/components/ui/toast-bus'

const EMPTY = { name: '', dosage: '', time: '', frequency: 'ogni_giorno' }

export default function Therapies() {
  const { lang } = useLanguage()
  const frequencies = getFrequencies(lang)

  const [therapies, setTherapies] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [now, setNow] = useState(new Date())
  const [acknowledged, setAcknowledged] = useState([])

  const load = () => {
    db.entities.Therapy.list('-created_date')
      .then(setTherapies)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])
  useDataSync(load)

  const currentTime = now.toTimeString().slice(0, 5)

  // A daily medication is "due" within a 5-minute window around its time.
  const due = therapies.filter((th) => {
    if (th.frequency !== 'ogni_giorno' || !th.time) return false
    if (acknowledged.includes(th.id)) return false
    const [h, m] = th.time.split(':').map(Number)
    const [nh, nm] = currentTime.split(':').map(Number)
    return Math.abs(h * 60 + m - (nh * 60 + nm)) <= 5
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name) return
    try {
      await db.entities.Therapy.create(form)
      setForm(EMPTY)
      setFormOpen(false)
      load()
      toast({
        title: lang === 'it' ? 'Terapia salvata' : 'Therapy saved',
        description:
          lang === 'it' ? 'Farmaco aggiunto alla tua lista' : 'Medication added to your list',
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
    await db.entities.Therapy.delete(id)
    load()
  }

  /**
   * Dismisses the reminder for this dose. Persisting a medication history (and the
   * confirmation streak that goes with it) still needs a `MedicationLog` entity.
   */
  const markAsTaken = (therapy) => {
    setAcknowledged((prev) => [...prev, therapy.id])
    toast({
      title: lang === 'it' ? 'Segnato come preso' : 'Marked as taken',
      description: therapy.name,
    })
  }

  const frequencyLabel = (value) => frequencies.find((f) => f.value === value)?.label || value

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
        {t('therapies_title', lang)}
      </h1>

      <AnimatePresence>
        {due.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-[20px] p-5 mb-5 overflow-hidden relative"
            style={{ background: 'linear-gradient(135deg, #54B88E, #42A577)' }}
          >
            <div className="flex items-start gap-3 relative">
              <Bell className="w-5 h-5 text-white shrink-0 mt-0.5" strokeWidth={2} />
              <div className="flex-1 space-y-2">
                {due.map((therapy) => (
                  <div
                    key={therapy.id}
                    className="flex items-center justify-between flex-wrap gap-2"
                  >
                    <p className="text-white font-500 text-[13.5px]">
                      {t('med_time_to_take', lang)} <span className="font-600">{therapy.name}</span>
                      {therapy.dosage ? ` (${therapy.dosage})` : ''}
                    </p>
                    <button
                      onClick={() => markAsTaken(therapy)}
                      className="bg-white text-brand-dark font-500 px-3 py-1.5 rounded-lg text-[12px] hover:bg-brand-soft transition-colors flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> {t('mark_as_taken', lang)}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-4 gap-4">
        <p className="text-ink/55 text-[14px]">{t('therapies_subtitle', lang)}</p>
        <button onClick={() => setFormOpen(!formOpen)} className="btn-primary shrink-0">
          <Plus className="w-4 h-4" strokeWidth={2.4} />
          <span className="hidden sm:inline">{t('add_medication', lang)}</span>
        </button>
      </div>

      <AnimatePresence>
        {formOpen && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="card-float p-5 sm:p-6 mb-5 space-y-4 overflow-hidden"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[13px] font-500 text-ink/70 block mb-1.5">
                  {t('name_and_dosage', lang)}
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t('name_dosage_placeholder', lang)}
                  required
                  className="input-float"
                />
              </div>

              <div>
                <label className="text-[13px] font-500 text-ink/70 block mb-1.5">
                  {t('extra_dosage', lang)}
                </label>
                <input
                  type="text"
                  value={form.dosage}
                  onChange={(e) => setForm({ ...form, dosage: e.target.value })}
                  placeholder={t('extra_dosage_placeholder', lang)}
                  className="input-float"
                />
              </div>

              <div>
                <label className="text-[13px] font-500 text-ink/70 block mb-1.5">
                  {t('time_label', lang)}
                </label>
                <input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                  className="input-float font-mono-data"
                />
              </div>

              <div>
                <label className="text-[13px] font-500 text-ink/70 block mb-1.5">
                  {t('frequency_label', lang)}
                </label>
                <select
                  value={form.frequency}
                  onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                  className="input-float"
                >
                  {frequencies.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button type="submit" className="btn-primary">
                {t('save_medication', lang)}
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

      {therapies.length === 0 ? (
        <div className="card-float p-12 text-center">
          <Pill className="w-8 h-8 text-ink/25 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-ink/45 text-sm">{t('no_medications', lang)}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {therapies.map((therapy, i) => (
            <motion.div
              key={therapy.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="card-float p-4 flex items-center gap-4"
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-soft shrink-0">
                <Pill className="w-5 h-5 text-brand" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-500 text-ink">{therapy.name}</p>
                <p className="text-[12px] text-ink/50">
                  {therapy.dosage && <span>{therapy.dosage} · </span>}
                  {therapy.time && <span className="font-mono-data">{therapy.time} · </span>}
                  {frequencyLabel(therapy.frequency)}
                </p>
              </div>
              <button
                onClick={() => handleDelete(therapy.id)}
                aria-label={`${lang === 'en' ? 'Delete' : 'Elimina'} ${therapy.name}`}
                className="text-ink/35 hover:text-[#C56B6B] transition-colors shrink-0"
              >
                <Trash2 className="w-[17px] h-[17px]" strokeWidth={2} />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      <p className="text-[11.5px] text-ink/40 mt-4 italic leading-relaxed">
        {t('reminder_note', lang)}
      </p>
    </div>
  )
}
