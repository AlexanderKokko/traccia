import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, MailCheck } from 'lucide-react'
import { db } from '@/api/client'
import { useAuth } from '@/lib/AuthContext'
import { useLanguage } from '@/lib/LanguageContext'
import { t } from '@/lib/translations'
import { authErrorMessage, EMAIL_PATTERN, MIN_PASSWORD_LENGTH } from '@/lib/authErrors'
import AuthLayout from '@/components/auth/AuthLayout'
import FormError from '@/components/auth/FormError'
import PasswordField from '@/components/auth/PasswordField'

/** Every word capitalised — the saved display name is always presented this way. */
function capitalizeName(value) {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export default function Register() {
  const { lang } = useLanguage()
  const { isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)

  if (!isLoading && isAuthenticated) return <Navigate to="/" replace />

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return

    if (!name.trim()) return setError(t('auth_err_name_required', lang))
    if (!EMAIL_PATTERN.test(email.trim())) {
      return setError(t(email.trim() ? 'auth_err_email_invalid' : 'auth_err_email_required', lang))
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return setError(t('auth_err_password_short', lang))
    }

    setBusy(true)
    setError('')
    try {
      const result = await db.auth.signUp(email.trim(), password, capitalizeName(name))
      // With email confirmation on, there is no session yet — tell the user to
      // go and open the link rather than dropping them on a login screen.
      if (result?.session) navigate('/', { replace: true })
      else setCheckEmail(true)
    } catch (err) {
      setError(authErrorMessage(err, lang))
    } finally {
      setBusy(false)
    }
  }

  if (checkEmail) {
    return (
      <AuthLayout
        title={t('auth_check_email_title', lang)}
        subtitle={t('auth_check_email_body', lang)}
        footer={
          <Link to="/login" className="text-brand-dark font-500 hover:text-brand">
            {t('auth_back_to_login', lang)}
          </Link>
        }
      >
        <div className="flex items-center justify-center py-2">
          <MailCheck className="w-10 h-10 text-brand" strokeWidth={1.6} />
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={t('auth_register_title', lang)}
      subtitle={t('auth_register_subtitle', lang)}
      footer={
        <>
          {t('auth_has_account', lang)}{' '}
          <Link to="/login" className="text-brand-dark font-500 hover:text-brand">
            {t('auth_sign_in', lang)}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <label htmlFor="name" className="text-[13px] font-500 text-ink/70 block mb-1.5">
          {t('auth_name', lang)}
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('auth_name_placeholder', lang)}
          autoComplete="given-name"
          autoFocus
          className="input-float mb-4"
        />

        <label htmlFor="email" className="text-[13px] font-500 text-ink/70 block mb-1.5">
          {t('auth_email', lang)}
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('auth_email_placeholder', lang)}
          autoComplete="email"
          className="input-float mb-4"
        />

        <label htmlFor="password" className="text-[13px] font-500 text-ink/70 block mb-1.5">
          {t('auth_password', lang)}
        </label>
        <PasswordField
          id="password"
          value={password}
          onChange={setPassword}
          placeholder={t('auth_password_placeholder', lang)}
          autoComplete="new-password"
        />
        <p className="text-[11.5px] text-ink/40 mt-1.5">
          {lang === 'en'
            ? `At least ${MIN_PASSWORD_LENGTH} characters.`
            : `Almeno ${MIN_PASSWORD_LENGTH} caratteri.`}
        </p>

        <FormError message={error} />

        <button type="submit" disabled={busy} className="btn-primary w-full mt-5">
          {busy ? (
            <span className="spinner !w-4 !h-4 !border-2 !border-white/40 !border-t-white" />
          ) : (
            <>
              {t('auth_sign_up', lang)} <ArrowRight className="w-4 h-4" strokeWidth={2.4} />
            </>
          )}
        </button>
      </form>
    </AuthLayout>
  )
}
