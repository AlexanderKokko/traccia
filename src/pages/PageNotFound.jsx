import { Link } from 'react-router-dom'
import { useLanguage } from '@/lib/LanguageContext'

export default function PageNotFound() {
  const { lang } = useLanguage()
  return (
    <div className="card-float p-12 text-center">
      <p className="text-[44px] mb-2">🌿</p>
      <h1 className="font-display text-[24px] font-600 text-ink mb-1.5">
        {lang === 'en' ? 'Page not found' : 'Pagina non trovata'}
      </h1>
      <p className="text-ink/50 text-sm mb-6">
        {lang === 'en'
          ? 'The page you were looking for is not here.'
          : 'La pagina che cercavi non è qui.'}
      </p>
      <Link to="/" className="btn-primary inline-flex">
        {lang === 'en' ? 'Back to the diary' : 'Torna al diario'}
      </Link>
    </div>
  )
}
