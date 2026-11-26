import { useState } from 'react'
import { Activity, Filter, ShieldCheck } from 'lucide-react'
import type { ReturnTypeUseDemoScenario } from './pageTypes'
import Timeline from '../components/shared/Timeline'

export default function ActivityLog({ scenario }: { scenario: ReturnTypeUseDemoScenario }) {
  const [integrity, setIntegrity] = useState<{ valid: boolean; entries?: number; broken_at?: number } | null>(null)
  const verify = async () => {
    if (!scenario.apiMode) return
    setIntegrity(await scenario.verifyAudit())
  }
  const chronological = [...scenario.activities].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  return <div className="page-content subpage-content activity-page">
    <div className="page-heading-row"><div><div className="page-eyebrow"><span className="page-eyebrow-line" /> HISTORY</div><h1>History</h1><p>A chronological view of decisions and version controls.</p></div><span className="subpage-count"><Activity size={14} />{chronological.length} events</span></div>
    <div className="callout-strip activity-callout"><span className="callout-icon"><ShieldCheck size={16} /></span><div><strong>{scenario.apiMode ? 'Persistent audit trail' : 'Demo timeline'}</strong><span>{scenario.apiMode ? 'Entries are loaded from the backend audit log.' : 'Demo data only.'}</span>{integrity && <span role="status">{integrity.valid ? `Integrity verified · ${integrity.entries ?? 0} entries` : `Integrity check failed at entry ${integrity.broken_at}`}</span>}</div>{scenario.apiMode && <button className="button button-outline" onClick={() => void verify()}>Verify integrity</button>}<span className="timeline-filter"><Filter size={14} />All events</span></div>
    <section className="panel audit-panel"><div className="audit-panel-heading"><div><div className="panel-kicker">{scenario.facts.name.toUpperCase()} · EVENT ACTIVITY</div><h2>Event activity</h2></div><span className="audit-version"><span className="version-pulse" />CURRENT FACTS V{scenario.facts.version}</span></div><Timeline items={chronological} /></section>
    <div className="activity-footnote"><span className="footer-dot" />{scenario.apiMode ? 'Backend audit events · server timestamps' : 'Demo activity records · timestamps use local browser time for newly generated demo events'}</div>
  </div>
}
