import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { useLanguage } from '@/lib/LanguageContext'

/**
 * Light/dark switch, shared by the app header and the sign-in screens so the
 * control looks and behaves identically everywhere.
 *
 * Which icon shows is decided in CSS, not in React. next-themes puts the `dark`
 * class on <html> in a blocking script before first paint, so the correct icon
 * is painted immediately — no hydration flag, and no flicker on load.
 */
export default function ThemeToggle({ className = '' }) {
  const { lang } = useLanguage()
  const { resolvedTheme, setTheme } = useTheme()

  const isDark = resolvedTheme === 'dark'

  const label = isDark
    ? lang === 'en'
      ? 'Switch to light theme'
      : 'Passa al tema chiaro'
    : lang === 'en'
      ? 'Switch to dark theme'
      : 'Passa al tema scuro'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={label}
      title={label}
      className={`flex items-center justify-center px-3 py-1.5 rounded-full border border-line bg-background text-xs font-500 text-ink-soft hover:border-brand/40 transition-colors ${className}`}
    >
      <Moon className="w-3.5 h-3.5 dark:hidden" strokeWidth={2} />
      <Sun className="w-3.5 h-3.5 hidden dark:block" strokeWidth={2} />
    </button>
  )
}
