import { useEffect, useState } from 'react'
import Sidebar from './components/layout/Sidebar'
import Topbar from './components/layout/Topbar'
import Overview from './pages/Overview'
import Decisions from './pages/Decisions'
import ActionsApprovals from './pages/ActionsApprovals'
import ObligationsEvidence from './pages/ObligationsEvidence'
import ActivityLog from './pages/ActivityLog'
import type { PageId } from './types/guardian'
import { useDemoScenario } from './hooks/useDemoScenario'

export default function App() {
  const [page, setPage] = useState<PageId>('goals')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const scenario = useDemoScenario()
  useEffect(() => {
    const syncCurrentSection = () => {
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
  }, [resetKey])
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

  return <div className={`app-shell ${scenario.killSwitchOn ? 'kill-switch-active' : ''}`}>
    <Sidebar page={page} onNavigate={navigate} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    <div className="main-shell">
      <Topbar page={page} ready={scenario.readinessReady} openObligations={scenario.openObligations} killSwitchOn={scenario.killSwitchOn} onKillSwitchChange={scenario.setKillSwitch} onReset={reset} onMenu={() => setSidebarOpen(true)} />
      {scenario.killSwitchOn && <div className="kill-switch-banner" role="status"><strong>Kill switch engaged.</strong> Simulated dispatch is disabled until the owner re-enables it.</div>}
      <main key={resetKey} className="console-dashboard">
        <section id="section-goals" className="dashboard-section"><Overview scenario={scenario} onNavigate={navigate} /></section>
        <section id="section-decisions" className="dashboard-section"><Decisions scenario={scenario} /></section>
        <section id="section-actions" className="dashboard-section"><ActionsApprovals scenario={scenario} /></section>
        <section id="section-readiness" className="dashboard-section"><ObligationsEvidence scenario={scenario} /></section>
        <section id="section-history" className="dashboard-section"><ActivityLog scenario={scenario} /></section>
      </main>
    </div>
  </div>
}
