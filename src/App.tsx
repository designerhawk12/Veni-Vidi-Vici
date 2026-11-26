import { useEffect, useLayoutEffect, useState } from 'react'
import Sidebar from './components/layout/Sidebar'
import Topbar from './components/layout/Topbar'
import Overview from './pages/Overview'
import Decisions from './pages/Decisions'
import ActionsApprovals from './pages/ActionsApprovals'
import ObligationsEvidence from './pages/ObligationsEvidence'
import ActivityLog from './pages/ActivityLog'
import type { PageId } from './types/guardian'
import { useDemoScenario } from './hooks/useDemoScenario'
import WorkspaceSetup from './pages/WorkspaceSetup'

interface AppProps { demo?: boolean }

export default function App({ demo = false }: AppProps) {
  const [page, setPage] = useState<PageId>('goals')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const [workspaceCreated, setWorkspaceCreated] = useState(
    () => window.localStorage.getItem('guardian-workspace-created') === 'true',
  )
  const scenario = useDemoScenario({ forceDemo: demo })
  const workspaceReady = demo || (workspaceCreated && !scenario.isWorkspaceEmpty)
  useLayoutEffect(() => {
    window.history.scrollRestoration = 'manual'
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [])
  useEffect(() => {
    const syncCurrentSection = () => {
      if (!workspaceReady) {
        setPage('goals')
        return
      }
      const sections = (['goals', 'decisions', 'actions', 'readiness', 'history'] as const)
        .map((id) => ({ id, top: document.getElementById(`section-${id}`)?.getBoundingClientRect().top ?? Number.NEGATIVE_INFINITY }))
        .filter((section) => section.top <= 120)
      const current = sections.at(-1)?.id ?? 'goals'
      setPage((previous) => previous === current ? previous : current)
    }
    syncCurrentSection()
    window.addEventListener('scroll', syncCurrentSection, { passive: true })
    window.addEventListener('resize', syncCurrentSection)
    return () => {
      window.removeEventListener('scroll', syncCurrentSection)
      window.removeEventListener('resize', syncCurrentSection)
    }
  }, [resetKey, workspaceReady])
  const navigate = (nextPage: PageId) => {
    setPage(nextPage)
    setSidebarOpen(false)
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    requestAnimationFrame(() => document.getElementById(`section-${nextPage}`)?.scrollIntoView({ behavior, block: 'start' }))
  }
  const reset = () => {
    scenario.resetDemo()
    setPage('goals')
    setResetKey((key) => key + 1)
    setSidebarOpen(false)
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }

  return <div className={`app-shell ${scenario.pauseAutomationOn ? 'pause-automation-active' : ''} ${!workspaceReady ? 'workspace-not-created' : ''}`}>
    <Sidebar page={workspaceReady ? page : null} workspaceName={workspaceReady ? (demo ? 'Product demo' : scenario.facts.name) : 'No workspace yet'} workspaceReady={workspaceReady} onNavigate={navigate} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    <div className="main-shell">
      {workspaceReady && <Topbar page={page} eventName={scenario.facts.name} ready={scenario.readinessReady} openObligations={scenario.openObligations} pauseAutomationOn={scenario.pauseAutomationOn} apiMode={scenario.apiMode} onPauseAutomationChange={scenario.setPauseAutomation} onReset={reset} onMenu={() => setSidebarOpen(true)} />}
      {scenario.apiMode && <div className={`api-connection-banner ${scenario.apiError ? 'api-connection-error' : ''}`} role={scenario.apiError ? 'alert' : 'status'}>
        <span className="api-connection-indicator" />
        <span>{scenario.apiError ? `Guardian API unavailable: ${scenario.apiError}` : scenario.apiLoading ? 'Connecting to the persistent Guardian API…' : scenario.apiBusy ? 'Saving to the Guardian API…' : 'Connected to the persistent Guardian API. Changes are recorded in SQLite.'}</span>
        {scenario.apiError && <button className="button button-quiet" onClick={() => void scenario.resetDemo()}>Retry</button>}
      </div>}
      {workspaceReady && scenario.pauseAutomationOn && <div className="pause-automation-banner" role="status"><strong>Execution claims paused.</strong> The Guardian API will deny new claims until the organizer re-enables them.</div>}
      {!workspaceReady
        ? <WorkspaceSetup scenario={scenario} onCreated={() => {
            window.localStorage.setItem('guardian-workspace-created', 'true')
            setWorkspaceCreated(true)
            setPage('goals')
            requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }))
          }} />
        : scenario.apiMode && !scenario.apiReady
        ? <main className="api-loading-state" role="status">{scenario.apiLoading ? 'Loading persistent event state…' : 'The dashboard is unavailable until the Guardian API responds. Retry the connection above.'}</main>
        : <main key={resetKey} className="console-dashboard">
          <section id="section-goals" className="dashboard-section"><Overview scenario={scenario} onNavigate={navigate} /></section>
          <section id="section-decisions" className="dashboard-section"><Decisions scenario={scenario} /></section>
          <section id="section-actions" className="dashboard-section"><ActionsApprovals scenario={scenario} /></section>
          <section id="section-readiness" className="dashboard-section"><ObligationsEvidence scenario={scenario} /></section>
          <section id="section-history" className="dashboard-section"><ActivityLog scenario={scenario} /></section>
        </main>}
    </div>
  </div>
}
