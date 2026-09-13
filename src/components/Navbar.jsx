import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  BookOpen,
  Stethoscope,
  FileText,
  TrendingUp,
  CalendarCheck,
  Pill,
  Sparkles,
  LifeBuoy,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { db, isCloudBacked } from '@/api/client'
import { useLanguage } from '@/lib/LanguageContext'
import { t } from '@/lib/translations'
import ThemeToggle from '@/components/ThemeToggle'

export default function Navbar() {
  const { pathname } = useLocation()
  const { lang, toggleLang } = useLanguage()
  const [userName, setUserName] = useState(null)

  const navRef = useRef(null)
  const activeTabRef = useRef(null)
  const [edges, setEdges] = useState({ overflows: false, atStart: true, atEnd: true })
  const { overflows, atStart, atEnd } = edges

  /** Whether the tab strip overflows, and which ends still have content past them. */
  const measureEdges = useCallback(() => {
    const el = navRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setEdges({
      overflows: max > 1,
      atStart: el.scrollLeft <= 1,
      atEnd: el.scrollLeft >= max - 1,
    })
  }, [])

  useEffect(() => {
    const el = navRef.current
    if (!el) return

    // Measured after paint, never synchronously in the effect body: layout has
    // to have happened for scrollWidth to mean anything.
    const raf = requestAnimationFrame(measureEdges)

    el.addEventListener('scroll', measureEdges, { passive: true })
    const observer = new ResizeObserver(measureEdges)
    observer.observe(el)

    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('scroll', measureEdges)
      observer.disconnect()
    }
  }, [measureEdges])

  const scrollTabs = (direction) => {
    const el = navRef.current
    if (!el) return

    const step = direction * Math.max(el.clientWidth * 0.7, 160)
    const max = el.scrollWidth - el.clientWidth
    const target = Math.max(0, Math.min(el.scrollLeft + step, max))
    const start = el.scrollLeft

    el.scrollTo({ left: target, behavior: 'smooth' })

    // Smooth scrolling is animation-driven, and there are environments where
    // that animation never runs — which would leave the arrow silently doing
    // nothing. If the strip has not budged at all shortly after, jump there
    // instead. An animation that *is* running is left alone to finish.
    window.setTimeout(() => {
      if (el.scrollLeft === start && start !== target) {
        el.scrollTo({ left: target, behavior: 'instant' })
      }
    }, 250)
  }

  // Keep the current section visible — otherwise navigating to a tab that is
  // off-screen leaves the user with no indication of where they are.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      activeTabRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    })
    return () => cancelAnimationFrame(raf)
  }, [pathname])

  useEffect(() => {
    db.auth
      .me()
      .then((u) => setUserName(u.display_name || u.full_name || null))
      .catch(() => {})
  }, [])

  const handleLogout = () => db.auth.logout(isCloudBacked ? '/login' : '/')

  const tabs = [
    { label: t('nav_diary', lang), path: '/', icon: BookOpen },
    { label: t('nav_pathologies', lang), path: '/patologie', icon: Stethoscope },
    { label: t('nav_documents', lang), path: '/referti', icon: FileText },
    { label: t('nav_trends', lang), path: '/andamento', icon: TrendingUp },
    { label: t('nav_appointments', lang), path: '/controlli', icon: CalendarCheck },
    { label: t('nav_therapies', lang), path: '/terapie', icon: Pill },
    { label: t('nav_contents', lang), path: '/contenuti', icon: Sparkles },
    { label: lang === 'en' ? 'Guide' : 'Guida', path: '/docs', icon: LifeBuoy },
  ]

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-line no-print">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 shrink-0 group">
            <span className="text-[22px] leading-none transition-transform group-hover:scale-105">
              🌿
            </span>
            <span className="font-display text-[20px] font-600 tracking-tight text-ink">
              Traccia
            </span>
          </Link>

          <div className="flex items-center gap-2 shrink-0">
            {userName && (
              <span className="text-[13px] text-ink-soft hidden sm:inline max-w-[120px] truncate">
                {userName}
              </span>
            )}

            {/* Without accounts there is nothing to log out of — the button would
                only reset the local name, which is not what it says it does. */}
            {isCloudBacked && userName && (
              <button onClick={handleLogout} className="btn-ghost !py-1.5 !px-3 !text-[13px]">
                <LogOut className="w-3.5 h-3.5" strokeWidth={2} />
                <span className="hidden sm:inline">{t('logout', lang)}</span>
              </button>
            )}

            <ThemeToggle />

            <button
              onClick={toggleLang}
              aria-label={lang === 'it' ? 'Switch to English' : 'Passa all\u2019italiano'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-line bg-background text-xs font-500 text-ink-soft hover:border-brand/40 transition-colors"
            >
              <span className="text-[13px] leading-none">{lang === 'it' ? '🇮🇹' : '🇬🇧'}</span>
              <span className="text-ink-soft">{lang.toUpperCase()}</span>
            </button>
          </div>
        </div>

        {/*
          Eight tabs do not fit the 3xl container, so the row scrolls, and the
          scrollbar is hidden — which left no sign that anything was off-screen.
          The arrows sit *beside* the scrolling row rather than on top of it:
          overlaid, they covered the very tab labels they were meant to reveal.
          They only take up space when the row actually overflows.
        */}
        <div className="flex items-center gap-1 pb-2.5">
          {overflows && (
            <ScrollArrow
              direction="left"
              disabled={atStart}
              onClick={() => scrollTabs(-1)}
              label={lang === 'en' ? 'Scroll sections left' : 'Scorri le sezioni a sinistra'}
            />
          )}

          <nav
            ref={navRef}
            aria-label={lang === 'en' ? 'Sections' : 'Sezioni'}
            style={edgeMask(overflows, atStart, atEnd)}
            className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1 min-w-0 scroll-smooth"
          >
            {tabs.map((tab) => {
              const active = pathname === tab.path
              const Icon = tab.icon
              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  ref={active ? activeTabRef : undefined}
                  aria-current={active ? 'page' : undefined}
                  className={`nav-tab shrink-0 ${active ? 'active' : ''}`}
                >
                  <Icon className="w-[15px] h-[15px]" strokeWidth={2} />
                  {tab.label}
                </Link>
              )
            })}
          </nav>

          {overflows && (
            <ScrollArrow
              direction="right"
              disabled={atEnd}
              onClick={() => scrollTabs(1)}
              label={lang === 'en' ? 'Scroll sections right' : 'Scorri le sezioni a destra'}
            />
          )}
        </div>
      </div>
    </header>
  )
}

/**
 * Softens whichever edge is actually clipped, so the last tab fades out instead
 * of being chopped mid-word. Purely cosmetic — it masks the row's own edge and
 * never covers a control.
 */
function edgeMask(overflows, atStart, atEnd) {
  if (!overflows) return undefined

  const left = atStart ? 'black 0' : 'transparent 0, black 20px'
  const right = atEnd ? 'black 100%' : 'black calc(100% - 20px), transparent 100%'
  const gradient = `linear-gradient(to right, ${left}, ${right})`

  return { maskImage: gradient, WebkitMaskImage: gradient }
}

/**
 * Scrolls the tab strip one screenful. Hidden from assistive technology: the
 * tabs are already reachable by keyboard and listed in the nav landmark, so
 * announcing these would only add noise.
 */
function ScrollArrow({ direction, disabled, onClick, label }) {
  const Chevron = direction === 'left' ? ChevronLeft : ChevronRight

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      tabIndex={-1}
      aria-hidden="true"
      title={label}
      className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full border border-line bg-background text-ink-soft transition-all hover:text-ink hover:border-brand/40 disabled:opacity-25 disabled:pointer-events-none"
    >
      <Chevron className="w-3.5 h-3.5" strokeWidth={2.2} />
    </button>
  )
}
