import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

/*
Deactivated display of EOD Cash Reporting
since it is currently not being used

Uncomment 'BusinessDayPanel' to re-enable
*/

//import BusinessDayPanel from './features/businessDay/BusinessDayPanel'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* <BusinessDayPanel /> */}
    <App />
  </StrictMode>,
)