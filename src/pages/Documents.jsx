import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, X, Trash2, FileText, Camera, ExternalLink } from 'lucide-react'
import { db, resolveFileUrl, removeStoredFile } from '@/api/client'
import { useLanguage } from '@/lib/LanguageContext'
import { useDataSync } from '@/lib/useDataSync'
import { t } from '@/lib/translations'
import { formatDateInput } from '@/lib/dateUtils'
import { getConditionList, getCondition, getDocTypes } from '@/lib/conditions'
import { toast } from '@/components/ui/toast-bus'

const EMPTY = { doc_type: '', doc_date: '', description: '', linked_condition: '' }

/** Only formats a medical report is plausibly in, and a size a browser can hold. */
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
const MAX_FILE_BYTES = 15 * 1024 * 1024

export default function Documents() {
  const { lang } = useLanguage()
  const docTypes = getDocTypes(lang)
  const conditions = getConditionList(lang)

  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [pending, setPending] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [previewUrls, setPreviewUrls] = useState({})

  const cameraRef = useRef(null)
  const fileRef = useRef(null)

  const load = () => {
    db.entities.MedicalDocument.list('-doc_date')
      .then(setDocuments)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(load, [])
  useDataSync(load)

  // The staged file's preview URL is created once, when the file is picked, and
  // revoked when it is replaced or cleared. Creating it inline during render
  // would leak one object URL on every keystroke in the form.
  useEffect(() => {
    const url = pending?.previewUrl
    if (!url) return
    return () => URL.revokeObjectURL(url)
  }, [pending])

  // Stored files are blobs; resolve them to object URLs for preview and opening.
  useEffect(() => {
    let cancelled = false
    const created = []
    Promise.all(documents.map(async (doc) => [doc.id, await resolveFileUrl(doc.file_url)])).then(
      (pairs) => {
        if (cancelled) return
        const map = {}
        pairs.forEach(([id, url]) => {
          if (url) {
            map[id] = url
            created.push(url)
          }
        })
        setPreviewUrls(map)
      }
    )
    return () => {
      cancelled = true
      created.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [documents])

  const resetForm = () => {
    setForm(EMPTY)
    setPending(null)
    setFormOpen(false)
  }

  const handleFilePicked = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // let the same file be re-picked after an error
    if (!file) return

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({
        variant: 'destructive',
        title: lang === 'it' ? 'Formato non supportato' : 'Unsupported format',
        description:
          lang === 'it'
            ? 'Puoi caricare una foto (JPG, PNG, WebP) o un PDF.'
            : 'You can upload a photo (JPG, PNG, WebP) or a PDF.',
      })
      return
    }

    if (file.size > MAX_FILE_BYTES) {
      toast({
        variant: 'destructive',
        title: lang === 'it' ? 'File troppo grande' : 'File too large',
        description:
          lang === 'it'
            ? 'Il limite è 15 MB. Prova a ridurre la qualità della foto.'
            : 'The limit is 15 MB. Try reducing the photo quality.',
      })
      return
    }

    const isImage = file.type.startsWith('image')
    setPending({
      file,
      name: file.name,
      type: isImage ? 'image' : 'pdf',
      previewUrl: isImage ? URL.createObjectURL(file) : null,
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.doc_type || !form.doc_date || !pending) return
    setUploading(true)
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file: pending.file })
      await db.entities.MedicalDocument.create({
        doc_type: form.doc_type,
        doc_date: form.doc_date,
        description: form.description || null,
        linked_condition: form.linked_condition || null,
        file_url,
        file_type: pending.type,
        file_name: pending.name,
      })
      resetForm()
      load()
      toast({
        title: lang === 'it' ? 'Documento salvato' : 'Document saved',
        description:
          lang === 'it' ? 'Referto caricato con successo' : 'Document uploaded successfully',
      })
    } catch (err) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: lang === 'it' ? 'Caricamento non riuscito' : 'Upload failed',
        description: String(err?.message || err),
      })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (doc) => {
    await removeStoredFile(doc.file_url)
    await db.entities.MedicalDocument.delete(doc.id)
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-[28px] sm:text-[34px] font-600 text-ink leading-[1.12] tracking-tight">
            {t('documents_title', lang)}
          </h1>
          <p className="text-ink/55 text-[14px] mt-1.5">{t('documents_subtitle', lang)}</p>
        </div>
        <button onClick={() => setFormOpen(!formOpen)} className="btn-primary shrink-0">
          <Plus className="w-4 h-4" strokeWidth={2.4} />
          <span className="hidden sm:inline">{t('add_document', lang)}</span>
        </button>
      </div>

      <AnimatePresence>
        {formOpen && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="card-float p-5 sm:p-6 mb-6 space-y-4 overflow-hidden"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[13px] font-500 text-ink/70 block mb-1.5">
                  {t('document_type', lang)}
                </label>
                <select
                  value={form.doc_type}
                  onChange={(e) => setForm({ ...form, doc_type: e.target.value })}
                  className="input-float"
                >
                  <option value="">{t('select_placeholder', lang)}</option>
                  {Object.entries(docTypes).map(([key, meta]) => (
                    <option key={key} value={key}>
                      {meta.emoji} {meta.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[13px] font-500 text-ink/70 block mb-1.5">
                  {t('document_date', lang)}
                </label>
                <input
                  type="date"
                  value={form.doc_date}
                  onChange={(e) => setForm({ ...form, doc_date: e.target.value })}
                  className="input-float"
                />
              </div>
            </div>

            <div>
              <label className="text-[13px] font-500 text-ink/70 block mb-1.5">
                {t('description_optional', lang)}
              </label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t('description_placeholder', lang)}
                className="input-float"
              />
            </div>

            <div>
              <label className="text-[13px] font-500 text-ink/70 block mb-1.5">
                {t('linked_pathology', lang)}
              </label>
              <select
                value={form.linked_condition}
                onChange={(e) => setForm({ ...form, linked_condition: e.target.value })}
                className="input-float"
              >
                <option value="">{t('none_option', lang)}</option>
                {conditions.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.emoji} {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[13px] font-500 text-ink/70 block mb-2">
                {t('upload_document', lang)}
              </label>
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFilePicked}
                className="hidden"
              />
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,image/*"
                onChange={handleFilePicked}
                className="hidden"
              />

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="btn-ghost flex-1 !py-3"
                >
                  <Camera className="w-4 h-4 text-brand" strokeWidth={2} />
                  {t('take_photo', lang)}
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="btn-ghost flex-1 !py-3"
                >
                  <FileText className="w-4 h-4 text-brand" strokeWidth={2} />
                  {t('upload_pdf', lang)}
                </button>
              </div>

              {pending && (
                <div className="mt-3 flex items-center gap-3 card-inner p-3">
                  {pending.previewUrl ? (
                    <img
                      src={pending.previewUrl}
                      alt={
                        lang === 'it'
                          ? 'Anteprima del documento selezionato'
                          : 'Preview of the selected document'
                      }
                      className="w-11 h-11 object-cover rounded-xl"
                    />
                  ) : (
                    <div className="w-11 h-11 bg-brand rounded-xl flex items-center justify-center text-white text-[11px] font-600">
                      PDF
                    </div>
                  )}
                  <span className="text-[13px] text-ink truncate flex-1">{pending.name}</span>
                  <button
                    type="button"
                    onClick={() => setPending(null)}
                    aria-label={
                      lang === 'en' ? 'Remove selected file' : 'Rimuovi il file selezionato'
                    }
                    className="text-ink/40 hover:text-[#C56B6B]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!form.doc_type || !form.doc_date || !pending || uploading}
              className="btn-primary"
            >
              {uploading ? (
                <span className="spinner !w-4 !h-4 !border-2 !border-white/40 !border-t-white" />
              ) : (
                t('confirm_upload', lang)
              )}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="spinner" />
        </div>
      ) : documents.length === 0 ? (
        <div className="card-float p-12 text-center">
          <FileText className="w-8 h-8 text-ink/25 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-ink/45 text-sm">{t('no_documents', lang)}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc, i) => {
            const meta = docTypes[doc.doc_type] || { label: doc.doc_type, emoji: '📄' }
            const condition = doc.linked_condition ? getCondition(doc.linked_condition, lang) : null
            const url = previewUrls[doc.id]

            return (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="card-float p-4 flex items-center gap-4"
              >
                {doc.file_type === 'image' && url ? (
                  <img
                    src={url}
                    alt={doc.file_name}
                    className="w-14 h-14 object-cover rounded-2xl shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 card-inner rounded-2xl flex items-center justify-center text-[22px] shrink-0">
                    {meta.emoji}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[14px] font-500 text-ink">{meta.label}</span>
                    {condition && (
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: condition.color + '14',
                          color: condition.color,
                        }}
                      >
                        {condition.emoji} {condition.label}
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-ink/45 font-mono-data">
                    {formatDateInput(doc.doc_date, lang)}
                  </p>
                  {doc.description && (
                    <p className="text-[13px] text-ink-soft mt-1 truncate">{doc.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-link flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> {t('view_file', lang)}
                    </a>
                  )}
                  <button
                    onClick={() => handleDelete(doc)}
                    aria-label={`${lang === 'en' ? 'Delete' : 'Elimina'} ${meta.label}`}
                    className="text-ink/35 hover:text-[#C56B6B] transition-colors"
                  >
                    <Trash2 className="w-[17px] h-[17px]" strokeWidth={2} />
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
