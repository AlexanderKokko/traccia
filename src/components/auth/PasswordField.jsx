import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useLanguage } from '@/lib/LanguageContext'

export default function PasswordField({ value, onChange, placeholder, autoComplete, id }) {
  const { lang } = useLanguage()
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="input-float !pr-12"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={
          visible
            ? lang === 'en'
              ? 'Hide password'
              : 'Nascondi la password'
            : lang === 'en'
              ? 'Show password'
              : 'Mostra la password'
        }
        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/35 hover:text-ink/60 transition-colors p-1"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )
}
