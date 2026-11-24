import { useState } from 'react'
import { ArrowRight, CalendarDays, Check, LockKeyhole, Mail, MapPin, ShieldCheck, UsersRound } from 'lucide-react'
import type { AgentAction, EventFacts } from '../../types/guardian'
import Modal from '../shared/Modal'
import StatusBadge from './StatusBadge'

interface ApprovalCardProps {
  action: AgentAction
  facts: EventFacts
  decision: 'pending' | 'approved' | 'rejected'
  providerAccepted: boolean
  onApprove: () => void
  onReject: () => void
  onSend: () => void
}

export default function ApprovalCard({ action, facts, decision, providerAccepted, onApprove, onReject, onSend }: ApprovalCardProps) {
  const [open, setOpen] = useState(false)
  const parameters = action.parameters!
  const close = () => setOpen(false)
  return <section className="panel approval-panel">
    <div className="panel-heading"><div><div className="panel-kicker">OWNER GATE</div><h2>Corrected invitation</h2></div><span className="approval-lock"><LockKeyhole size={16} /></span></div>
    <div className="proposal-agent"><span className="agent-avatar small"><Mail size={14} /></span><span><strong>Fresh Invitation Agent</strong><small>Proposed action · Synthetic recipients</small></span></div>
    <div className="proposal-facts">
      <div><UsersRound size={15} /><span><small>Recipient</small><strong>{parameters.recipient}</strong></span></div>
      <div><MapPin size={15} /><span><small>Venue</small><strong>{parameters.venue}</strong></span></div>
      <div><CalendarDays size={15} /><span><small>Event date</small><strong>{parameters.date}</strong></span></div>
    </div>
    <div className="proposal-version"><span>BOUND TO CURRENT FACTS</span><strong>V{parameters.factVersion}</strong><i>{parameters.venue} · {parameters.date}</i></div>
    <div className="approval-status-row"><span>Status</span><StatusBadge status={providerAccepted ? 'provider_accepted' : decision === 'approved' ? 'approved' : decision === 'rejected' ? 'rejected' : 'awaiting_approval'} compact /></div>
    <button className="button button-primary button-full" onClick={() => setOpen(true)}>{decision === 'pending' ? 'Review Action' : 'View Action Details'}<ArrowRight size={15} /></button>
    {decision === 'approved' && <button className="button button-send button-full" onClick={onSend} disabled={providerAccepted}><ShieldCheck size={15} />{providerAccepted ? 'Provider Accepted – Simulated' : 'Simulate Guarded Send'}</button>}
    {decision === 'rejected' && <div className="inline-callout red-callout">Rejected by owner. The simulated send remains unavailable.</div>}
    <p className="tiny-disclaimer">Approval applies only to these displayed parameters and event-facts version V{parameters.factVersion}.</p>
    <Modal open={open} onClose={close} eyebrow="OWNER APPROVAL · SIMULATION" title="Review proposed action" width="wide">
      <p className="modal-intro">Approval is bound to this exact invitation and its current event-fact dependencies. Changing the parameters requires a new approval.</p>
      <div className="modal-summary-grid">
        <div><span>Recipient</span><strong>{parameters.recipient}</strong></div>
        <div><span>Venue</span><strong>{parameters.venue}</strong></div>
        <div><span>Event date</span><strong>{parameters.date}</strong></div>
        <div><span>Fact version</span><strong>V{parameters.factVersion}</strong></div>
        <div><span>Action channel</span><strong>{parameters.channel}</strong></div>
        <div><span>Proposing agent</span><strong>Fresh Invitation Agent</strong></div>
      </div>
      <div className="dependency-box"><div className="dependency-head"><ShieldCheck size={15} /><strong>Bound dependencies</strong><span>{action.dependencies.every((dep) => dep.version === facts.version) ? 'All current' : 'Version mismatch'}</span></div>{action.dependencies.map((dep) => <div className="dependency-row" key={dep.fact}><span>{dep.fact.replaceAll('_', ' ')}</span><strong>{dep.value}</strong><em>V{dep.version} · {dep.version === facts.version ? 'current' : 'stale'}</em></div>)}</div>
      <div className="modal-action-footer"><span className="modal-sim-note"><LockKeyhole size={13} /> No email is sent from this prototype.</span><div className="modal-buttons"><button className="button button-outline" onClick={() => { onReject(); close() }} disabled={decision !== 'pending'}>Reject Action</button><button className="button button-primary" onClick={() => { onApprove(); close() }} disabled={decision !== 'pending'}><Check size={14} />{decision === 'approved' ? `Approved for V${parameters.factVersion}` : 'Approve Action'}</button></div></div>
    </Modal>
  </section>
}
