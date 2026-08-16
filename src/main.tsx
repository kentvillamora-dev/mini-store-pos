import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import BusinessDayPanel from './features/businessDay/BusinessDayPanel'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BusinessDayPanel />
    <App />
  </StrictMode>,
)