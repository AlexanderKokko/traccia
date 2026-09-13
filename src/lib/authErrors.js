import { t } from './translations'

/**
 * Turns a Supabase auth error into something a patient can act on.
 *
 * Deliberately vague on sign-in: "incorrect email or password" rather than
 * saying which, so the form cannot be used to discover whether a given person
 * has a Traccia account.
 */
export function authErrorMessage(error, lang) {
  const raw = String(error?.message || error || '').toLowerCase()

  if (raw.includes('invalid login credentials')) return t('auth_err_invalid', lang)
  if (raw.includes('email not confirmed')) return t('auth_err_not_confirmed', lang)
  if (raw.includes('already registered') || raw.includes('already been registered')) {
    return t('auth_err_email_taken', lang)
  }
  if (raw.includes('rate limit') || raw.includes('too many')) return t('auth_err_rate_limit', lang)
  if (raw.includes('password should be at least')) return t('auth_err_password_short', lang)

  return t('auth_err_generic', lang)
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const MIN_PASSWORD_LENGTH = 8
