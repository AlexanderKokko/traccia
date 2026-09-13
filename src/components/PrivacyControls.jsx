import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ShieldCheck, Download, Trash2, AlertTriangle } from 'lucide-react'
import { exportAllData, eraseAllData } from '@/api/client'
import { useLanguage } from '@/lib/LanguageContext'
import { toast } from '@/components/ui/toast-bus'

/**
 * The two rights a health diary has to make actionable: access (export) and
 * erasure. Both act on everything this app has stored on the device.
 */
export default function PrivacyControls() {
  const { lang } = useLanguage()
  const en = lang === 'en'
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  const handleExport = async () => {
    try {
      const data = await exportAllData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `traccia-dati-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast({
        title: en ? 'Export ready' : 'Esportazione pronta',
        description: en
          ? 'Your diary, therapies and appointments were downloaded as JSON.'
          : 'Diario, terapie e controlli sono stati scaricati in formato JSON.',
      })
    } catch (err) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: en ? 'Export failed' : 'Esportazione non riuscita',
        description: String(err?.message || err),
      })
    }
  }

  const handleErase = async () => {
    setBusy(true)
    try {
      await eraseAllData()
      window.location.href = '/'
    } catch (err) {
      console.error(err)
      setBusy(false)
      toast({
        variant: 'destructive',
        title: en ? 'Deletion failed' : 'Eliminazione non riuscita',
        description: String(err?.message || err),
      })
    }
  }

  return (
    <section className="card-float p-5 sm:p-6 mb-5">
      <h2 className="font-display text-[18px] font-600 text-ink flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-brand" strokeWidth={2} />
        {en ? 'Your data' : 'I tuoi dati'}
      </h2>
      <p className="text-[13px] text-ink-soft leading-relaxed mt-2 mb-4">
        {en
          ? 'Your diary is stored on this device only. You can take a full copy with you at any time, or delete everything permanently.'
          : 'Il tuo diario è salvato solo su questo dispositivo. Puoi portarne con te una copia completa in qualsiasi momento, oppure eliminare tutto definitivamente.'}
      </p>

      <div className="flex flex-wrap gap-2.5">
        <button onClick={handleExport} className="btn-ghost">
          <Download className="w-4 h-4 text-brand" strokeWidth={2} />
          {en ? 'Export my data (JSON)' : 'Esporta i miei dati (JSON)'}
        </button>
        <button onClick={() => setConfirming(true)} className="btn-ghost !text-[#C56B6B]">
          <Trash2 className="w-4 h-4" strokeWidth={2} />
          {en ? 'Delete everything' : 'Elimina tutto'}
        </button>
      </div>

      <AnimatePresence>
        {confirming && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 rounded-2xl p-4 warn-soft overflow-hidden"
            style={{ border: '1px solid #C56B6B30' }}
          >
            <div className="flex items-start gap-2.5 mb-3">
              <AlertTriangle
                className="w-[18px] h-[18px] text-[#C56B6B] shrink-0 mt-0.5"
                strokeWidth={2}
              />
              <p className="text-[13px] text-[#8A3A45] leading-relaxed font-500">
                {en
                  ? 'This permanently deletes every diary entry, condition, document, appointment and therapy on this device. It cannot be undone — export a copy first if you want to keep one.'
                  : 'Questa azione elimina definitivamente ogni voce di diario, condizione, documento, controllo e terapia su questo dispositivo. Non è reversibile: esporta prima una copia se vuoi conservarla.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleErase}
                disabled={busy}
                className="btn-primary !bg-none"
                style={{ background: 'linear-gradient(135deg, #C97A7A, #B05858)' }}
              >
                {busy ? (
                  <span className="spinner !w-4 !h-4 !border-2 !border-white/40 !border-t-white" />
                ) : en ? (
                  'Yes, delete everything'
                ) : (
                  'Sì, elimina tutto'
                )}
              </button>
              <button onClick={() => setConfirming(false)} className="btn-ghost">
                {en ? 'Cancel' : 'Annulla'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
