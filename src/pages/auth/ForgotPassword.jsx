import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { db } from '@/api/client'
import { useLanguage } from '@/lib/LanguageContext'
import { t } from '@/lib/translations'
import { authErrorMessage, EMAIL_PATTERN } from '@/lib/authErrors'
import AuthLayout from '@/components/auth/AuthLayout'
import FormError from '@/components/auth/FormError'

export default function ForgotPassword() {
  const { lang } = useLanguage()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    if (!EMAIL_PATTERN.test(email.trim())) {
      return setError(t(email.trim() ? 'auth_err_email_invalid' : 'auth_err_email_required', lang))
    }

    setBusy(true)
    setError('')
    try {
      await db.auth.requestPasswordReset(email.trim())
    } catch (err) {
      // Rate limiting is worth surfacing; anything else stays quiet, so this
      // form cannot be used to find out who has an account.
      const message = authErrorMessage(err, lang)
      if (message === t('auth_err_rate_limit', lang)) {
        setError(message)
        setBusy(false)
        return
      }
      console.error(err)
    }
    setSent(true)
    setBusy(false)
  }

  return (
    <AuthLayout
      title={t('auth_forgot_title', lang)}
      subtitle={sent ? t('auth_forgot_sent', lang) : t('auth_forgot_subtitle', lang)}
      footer={
        <Link to="/login" className="text-brand-dark font-500 hover:text-brand">
          {t('auth_back_to_login', lang)}
        </Link>
      }
    >
      {sent ? (
        <div className="flex items-center justify-center py-2">
          <MailCheck className="w-10 h-10 text-brand" strokeWidth={1.6} />
        </div>
      ) : (
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
            className="input-float"
          />

          <FormError message={error} />

          <button type="submit" disabled={busy} className="btn-primary w-full mt-5">
            {busy ? (
              <span className="spinner !w-4 !h-4 !border-2 !border-white/40 !border-t-white" />
            ) : (
              t('auth_forgot_cta', lang)
            )}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}
