import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/app/App'
import '@/styles.css'
import '@/styles/canvas-glass.css'
import { AccountProvider } from '@/profile/AccountContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AccountProvider>
      <App />
    </AccountProvider>
  </StrictMode>,
)
