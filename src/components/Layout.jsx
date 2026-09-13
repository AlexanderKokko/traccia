import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import DisclaimerBanner from './DisclaimerBanner'
import LocalModeBanner from './LocalModeBanner'
import { useLanguage } from '@/lib/LanguageContext'

export default function Layout() {
  const { lang } = useLanguage()

  return (
    <div className="min-h-screen bg-canvas">
      <a href="#contenuto" className="skip-link no-print">
        {lang === 'en' ? 'Skip to content' : 'Vai al contenuto'}
      </a>
      <Navbar />
      <LocalModeBanner />
      <DisclaimerBanner />
      <main id="contenuto" className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <Outlet />
      </main>
    </div>
  )
}
