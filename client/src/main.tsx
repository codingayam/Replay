import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker } from './utils/notificationUtils'

// Register service worker after React bootstrap
const initializeApp = async () => {
  // Only register service worker on HTTPS or localhost
  const isSecureContext = window.location.protocol === 'https:' ||
                         window.location.hostname === 'localhost'

  if (isSecureContext) {
    try {
      await registerServiceWorker()
      console.log('Service worker registered successfully')
    } catch (error) {
      console.error('Service worker registration failed:', error)
    }
  } else {
    console.warn('Service worker requires HTTPS. Skipping registration.')
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Initialize app after React renders
initializeApp()
