import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { db } from '@/api/client'
import { useLanguage } from '@/lib/LanguageContext'
import { t } from '@/lib/translations'
import { authErrorMessage, MIN_PASSWORD_LENGTH } from '@/lib/authErrors'
import AuthLayout from '@/components/auth/AuthLayout'
import FormError from '@/components/auth/FormError'
import PasswordField from '@/components/auth/PasswordField'

/**
 * Reached from the emailed reset link. Supabase turns the link into a recovery
 * session on load (detectSessionInUrl), so the new password can simply be set.
 */
export default function ResetPassword() {
  const { lang } = useLanguage()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    if (password.length < MIN_PASSWORD_LENGTH) {
      return setError(t('auth_err_password_short', lang))
    }
    if (password !== confirm) return setError(t('auth_err_password_mismatch', lang))

    setBusy(true)
    setError('')
    try {
      await db.auth.updatePassword(password)
      setDone(true)
      setTimeout(() => navigate('/', { replace: true }), 1600)
    } catch (err) {
      setError(authErrorMessage(err, lang))
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title={t('auth_reset_title', lang)}
      subtitle={done ? t('auth_reset_done', lang) : t('auth_reset_subtitle', lang)}
      footer={
        <Link to="/login" className="text-brand-dark font-500 hover:text-brand">
          {t('auth_back_to_login', lang)}
        </Link>
      }
    >
      {done ? (
        <div className="flex items-center justify-center py-2">
          <Check className="w-10 h-10 text-brand" strokeWidth={2} />
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <label htmlFor="password" className="text-[13px] font-500 text-ink/70 block mb-1.5">
            {t('auth_password_new', lang)}
          </label>
          <PasswordField
            id="password"
            value={password}
            onChange={setPassword}
            placeholder={t('auth_password_placeholder', lang)}
            autoComplete="new-password"
          />

          <label htmlFor="confirm" className="text-[13px] font-500 text-ink/70 block mb-1.5 mt-4">
            {t('auth_password_confirm', lang)}
          </label>
          <PasswordField
            id="confirm"
            value={confirm}
            onChange={setConfirm}
            placeholder={t('auth_password_placeholder', lang)}
            autoComplete="new-password"
          />

          <FormError message={error} />

          <button type="submit" disabled={busy} className="btn-primary w-full mt-5">
            {busy ? (
              <span className="spinner !w-4 !h-4 !border-2 !border-white/40 !border-t-white" />
            ) : (
              t('auth_reset_cta', lang)
            )}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}
