import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { db } from '@/api/client'
import { useAuth } from '@/lib/AuthContext'
import { useLanguage } from '@/lib/LanguageContext'
import { t } from '@/lib/translations'
import { authErrorMessage, EMAIL_PATTERN } from '@/lib/authErrors'
import AuthLayout from '@/components/auth/AuthLayout'
import FormError from '@/components/auth/FormError'
import PasswordField from '@/components/auth/PasswordField'

export default function Login() {
  const { lang } = useLanguage()
  const { isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!isLoading && isAuthenticated) {
    return <Navigate to={location.state?.from || '/'} replace />
  }

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return

    if (!EMAIL_PATTERN.test(email.trim())) {
      setError(t(email.trim() ? 'auth_err_email_invalid' : 'auth_err_email_required', lang))
      return
    }

    setBusy(true)
    setError('')
    try {
      await db.auth.signIn(email.trim(), password)
      navigate(location.state?.from || '/', { replace: true })
    } catch (err) {
      setError(authErrorMessage(err, lang))
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title={t('auth_login_title', lang)}
      subtitle={t('auth_login_subtitle', lang)}
      footer={
        <>
          {t('auth_no_account', lang)}{' '}
          <Link to="/register" className="text-brand-dark font-500 hover:text-brand">
            {t('auth_sign_up', lang)}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
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
          autoFocus
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
          autoComplete="current-password"
        />

        <FormError message={error} />

        <button type="submit" disabled={busy} className="btn-primary w-full mt-5">
          {busy ? (
            <span className="spinner !w-4 !h-4 !border-2 !border-white/40 !border-t-white" />
          ) : (
            <>
              {t('auth_sign_in', lang)} <ArrowRight className="w-4 h-4" strokeWidth={2.4} />
            </>
          )}
        </button>

        <div className="text-center mt-4">
          <Link to="/forgot-password" className="btn-link">
            {t('auth_forgot', lang)}
          </Link>
        </div>
      </form>
    </AuthLayout>
  )
}
