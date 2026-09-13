import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import { LanguageProvider } from '@/lib/LanguageContext'
import { AuthProvider } from '@/lib/AuthContext'
import { ToastProvider } from '@/components/ui/toast'
import ScrollToTop from '@/components/ScrollToTop'
import ProtectedRoute from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'
import Home from '@/pages/Home'
import Login from '@/pages/auth/Login'
import PageNotFound from '@/pages/PageNotFound'

// The diary is the landing page and stays in the main bundle. Everything else —
// notably Trends (Recharts) and Docs (marked + DOMPurify) — loads on demand, so
// the first paint is not paying for charts the user may never open.
const Register = lazy(() => import('@/pages/auth/Register'))
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'))
const Patologies = lazy(() => import('@/pages/Patologies'))
const Documents = lazy(() => import('@/pages/Documents'))
const Trends = lazy(() => import('@/pages/Trends'))
const Appointments = lazy(() => import('@/pages/Appointments'))
const Therapies = lazy(() => import('@/pages/Therapies'))
const Contents = lazy(() => import('@/pages/Contents'))
const Docs = lazy(() => import('@/pages/Docs'))

function RouteFallback() {
  return (
    <div className="flex justify-center py-20">
      <div className="spinner" />
    </div>
  )
}

function Lazy({ children }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <BrowserRouter>
              <ScrollToTop />
              <Routes>
                {/* Public — the way in */}
                <Route path="/login" element={<Login />} />
                <Route
                  path="/register"
                  element={
                    <Lazy>
                      <Register />
                    </Lazy>
                  }
                />
                <Route
                  path="/forgot-password"
                  element={
                    <Lazy>
                      <ForgotPassword />
                    </Lazy>
                  }
                />
                <Route
                  path="/reset-password"
                  element={
                    <Lazy>
                      <ResetPassword />
                    </Lazy>
                  }
                />

                {/* The diary itself — never reachable without a session */}
                <Route
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/" element={<Home />} />
                  <Route
                    path="/patologie"
                    element={
                      <Lazy>
                        <Patologies />
                      </Lazy>
                    }
                  />
                  <Route
                    path="/referti"
                    element={
                      <Lazy>
                        <Documents />
                      </Lazy>
                    }
                  />
                  <Route
                    path="/andamento"
                    element={
                      <Lazy>
                        <Trends />
                      </Lazy>
                    }
                  />
                  <Route
                    path="/controlli"
                    element={
                      <Lazy>
                        <Appointments />
                      </Lazy>
                    }
                  />
                  <Route
                    path="/terapie"
                    element={
                      <Lazy>
                        <Therapies />
                      </Lazy>
                    }
                  />
                  <Route
                    path="/contenuti"
                    element={
                      <Lazy>
                        <Contents />
                      </Lazy>
                    }
                  />
                  <Route
                    path="/docs"
                    element={
                      <Lazy>
                        <Docs />
                      </Lazy>
                    }
                  />
                  <Route path="*" element={<PageNotFound />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </ToastProvider>
        </QueryClientProvider>
      </AuthProvider>
    </LanguageProvider>
  )
}
