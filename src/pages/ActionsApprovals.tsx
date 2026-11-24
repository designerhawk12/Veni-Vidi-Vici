import { useState } from 'react'
import { ArrowUpRight, Check, ChevronRight, Clock3, ShieldCheck } from 'lucide-react'
import type { AgentAction } from '../types/guardian'
import type { ReturnTypeUseDemoScenario } from './pageTypes'
import Modal from '../components/shared/Modal'
import StatusBadge from '../components/dashboard/StatusBadge'

export default function ActionsApprovals({ scenario }: { scenario: ReturnTypeUseDemoScenario }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = scenario.actions.find((action) => action.id === selectedId)
  const status = (action: AgentAction) => action.status
  const approvalLabel = (action: AgentAction) => action.id === 'invitation-old' ? 'Superseded · not approvable' : action.approvalState === 'awaiting_owner' ? 'Owner approval pending' : action.approvalState === 'approved' ? 'Approved · bound to V2' : action.approvalState === 'rejected' ? 'Rejected by owner' : 'Not required'
  const open = (action: AgentAction) => setSelectedId(action.id)
  return <div className="page-content subpage-content">
    <div className="page-heading-row"><div><div className="page-eyebrow"><span className="page-eyebrow-line" /> GUARDIAN GATE</div><h1>Actions &amp; Approvals</h1><p>Every proposed action is checked against the event facts it depends on.</p></div><span className="subpage-count"><strong>{scenario.actions.length}</strong> tracked actions</span></div>
    <div className="callout-strip"><span className="callout-icon"><ShieldCheck size={16} /></span><div><strong>Approval is version-bound</strong><span>Owner approval applies only to the exact displayed parameters and V2 event facts. Stale V1 actions cannot be approved.</span></div></div>
    <div className="action-list">{scenario.actions.map((action) => <button className={`action-row action-row-${action.status}`} key={action.id} onClick={() => open(action)}>
      <span className={`action-row-icon ${action.status === 'stale' ? 'row-icon-red' : action.status === 'reconfirmation_required' ? 'row-icon-amber' : action.status === 'valid' || action.status === 'confirmed' ? 'row-icon-green' : 'row-icon-blue'}`}><ShieldCheck size={17} /></span>
      <span className="action-row-main"><span className="action-row-title">{action.name}<span className="agent-tag">{action.agent}</span></span><span className="action-row-meta"><span>Depends on {action.dependencies.map((dependency) => `${dependency.fact.replaceAll('_', ' ')}: ${dependency.value}`).join(' · ')}</span><span className="version-tag">V{action.version}{action.version === scenario.facts.version ? ' · current' : ' · prior'}</span></span><span className="action-row-reason">{action.reason}</span></span>
      <span className="action-row-side"><StatusBadge status={status(action)} compact /><span className={`approval-label ${action.approvalState === 'approved' ? 'approval-green' : action.approvalState === 'awaiting_owner' ? 'approval-amber' : ''}`}><span />{approvalLabel(action)}</span></span>
      <ChevronRight size={17} className="action-chevron" />
    </button>)}</div>
    <div className="action-page-foot"><span><Clock3 size={14} /> Prototype actions are simulated; no email or vendor request is sent.</span><button className="text-button" onClick={() => open(scenario.actions.find((action) => action.id === 'invitation-current')!)}>Review updated invitation <ArrowUpRight size={14} /></button></div>
    <Modal open={Boolean(selected)} onClose={() => setSelectedId(null)} eyebrow="ACTION DETAIL · FRONTEND PROTOTYPE" title={selected?.name ?? 'Action details'} width="wide">
      {selected && <>
        <div className="detail-modal-status"><StatusBadge status={selected.status} /><span>Proposed by <strong>{selected.agent}</strong></span></div>
        <p className="modal-intro">{selected.reason}</p>
        {selected.parameters && <div className="modal-summary-grid"><div><span>Recipient</span><strong>{selected.parameters.recipient}</strong></div><div><span>Venue</span><strong>{selected.parameters.venue}</strong></div><div><span>Event date</span><strong>{selected.parameters.date}</strong></div><div><span>Fact version</span><strong>V{selected.parameters.factVersion}</strong></div><div><span>Channel</span><strong>{selected.parameters.channel}</strong></div><div><span>Approval state</span><strong>{approvalLabel(selected)}</strong></div></div>}
        <div className="dependency-box"><div className="dependency-head"><ShieldCheck size={15} /><strong>Event fact dependencies</strong><span>{selected.dependencies.every((dependency) => dependency.version === scenario.facts.version) ? 'Current' : 'Version mismatch'}</span></div>{selected.dependencies.map((dependency) => <div className="dependency-row" key={dependency.fact}><span>{dependency.fact.replaceAll('_', ' ')}</span><strong>{dependency.value}</strong><em>V{dependency.version}{dependency.version === scenario.facts.version ? ' · current' : ' · stale'}</em></div>)}</div>
        <div className="detail-meta-grid"><div><span>Action version</span><strong>V{selected.version}</strong></div><div><span>Owner approval</span><strong>{approvalLabel(selected)}</strong></div><div><span>Current event facts</span><strong>Venue B · V2</strong></div></div>
        {selected.id === 'invitation-current' && <div className="modal-action-footer"><span className="modal-sim-note">Approval only permits the guarded test action.</span><div className="modal-buttons">{scenario.decision === 'pending' ? <><button className="button button-outline" onClick={() => { scenario.rejectInvitation(); setSelectedId(null) }}>Reject Action</button><button className="button button-primary" onClick={() => { scenario.approveInvitation(); setSelectedId(null) }}><Check size={14} />Approve Action</button></> : scenario.decision === 'approved' && !scenario.providerAccepted ? <button className="button button-send" onClick={scenario.simulateGuardedSend}><ShieldCheck size={14} />Simulate Guarded Send</button> : <span className="approved-note"><Check size={14} />{scenario.providerAccepted ? 'Provider Accepted – Simulated' : 'Action rejected'}</span>}</div></div>}
        {selected.id !== 'invitation-current' && <div className="modal-action-footer"><span className="modal-sim-note">No external integrations are connected.</span><button className="button button-outline" onClick={() => setSelectedId(null)}>Close</button></div>}
      </>}
    </Modal>
  </div>
}
