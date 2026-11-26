import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import LandingPage from './pages/LandingPage'
import VendorPortal from './pages/VendorPortal'
import './index.css'

const path = window.location.pathname.replace(/\/+$/, '')
const isDemoRoute = path === '/demo'
const isWorkspaceRoute = path === '/app' || path === '/workspace' || isDemoRoute
const isVendorRoute = path === '/vendor'
document.title = isVendorRoute
  ? 'Event Guardian · Vendor Portal'
  : isWorkspaceRoute
    ? isDemoRoute
      ? 'Event Guardian · Product demo'
      : 'Event Guardian · Workspace'
    : 'Event Guardian · Control for complex events'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isVendorRoute ? <VendorPortal /> : isWorkspaceRoute ? <App demo={isDemoRoute} /> : <LandingPage />}
  </React.StrictMode>,
)
