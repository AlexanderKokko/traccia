import { useEffect, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { Download, Share2, FileText } from 'lucide-react'
import { useLanguage } from '@/lib/LanguageContext'
import { toast } from '@/components/ui/toast-bus'
import PrivacyControls from '@/components/PrivacyControls'

const DOC_PATH = '/TRACCIA_DOCS.md'
const FILE_NAME = 'TRACCIA_DOCS.md'

/**
 * The document is app-owned, but it is still fetched at runtime and injected as
 * HTML — so it goes through the same sanitizer any untrusted input would.
 */
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('href')?.startsWith('http')) {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

function renderMarkdown(source) {
  return DOMPurify.sanitize(marked.parse(source, { gfm: true, breaks: false }), {
    ADD_ATTR: ['target', 'rel'],
  })
}

export default function Docs() {
  const { lang } = useLanguage()
  const en = lang === 'en'
  const [markdown, setMarkdown] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(DOC_PATH)
      .then((res) => res.text())
      .then(setMarkdown)
      .catch(() => setMarkdown(''))
      .finally(() => setLoading(false))
  }, [])

  const download = () => {
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = FILE_NAME
    a.click()
    URL.revokeObjectURL(url)
  }

  /**
   * Shares the file itself where the Web Share API supports it; otherwise falls
   * back to downloading the .md and opening WhatsApp with a short message.
   */
  const shareOnWhatsApp = async () => {
    const file = new File([markdown], FILE_NAME, { type: 'text/markdown' })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Traccia — Documentazione' })
        return
      } catch (err) {
        if (err?.name === 'AbortError') return
        console.error(err)
      }
    }
    download()
    const text = encodeURIComponent(
      en
        ? 'Traccia — full documentation (the .md file has been downloaded, attach it here).'
        : 'Traccia — documentazione completa (il file .md è stato scaricato, allegalo qui).'
    )
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer')
    toast({
      title: en ? 'File downloaded' : 'File scaricato',
      description: en ? 'Attach it to the WhatsApp chat.' : 'Allegalo alla chat WhatsApp.',
    })
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-[28px] sm:text-[34px] font-600 text-ink leading-[1.12] tracking-tight">
            {en ? 'Guide' : 'Guida'}
          </h1>
          <p className="text-ink/55 text-[14px] mt-1.5">
            {en
              ? 'Full project documentation, in one page.'
              : 'La documentazione completa del progetto, in una pagina.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button onClick={shareOnWhatsApp} className="btn-ghost">
            <Share2 className="w-4 h-4 text-brand" strokeWidth={2} />
            <span className="hidden sm:inline">
              {en ? 'Share on WhatsApp' : 'Condividi su WhatsApp'}
            </span>
          </button>
          <button onClick={download} className="btn-primary">
            <Download className="w-4 h-4" strokeWidth={2} />
            <span className="hidden sm:inline">{en ? 'Download .md' : 'Scarica .md'}</span>
          </button>
        </div>
      </div>

      <PrivacyControls />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="spinner" />
        </div>
      ) : !markdown ? (
        <div className="card-float p-12 text-center">
          <FileText className="w-8 h-8 text-ink/25 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-ink/45 text-sm">
            {en ? 'Documentation not available.' : 'Documentazione non disponibile.'}
          </p>
        </div>
      ) : (
        <article
          className="card-float p-6 sm:p-8 docs-body"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }}
        />
      )}
    </div>
  )
}
