import { useState } from 'react'
import { ChevronRight, Clock3, ShieldCheck } from 'lucide-react'
import type { AgentAction } from '../types/guardian'
import type { ReturnTypeUseDemoScenario } from './pageTypes'
import Modal from '../components/shared/Modal'
import StatusBadge from '../components/dashboard/StatusBadge'
import AutomationActivity from '../components/dashboard/AutomationActivity'

export default function ActionsApprovals({ scenario }: { scenario: ReturnTypeUseDemoScenario }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [proposeOpen, setProposeOpen] = useState(false)
  const [actionType, setActionType] = useState<'send_invitation_batch' | 'send_catering_update' | 'reconcile_sponsor_receipt'>('send_catering_update')
  const [recipient, setRecipient] = useState('catering@vendor.test')
  const [note, setNote] = useState('')
  const [required, setRequired] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const selected = scenario.actions.find((action) => action.id === selectedId)
  const status = (action: AgentAction) => action.status
  const approvalLabel = (action: AgentAction) => action.id === 'invitation-old' ? 'Superseded · not approvable' : action.approvalState === 'awaiting_organizer' ? 'Organizer approval pending' : action.approvalState === 'approved' ? `Approved · bound to V${action.parameters?.factVersion ?? scenario.facts.version}` : action.approvalState === 'rejected' ? 'Rejected by organizer' : 'Not required'
  const open = (action: AgentAction) => { setRejectReason(''); setSelectedId(action.id) }
  const roleForType = (typeName: string): 'invitations' | 'catering' => typeName === 'send_invitation_batch' ? 'invitations' : 'catering'
  const submitProposal = (event: React.FormEvent) => {
    event.preventDefault()
    const params: Record<string, unknown> = actionType === 'reconcile_sponsor_receipt'
      ? { receipt_id: note.trim() || `receipt-${Date.now()}`, note: note.trim() || 'Sponsor receipt check' }
      : { recipients: [recipient.trim()], venue: scenario.facts.venue, event_date: scenario.facts.date, note: note.trim() || undefined }
    void scenario.createAction(actionType, params, required, roleForType(actionType)).then(() => {
      setProposeOpen(false)
      setNote('')
    })
  }
  return <div className="page-content subpage-content">
    <div className="page-heading-row"><div><div className="page-eyebrow"><span className="page-eyebrow-line" /> ACTION LIFECYCLE</div><h1>Actions</h1><p>See what services proposed, what version control blocked, and which work remains current.</p></div><div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>{scenario.apiMode && <button className="button button-primary" onClick={() => setProposeOpen(true)} disabled={scenario.apiBusy}>+ Propose action</button>}<span className="subpage-count"><strong>{scenario.actions.length}</strong> tracked actions</span></div></div>
    {scenario.apiMode
      ? <div className="callout-strip"><span className="callout-icon"><ShieldCheck size={16} /></span><div><strong>Persistent action state</strong><span>Action proposals, owner decisions, execution claims, and denials are loaded from the Guardian API audit trail.</span></div></div>
      : <AutomationActivity activities={scenario.activities} onSimulate={scenario.simulateStaleAttempt} />}
    <div className="callout-strip"><span className="callout-icon"><ShieldCheck size={16} /></span><div><strong>Approval is proposal-bound</strong><span>Organizer approval applies only to the exact proposal and fact versions reviewed in Decisions. Stale actions cannot be approved.</span></div></div>
    <div className="action-list">{scenario.actions.map((action) => <button className={`action-row action-row-${action.status}`} key={action.id} onClick={() => open(action)}>
      <span className={`action-row-icon ${action.status === 'stale' ? 'row-icon-red' : action.status === 'reconfirmation_required' ? 'row-icon-amber' : action.status === 'valid' || action.status === 'confirmed' ? 'row-icon-green' : 'row-icon-blue'}`}><ShieldCheck size={17} /></span>
      <span className="action-row-main"><span className="action-row-title">{action.name}<span className="agent-tag">{action.agent}</span></span><span className="action-row-meta"><span>Depends on {action.dependencies.map((dependency) => `${dependency.fact.replaceAll('_', ' ')}: ${dependency.value}`).join(' · ')}</span><span className="version-tag">V{action.version}{action.version === scenario.facts.version ? ' · current' : ' · prior'}</span></span><span className="action-row-reason">{action.reason}</span></span>
      <span className="action-row-side"><StatusBadge status={status(action)} compact /><span className={`approval-label ${action.approvalState === 'approved' ? 'approval-green' : action.approvalState === 'awaiting_organizer' ? 'approval-amber' : ''}`}><span />{approvalLabel(action)}</span></span>
      <ChevronRight size={17} className="action-chevron" />
    </button>)}</div>
    <div className="action-page-foot"><span><Clock3 size={14} />{scenario.apiMode ? 'Execution claims are persistent authorization records only; no email or vendor request is sent.' : 'Demo actions only; no email or vendor request is sent.'}</span></div>
    <Modal open={Boolean(selected)} onClose={() => setSelectedId(null)} eyebrow={scenario.apiMode ? 'ACTION DETAIL · GUARDIAN API' : 'ACTION DETAIL · DEMO'} title={selected?.name ?? 'Action details'} width="wide">
      {selected && <>
        <div className="detail-modal-status"><StatusBadge status={selected.status} /><span>Proposed by <strong>{selected.agent}</strong></span></div>
        <p className="modal-intro">{selected.reason}</p>
        {selected.parameters && <div className="modal-summary-grid"><div><span>Recipient</span><strong>{selected.parameters.recipient}</strong></div><div><span>Venue</span><strong>{selected.parameters.venue}</strong></div><div><span>Event date</span><strong>{selected.parameters.date}</strong></div><div><span>Fact version</span><strong>V{selected.parameters.factVersion}</strong></div><div><span>Channel</span><strong>{selected.parameters.channel}</strong></div><div><span>Approval state</span><strong>{approvalLabel(selected)}</strong></div></div>}
        <div className="dependency-box"><div className="dependency-head"><ShieldCheck size={15} /><strong>Event fact dependencies</strong><span>{selected.dependencies.every((dependency) => dependency.current ?? dependency.version === scenario.facts.version) ? 'Current' : 'Version mismatch'}</span></div>{selected.dependencies.map((dependency) => <div className="dependency-row" key={dependency.fact}><span>{dependency.fact.replaceAll('_', ' ')}</span><strong>{dependency.value}</strong><em>V{dependency.version}{(dependency.current ?? dependency.version === scenario.facts.version) ? ' · current' : ' · stale'}</em></div>)}</div>
        <div className="detail-meta-grid"><div><span>Fact version</span><strong>V{selected.version}</strong></div><div><span>Organizer approval</span><strong>{approvalLabel(selected)}</strong></div><div><span>Proposal revision</span><strong>{selected.revision ? `Revision ${selected.revision}` : 'Preview · not persisted'}</strong></div></div>
        {scenario.apiMode && selected.backendActionId && selected.revision && selected.status === 'awaiting_approval' && (
          <label className="reason-field">Reason for rejection (if rejecting)
            <textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Explain why this action revision is rejected." rows={2} />
          </label>
        )}
        <div className="modal-action-footer">
          <span className="modal-sim-note">{selected.backendActionId ? 'Persisted in SQLite; claims do not dispatch external email.' : 'This is a local preview; the API records it when an organizer decides.'}</span>
          <div className="modal-buttons">
            {scenario.apiMode && selected.backendActionId && selected.revision && selected.status === 'awaiting_approval' && (
              <>
                <button className="button button-danger" disabled={!rejectReason.trim() || scenario.apiBusy} onClick={() => { void scenario.rejectAction(selected.backendActionId!, selected.revision!, rejectReason); setSelectedId(null) }}>Reject</button>
                <button className="button button-primary" disabled={scenario.apiBusy} onClick={() => { void scenario.approveAction(selected.backendActionId!, selected.revision!); setSelectedId(null) }}>Approve</button>
              </>
            )}
            {scenario.apiMode && selected.backendActionId && selected.revision && selected.status === 'approved' && (
              <button className="button button-send" disabled={scenario.apiBusy || scenario.pauseAutomationOn} onClick={() => { void scenario.claimAction(selected.backendActionId!, selected.revision!, selected.agent.includes('Invitation') ? 'invitations' : 'catering'); setSelectedId(null) }}>Request claim</button>
            )}
            <button className="button button-outline" onClick={() => setSelectedId(null)}>Close</button>
          </div>
        </div>
      </>}
    </Modal>
    <Modal open={proposeOpen} onClose={() => setProposeOpen(false)} eyebrow="AGENT PROPOSAL · GUARDIAN API" title="Propose a new action" width="wide">
      <form onSubmit={submitProposal} style={{ display: 'grid', gap: '12px' }}>
        <label className="reason-field">Action template
          <select value={actionType} onChange={(event) => {
            const next = event.target.value as typeof actionType
            setActionType(next)
            setRecipient(next === 'send_invitation_batch' ? 'guest@example.test' : 'catering@vendor.test')
          }}>
            <option value="send_invitation_batch">send_invitation_batch (Invitations agent)</option>
            <option value="send_catering_update">send_catering_update (Catering agent)</option>
            <option value="reconcile_sponsor_receipt">reconcile_sponsor_receipt (Sponsor check)</option>
          </select>
        </label>
        {actionType !== 'reconcile_sponsor_receipt' && (
          <label className="reason-field">Allowlisted recipient (@example.test or @vendor.test)
            <input value={recipient} onChange={(event) => setRecipient(event.target.value)} required />
          </label>
        )}
        <label className="reason-field">{actionType === 'reconcile_sponsor_receipt' ? 'Receipt ID / reference' : 'Optional note'}
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder={actionType === 'reconcile_sponsor_receipt' ? 'e.g. rcpt-2026-01' : 'Optional details'} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          <input type="checkbox" checked={required} onChange={(event) => setRequired(event.target.checked)} />
          Required for event readiness
        </label>
        <div className="modal-action-footer">
          <span className="modal-sim-note">Bound automatically to current fact versions in SQLite.</span>
          <div className="modal-buttons">
            <button type="button" className="button button-outline" onClick={() => setProposeOpen(false)}>Cancel</button>
            <button type="submit" className="button button-primary" disabled={scenario.apiBusy}>Propose action</button>
          </div>
        </div>
      </form>
    </Modal>
  </div>
}
