import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import LandingPage from './pages/LandingPage'
import './index.css'

const isDemoRoute = window.location.pathname.replace(/\/+$/, '') === '/demo'
document.title = isDemoRoute
  ? 'Event Guardian · Interactive prototype'
  : 'Event Guardian · Control for complex events'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isDemoRoute ? <App /> : <LandingPage />}
  </React.StrictMode>,
)
