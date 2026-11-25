import { Check, ShieldCheck } from 'lucide-react'
import type { ReturnTypeUseDemoScenario } from './pageTypes'
import ApprovalCard from '../components/dashboard/ApprovalCard'
import ReviewerCard from '../components/dashboard/ReviewerCard'

export default function Decisions({ scenario }: { scenario: ReturnTypeUseDemoScenario }) {
  const invitation = scenario.actions.find((action) => action.id === 'invitation-current')
  if (!invitation) throw new Error('Current invitation action is missing from the demo scenario')

  return <div className="page-content subpage-content">
    <div className="page-heading-row"><div><div className="page-eyebrow"><span className="page-eyebrow-line" /> OWNER DECISIONS</div><h1>Decisions</h1><p>Review exact action proposals and independent advice. Neither can silently change the owner’s goals.</p></div><span className="subpage-count"><ShieldCheck size={14} />Owner-controlled</span></div>
    <div className="callout-strip"><span className="callout-icon"><Check size={16} /></span><div><strong>Two independent decision paths</strong><span>Action approval is bound to the displayed proposal and fact versions. Budget advice is non-authorizing and requires an explicit owner response.</span></div></div>
    <div className="decision-panels">
      <ApprovalCard action={invitation} facts={scenario.facts} decision={scenario.decision} providerAccepted={scenario.providerAccepted} killSwitchOn={scenario.killSwitchOn} onApprove={scenario.approveInvitation} onReject={scenario.rejectInvitation} onSend={scenario.simulateGuardedSend} />
      <ReviewerCard onDisposition={scenario.recordReviewDisposition} />
    </div>
  </div>
}
