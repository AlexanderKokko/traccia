import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'

/**
 * Gates the diary behind a session. While the session is being restored it
 * shows a spinner rather than flashing the login screen at someone who is
 * already signed in.
 */
export default function ProtectedRoute({ children }) {
  const { isLoading, isAuthenticated } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="spinner" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}
