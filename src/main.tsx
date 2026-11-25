import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import LandingPage from './pages/LandingPage'
import VendorPortal from './pages/VendorPortal'
import './index.css'

const path = window.location.pathname.replace(/\/+$/, '')
const isWorkspaceRoute = path === '/app' || path === '/demo'
const isVendorRoute = path === '/vendor'
document.title = isVendorRoute
  ? 'Event Guardian · Vendor Portal'
  : isWorkspaceRoute
    ? (__GUARDIAN_API_ENABLED__ ? 'Event Guardian · Workspace' : 'Event Guardian · Interactive demo')
    : 'Event Guardian · Control for complex events'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isVendorRoute ? <VendorPortal /> : isWorkspaceRoute ? <App /> : <LandingPage />}
  </React.StrictMode>,
)
