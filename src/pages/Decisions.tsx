import { Check, ShieldCheck } from 'lucide-react'
import type { ReturnTypeUseDemoScenario } from './pageTypes'
import ApprovalCard from '../components/dashboard/ApprovalCard'
import ReviewerCard from '../components/dashboard/ReviewerCard'

export default function Decisions({ scenario }: { scenario: ReturnTypeUseDemoScenario }) {
  const invitation =
    scenario.actions.find((action) => action.id === 'invitation-current') ??
    scenario.actions.find((action) => action.status !== 'stale') ??
    scenario.actions[0]

  return <div className="page-content subpage-content">
    <div className="page-heading-row"><div><div className="page-eyebrow"><span className="page-eyebrow-line" /> ORGANIZER DECISIONS</div><h1>Decisions</h1><p>Review exact action proposals and independent advice. Neither can silently change the owner’s goals.</p></div><span className="subpage-count"><ShieldCheck size={14} />Organizer-controlled</span></div>
    <div className="callout-strip"><span className="callout-icon"><Check size={16} /></span><div><strong>Two independent decision paths</strong><span>Action approval is bound to the displayed proposal and fact versions. Budget advice is non-authorizing and requires an explicit organizer response.</span></div></div>
    <div className="decision-panels">
      {invitation
        ? <ApprovalCard action={invitation} facts={scenario.facts} decision={scenario.decision} providerAccepted={scenario.providerAccepted} pauseAutomationOn={scenario.pauseAutomationOn} apiMode={scenario.apiMode} apiBusy={scenario.apiBusy} claimRecorded={scenario.claimRecorded} onApprove={scenario.approveInvitation} onReject={scenario.rejectInvitation} onSend={scenario.simulateGuardedSend} />
        : <section className="panel approval-panel">
            <div className="panel-heading"><div><div className="panel-kicker">ORGANIZER GATE</div><h2>No pending proposals</h2></div></div>
            <p className="tiny-disclaimer">No actions are currently stored in SQLite for this workspace. Propose an invitation batch or another action from the Actions section.</p>
            <button
              className="button button-primary button-full"
              disabled={scenario.apiBusy}
              onClick={() => void scenario.createAction('send_invitation_batch', { recipients: ['guest@example.test'], venue: scenario.facts.venue, event_date: scenario.facts.date }, false, 'invitations')}
            >
              Propose invitation batch ({scenario.facts.venue} · V{scenario.facts.version})
            </button>
          </section>}
      <ReviewerCard onDisposition={scenario.recordReviewDisposition} apiMode={scenario.apiMode} facts={scenario.facts} openObligations={scenario.openObligations} persistedDispositions={scenario.reviewDispositions} />
    </div>
  </div>
}
