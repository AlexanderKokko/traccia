import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { Leaf, ArrowRight, ChevronLeft, Check, Sun, Moon } from 'lucide-react'
import { db } from '@/api/client'
import { useLanguage } from '@/lib/LanguageContext'
import { t } from '@/lib/translations'
import { getConditionList } from '@/lib/conditions'

/** Every word capitalised — the saved display name is always presented this way. */
function capitalizeName(value) {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export default function OnboardingTour({ onDone, knownName = null }) {
  const { lang } = useLanguage()
  const { setTheme } = useTheme()

  // With an account the name came from sign-up, so the tour is conditions + theme.
  // In device-local mode there is no sign-up, so it still asks for a name first.
  const steps = knownName ? ['conditions', 'theme'] : ['name', 'conditions', 'theme']
  const [stepIndex, setStepIndex] = useState(0)
  const step = steps[stepIndex]
  const [name, setName] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const conditions = getConditionList(lang)
  const en = lang === 'en'

  const submitName = async (e) => {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      await db.auth.updateMe({ display_name: capitalizeName(name) })
    } catch (err) {
      console.error('Onboarding name save failed:', err)
      setError(
        en ? 'Save failed, but you can continue.' : 'Salvataggio non riuscito, ma puoi continuare.'
      )
    } finally {
      setBusy(false)
      setStepIndex(stepIndex + 1)
    }
  }

  const toggleCondition = (key) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const submitConditions = async () => {
    if (busy) return
    setBusy(true)
    if (selected.size > 0) {
      try {
        await db.entities.Pathology.bulkCreate([...selected].map((condition) => ({ condition })))
      } catch (err) {
        console.error('Onboarding pathologies save failed:', err)
      }
    }
    setBusy(false)
    setStepIndex(stepIndex + 1)
  }

  const finish = async (theme) => {
    setTheme(theme)
    try {
      await db.auth.updateMe({ onboarded_at: new Date().toISOString() })
    } catch (err) {
      console.error('Could not record onboarding completion', err)
    }
    onDone(knownName || capitalizeName(name) || null)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-md p-4 overflow-y-auto"
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="card-float-lg max-w-md w-full p-7 sm:p-8 relative overflow-hidden my-auto"
        >
          <div className="pointer-events-none absolute inset-0 modal-sheen" />

          <div className="relative">
            <div className="flex items-center justify-center gap-2 mb-6">
              {steps.map((stepName, i) => (
                <div
                  key={stepName}
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: i === stepIndex ? 28 : 8,
                    backgroundColor: i <= stepIndex ? '#4FAF82' : '#DDE3DF',
                  }}
                />
              ))}
            </div>

            <AnimatePresence mode="wait">
              {step === 'name' && (
                <motion.div
                  key="name"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-soft mx-auto mb-5">
                    <Leaf className="w-7 h-7 text-brand" strokeWidth={2.2} />
                  </div>
                  <h2 className="font-display text-[24px] font-600 text-ink text-center mb-2">
                    {t('onboarding_title', lang)}
                  </h2>
                  <p className="text-ink/55 text-sm text-center mb-6">
                    {t('onboarding_question', lang)}
                  </p>
                  <form onSubmit={submitName}>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('onboarding_placeholder', lang)}
                      autoFocus
                      className="input-float"
                    />
                    {error && (
                      <p className="mt-2 text-[12px] text-[#C56B6B] leading-relaxed">{error}</p>
                    )}
                    <button
                      type="submit"
                      disabled={!name.trim() || busy}
                      className="btn-primary w-full mt-4"
                    >
                      {busy ? (
                        <span className="spinner !w-4 !h-4 !border-2 !border-white/40 !border-t-white" />
                      ) : (
                        <>
                          {t('onboarding_continue', lang)}{' '}
                          <ArrowRight className="w-4 h-4" strokeWidth={2.4} />
                        </>
                      )}
                    </button>
                  </form>
                </motion.div>
              )}

              {step === 'conditions' && (
                <motion.div
                  key="conditions"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.25 }}
                >
                  <h2 className="font-display text-[22px] font-600 text-ink text-center mb-2">
                    {t('onboarding_conditions_title', lang)}
                  </h2>
                  <p className="text-ink/55 text-[13px] text-center mb-5 leading-relaxed max-w-[340px] mx-auto">
                    {t('onboarding_conditions_intro', lang)}
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 max-h-[280px] overflow-y-auto no-scrollbar px-1 py-1">
                    {conditions.map((condition) => {
                      const active = selected.has(condition.key)
                      return (
                        <button
                          key={condition.key}
                          onClick={() => toggleCondition(condition.key)}
                          className="cond-pill"
                          style={
                            active
                              ? {
                                  backgroundColor: condition.color + '18',
                                  borderColor: condition.color,
                                  color: condition.color,
                                }
                              : undefined
                          }
                        >
                          <span>{condition.emoji}</span> {condition.label}
                          {active && <Check className="w-3.5 h-3.5" strokeWidth={2.6} />}
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-[11px] text-ink/40 text-center mt-3 italic">
                    {t('onboarding_conditions_skip', lang)}
                  </p>
                  <button
                    onClick={submitConditions}
                    disabled={busy}
                    className="btn-primary w-full mt-5"
                  >
                    {busy ? (
                      <span className="spinner !w-4 !h-4 !border-2 !border-white/40 !border-t-white" />
                    ) : (
                      <>
                        {t('onboarding_continue', lang)}{' '}
                        <ArrowRight className="w-4 h-4" strokeWidth={2.4} />
                      </>
                    )}
                  </button>
                </motion.div>
              )}

              {step === 'theme' && (
                <motion.div
                  key="theme"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.25 }}
                >
                  <h2 className="font-display text-[22px] font-600 text-ink text-center mb-2">
                    {t('onboarding_theme_title', lang)}
                  </h2>
                  <p className="text-ink/55 text-[13px] text-center mb-5">
                    {t('onboarding_theme_subtitle', lang)}
                  </p>
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <button
                      onClick={() => finish('light')}
                      className="rounded-2xl border-2 p-5 flex flex-col items-center gap-2 transition-all hover:scale-[1.02] bg-white"
                      style={{ borderColor: '#4FAF82' }}
                    >
                      <Sun className="w-7 h-7 text-[#B8863B]" strokeWidth={2} />
                      <span className="text-[13px] font-600 text-ink">
                        {t('onboarding_light', lang)}
                      </span>
                    </button>
                    <button
                      onClick={() => finish('dark')}
                      className="rounded-2xl border-2 p-5 flex flex-col items-center gap-2 transition-all hover:scale-[1.02]"
                      style={{
                        borderColor: '#4FAF82',
                        backgroundColor: '#16221E',
                        color: '#E8F1ED',
                      }}
                    >
                      <Moon className="w-7 h-7 text-[#4FAF82]" strokeWidth={2} />
                      <span className="text-[13px] font-600" style={{ color: '#E8F1ED' }}>
                        {t('onboarding_dark', lang)}
                      </span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {stepIndex > 0 && (
              <button
                onClick={() => setStepIndex(stepIndex - 1)}
                className="btn-link flex items-center gap-1 mx-auto mt-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2} /> {en ? 'Back' : 'Indietro'}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
