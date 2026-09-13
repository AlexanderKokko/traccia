import { createContext, useContext, useEffect, useState } from 'react'

const LanguageContext = createContext({ lang: 'it', toggleLang: () => {} })

const STORAGE_KEY = 'traccia_lang'

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'it'
    } catch {
      return 'it'
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      /* storage unavailable — language simply won't persist */
    }
    document.documentElement.lang = lang
  }, [lang])

  const toggleLang = () => setLang((l) => (l === 'it' ? 'en' : 'it'))

  return (
    <LanguageContext.Provider value={{ lang, toggleLang }}>{children}</LanguageContext.Provider>
  )
}

// The provider and its hook belong together; Fast Refresh's one-export-per-file
// rule does not apply to a context module.
// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() {
  return useContext(LanguageContext)
}
