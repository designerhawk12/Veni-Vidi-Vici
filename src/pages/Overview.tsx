import { useState } from 'react'
import { ArrowDown, ArrowUpRight, ClipboardList, ShieldAlert, ShieldCheck, Waypoints } from 'lucide-react'
import type { AgentAction, PageId } from '../types/guardian'
import type { ReturnTypeUseDemoScenario } from './pageTypes'
import EventDetails from '../components/dashboard/EventDetails'
import MetricCard from '../components/dashboard/MetricCard'
import ActionImpactCard from '../components/dashboard/ActionImpactCard'
import AgentActivity from '../components/dashboard/AgentActivity'
import ApprovalCard from '../components/dashboard/ApprovalCard'
import ReviewerCard from '../components/dashboard/ReviewerCard'
import ReadinessCard from '../components/dashboard/ReadinessCard'
import Modal from '../components/shared/Modal'
import StatusBadge from '../components/dashboard/StatusBadge'

interface OverviewProps { scenario: ReturnTypeUseDemoScenario; onNavigate: (page: PageId) => void }

export default function Overview({ scenario, onNavigate }: OverviewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = scenario.actions.find((action) => action.id === selectedId)
  const showAction = (action: AgentAction) => setSelectedId(action.id)
  const impacted = scenario.actions.filter((action) => ['invitation-old', 'catering', 'sponsor-receipt'].includes(action.id))
  const selectedStatus = selected?.status === 'stale' ? 'stale' : selected?.status === 'reconfirmation_required' ? 'reconfirmation_required' : selected?.status === 'confirmed' ? 'confirmed' : 'valid'
  return <div className="page-content overview-page">
    <div className="page-heading-row"><div><div className="page-eyebrow"><span className="page-eyebrow-line" /> EVENT OPERATIONS</div><h1>TechMeet 2026</h1><p>Event Operations &amp; Guardian Control Center</p></div><button className="button button-quiet" onClick={() => onNavigate('actions')}>View all actions <ArrowUpRight size={15} /></button></div>
    <EventDetails facts={scenario.facts} />
    <section className="venue-alert">
      <div className="venue-alert-icon"><ShieldAlert size={18} /></div>
      <div className="venue-alert-main"><div className="venue-alert-title">Venue Change Detected <span>· Guardian control active</span></div><p>The event venue has changed from Venue A to Venue B. Dependent actions have been reviewed. Outdated invitations are now blocked, while unrelated records remain valid.</p><div className="venue-version-flow"><div className="venue-old"><span>PREVIOUS VENUE</span><strong>Venue A</strong><small>Fact version V1</small></div><ArrowDown className="version-arrow" size={16} /><div className="venue-new"><span>CURRENT VENUE</span><strong>Venue B</strong><small>Fact version V2</small></div><div className="venue-flow-note"><span className="flow-note-dot" />Only dependent actions were invalidated</div></div></div>
      <div className="alert-side"><span>CHANGE REVIEW</span><strong>{String(scenario.affectedActions).padStart(2, '0')}</strong><small>actions affected</small></div>
    </section>
    <div className="metrics-grid">
      <MetricCard label="Affected Actions" value={scenario.affectedActions} detail="Venue-dependent work" icon={Waypoints} tone="amber" />
      <MetricCard label="Unaffected Actions" value={scenario.unaffectedActions} detail="Sponsor receipt retained" icon={ShieldCheck} tone="green" />
      <MetricCard label="Open Obligations" value={scenario.openObligations} detail={scenario.readinessReady ? 'Mandatory records satisfied' : 'Catering confirmation pending'} icon={ClipboardList} tone={scenario.openObligations ? 'amber' : 'green'} />
      <MetricCard label="Current Fact Version" value={`V${scenario.facts.version}`} detail={`${scenario.facts.venue} · current truth`} icon={ShieldAlert} tone="blue" />
    </div>
    <section className="section-block"><div className="section-heading"><div><div className="panel-kicker">DEPENDENCY IMPACT</div><h2>Action impact analysis</h2></div><span className="section-meta">{impacted.length} records reviewed <span>·</span> {scenario.unaffectedActions} unchanged</span></div><div className="impact-grid">{impacted.map((action) => <ActionImpactCard key={action.id} action={action} onOpen={showAction} />)}</div></section>
    <div className="overview-grid overview-grid-main"><AgentActivity activities={scenario.activities} onSimulate={scenario.simulateStaleAttempt} /><ApprovalCard action={scenario.actions.find((action) => action.id === 'invitation-current')!} facts={scenario.facts} decision={scenario.decision} providerAccepted={scenario.providerAccepted} onApprove={scenario.approveInvitation} onReject={scenario.rejectInvitation} onSend={scenario.simulateGuardedSend} /></div>
    <div className="overview-grid overview-grid-bottom"><ReviewerCard /><ReadinessCard ready={scenario.readinessReady} providerAccepted={scenario.providerAccepted} vendorConfirmed={scenario.vendorConfirmed} /></div>
    <div className="overview-footer"><span><span className="footer-dot" /> FRONTEND PROTOTYPE</span><span>All actions and evidence shown are simulated</span></div>
    <Modal open={Boolean(selected)} onClose={() => setSelectedId(null)} eyebrow="ACTION IMPACT · SIMULATED" title={selected?.name ?? 'Action details'}>
      {selected && <><div className="detail-modal-status"><StatusBadge status={selectedStatus} /><span>Proposed by {selected.agent}</span></div><p className="modal-intro">{selected.reason}</p><div className="modal-summary-grid">{selected.parameters ? <><div><span>Recipient</span><strong>{selected.parameters.recipient}</strong></div><div><span>Venue</span><strong>{selected.parameters.venue}</strong></div><div><span>Event date</span><strong>{selected.parameters.date}</strong></div><div><span>Fact version</span><strong>V{selected.parameters.factVersion}</strong></div></> : <><div><span>Record</span><strong>{selected.name}</strong></div><div><span>Current status</span><strong>{selected.status.replaceAll('_', ' ')}</strong></div></>}<div><span>Approval state</span><strong>{selected.approvalState.replaceAll('_', ' ')}</strong></div></div><div className="dependency-box"><div className="dependency-head"><ShieldCheck size={15} /><strong>Event fact dependencies</strong></div>{selected.dependencies.map((dep) => <div className="dependency-row" key={dep.fact}><span>{dep.fact.replaceAll('_', ' ')}</span><strong>{dep.value}</strong><em>V{dep.version}{dep.version === scenario.facts.version ? ' · current' : ' · stale'}</em></div>)}</div><div className="modal-action-footer"><span className="modal-sim-note">No external systems are connected.</span><button className="button button-outline" onClick={() => setSelectedId(null)}>Close</button></div></>}
    </Modal>
  </div>
}
