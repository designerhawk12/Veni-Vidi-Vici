import { useState } from 'react'
import Sidebar from './components/layout/Sidebar'
import Topbar from './components/layout/Topbar'
import Overview from './pages/Overview'
import ActionsApprovals from './pages/ActionsApprovals'
import ObligationsEvidence from './pages/ObligationsEvidence'
import ActivityLog from './pages/ActivityLog'
import type { PageId } from './types/guardian'
import { useDemoScenario } from './hooks/useDemoScenario'

export default function App() {
  const [page, setPage] = useState<PageId>('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const scenario = useDemoScenario()

  return <div className="app-shell">
    <Sidebar page={page} onNavigate={setPage} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    <div className="main-shell">
      <Topbar page={page} ready={scenario.readinessReady} onReset={() => { scenario.resetDemo(); setPage('overview'); setResetKey((key) => key + 1); setSidebarOpen(false) }} onMenu={() => setSidebarOpen(true)} />
      <main key={resetKey}>
        {page === 'overview' && <Overview scenario={scenario} onNavigate={setPage} />}
        {page === 'actions' && <ActionsApprovals scenario={scenario} />}
        {page === 'obligations' && <ObligationsEvidence scenario={scenario} />}
        {page === 'activity' && <ActivityLog scenario={scenario} />}
      </main>
    </div>
  </div>
}
