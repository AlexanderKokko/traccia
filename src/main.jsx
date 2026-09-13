import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from 'next-themes'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { seedDemoDataOnce } from './api/base44Client'
import { isCloudBacked } from './api/client'
import './index.css'

// Sample history makes the Trends page meaningful during development. A real
// account is never seeded: sample entries exist only in the device-local
// fallback, and only in development unless explicitly asked for.
const seedDemo =
  !isCloudBacked &&
  (import.meta.env.DEV
    ? import.meta.env.VITE_SEED_DEMO !== 'false'
    : import.meta.env.VITE_SEED_DEMO === 'true')

if (seedDemo) seedDemoDataOnce()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
