import { Activity, Filter, ShieldCheck } from 'lucide-react'
import type { ReturnTypeUseDemoScenario } from './pageTypes'
import Timeline from '../components/shared/Timeline'

export default function ActivityLog({ scenario }: { scenario: ReturnTypeUseDemoScenario }) {
  const chronological = [...scenario.activities].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  return <div className="page-content subpage-content activity-page">
    <div className="page-heading-row"><div><div className="page-eyebrow"><span className="page-eyebrow-line" /> HISTORY</div><h1>History</h1><p>A chronological view of simulated decisions and Guardian controls.</p></div><span className="subpage-count"><Activity size={14} />{chronological.length} events</span></div>
    <div className="callout-strip activity-callout"><span className="callout-icon"><ShieldCheck size={16} /></span><div><strong>Local demo timeline · not an audit log</strong><span>Entries come from in-memory frontend state. Authoritative persistent API audit history is not connected to this screen.</span></div><span className="timeline-filter"><Filter size={14} />All events</span></div>
    <section className="panel audit-panel"><div className="audit-panel-heading"><div><div className="panel-kicker">TECHMEET 2026 · 24 NOV 2026</div><h2>Event activity</h2></div><span className="audit-version"><span className="version-pulse" />CURRENT FACTS V2</span></div><Timeline items={chronological} /></section>
    <div className="activity-footnote"><span className="footer-dot" />Simulated activity records · timestamps use local browser time for newly generated demo events</div>
  </div>
}
