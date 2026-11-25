import { Check, CircleDashed, FileCheck2, Inbox, ShieldAlert, ShieldCheck, Truck } from 'lucide-react'
import type { EvidenceRecord, Obligation } from '../types/guardian'
import type { ReturnTypeUseDemoScenario } from './pageTypes'
import { formatTimestamp } from '../components/shared/Timeline'
import StatusBadge from '../components/dashboard/StatusBadge'
import ReadinessPanel from '../components/dashboard/ReadinessPanel'
import EvidenceStepper from '../components/dashboard/EvidenceStepper'
import InsightCards from '../components/dashboard/InsightCards'
import ChatPanel from '../components/dashboard/ChatPanel'
import { useAdvisor } from '../hooks/useAdvisor'

const icons = { 'guest-delivery': Inbox, 'catering-confirmation': Truck, 'sponsor-receipt-obligation': FileCheck2 }

function EvidenceItem({ item }: { item: EvidenceRecord }) {
  return <div className={`evidence-item ${item.accepted ? 'evidence-accepted' : 'evidence-rejected'}`}>
    <span className="evidence-mark">{item.accepted ? <Check size={13} /> : <ShieldAlert size={13} />}</span>
    <div className="evidence-copy"><div className="evidence-title-row"><strong>{item.title}</strong><time>{formatTimestamp(item.timestamp)}</time></div><p>{item.detail}</p><div className="evidence-tags">{item.venue && <span>{item.venue}</span>}{item.factVersion && <span>Fact V{item.factVersion}</span>}{!item.accepted && <span className="tag-rejected">Not applied</span>}</div></div>
  </div>
}

function ObligationCard({ obligation, evidence, scenario }: { obligation: Obligation; evidence: EvidenceRecord[]; scenario: ReturnTypeUseDemoScenario }) {
  const Icon = icons[obligation.id as keyof typeof icons] ?? FileCheck2
  const badgeStatus = obligation.status
  return <article className={`obligation-card obligation-${obligation.id}`}>
    <div className="obligation-card-head"><span className={`obligation-icon ${obligation.status === 'confirmed' || obligation.status === 'verified' ? 'icon-ready' : obligation.status === 'awaiting_confirmation' ? 'icon-wait' : 'icon-pending'}`}><Icon size={17} /></span><div className="obligation-title-block"><h3>{obligation.name}</h3><span>{obligation.mandatoryForReadiness ? 'Mandatory readiness record' : 'Delivery readback · not counterparty confirmation'}</span></div><StatusBadge status={badgeStatus} compact /></div>
    <p className="obligation-description">{obligation.description}</p>
    <div className="obligation-fact-row"><div><span>Required facts</span><strong>{obligation.requiredVenue ? `${obligation.requiredVenue} · V${obligation.requiredVersion}` : 'Venue independent'}</strong></div><div><span>Evidence state</span><strong>{evidence.filter((item) => item.accepted).length ? 'Recorded' : 'Awaiting evidence'}</strong></div></div>
    {obligation.id === 'catering-confirmation' && (scenario.apiMode
      ? <div className="obligation-note" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
          <span><ShieldCheck size={14} /> {scenario.openCorrelationToken ? `Open token: ${scenario.openCorrelationToken}` : 'Current arrangement confirmed in SQLite.'}</span>
          {scenario.openCorrelationToken && (
            <a className="button button-primary" href={`/vendor?token=${encodeURIComponent(scenario.openCorrelationToken)}`}>Open Vendor Portal</a>
          )}
        </div>
      : <div className="vendor-controls"><button className="button button-primary" onClick={scenario.simulateCurrentVendorReply} disabled={scenario.vendorConfirmed}><Check size={14} />{scenario.vendorConfirmed ? 'Current Reply Verified' : 'Demo Current Vendor Reply'}</button><button className="button button-outline button-late" onClick={scenario.simulateLateVendorReply} disabled={scenario.lateReplyAdded}><ShieldAlert size={14} />{scenario.lateReplyAdded ? 'Late Reply Recorded' : 'Demo Late Venue A Reply'}</button><span>Both replies are demo.</span></div>)}
    {obligation.id === 'guest-delivery' && <div className="obligation-note"><CircleDashed size={14} />{scenario.apiMode ? 'No outbound email connector is configured; execution claims record authorization only.' : scenario.providerAccepted ? 'Provider acceptance/readback recorded for V2. Recipient delivery is not confirmed.' : 'Initially pending. Use the approved action to demo provider acceptance; no actual email is sent.'}</div>}
    {obligation.id === 'sponsor-receipt-obligation' && <div className="obligation-note note-green"><ShieldCheck size={14} />Unchanged by the venue update; the valid receipt evidence remains recorded.</div>}
    <div className="evidence-list"><div className="evidence-list-head"><span>Evidence trail</span><span>{evidence.length} {evidence.length === 1 ? 'record' : 'records'}</span></div>{evidence.length ? evidence.map((item) => <EvidenceItem key={item.id} item={item} />) : <div className="empty-evidence">No evidence recorded yet.</div>}</div>
  </article>
}

export default function ObligationsEvidence({ scenario }: { scenario: ReturnTypeUseDemoScenario }) {
  const { insights, insightsLoading, chatMessages, chatLoading, sendMessage } = useAdvisor(scenario)
  return <div className="page-content subpage-content">
    <div className="page-heading-row"><div><div className="page-eyebrow"><span className="page-eyebrow-line" /> READINESS CONTROL</div><h1>Readiness &amp; Evidence</h1><p>A sent action is a signal—not proof that the counterparty confirmed.</p></div><span className="evidence-count-pill"><FileCheck2 size={14} />{scenario.evidence.length} evidence records</span></div>
    <InsightCards cards={insights} loading={insightsLoading} />
    <div className="signal-strip"><EvidenceStepper actionAttempted={true} providerAccepted={scenario.providerAccepted} vendorConfirmed={scenario.vendorConfirmed} evidenceVerified={scenario.vendorConfirmed} /></div>
    <div className="obligations-layout"><div className="obligation-list">{scenario.obligations.map((obligation: Obligation) => <ObligationCard key={obligation.id} obligation={obligation} evidence={scenario.evidence.filter((item) => item.obligationId === obligation.id)} scenario={scenario} />)}</div><div className="obligation-aside"><ReadinessPanel scenario={scenario} /><div className="panel evidence-legend"><div className="panel-kicker">EVIDENCE POLICY</div><h3>Version-aware by design</h3><p>A reply for an earlier fact version cannot close an obligation for the current fact version.</p><div className="legend-row"><span className="legend-dot legend-ok" />Accepted for current facts</div><div className="legend-row"><span className="legend-dot legend-no" />Rejected as stale evidence</div><div className="prototype-note">{scenario.apiMode ? 'Readiness is persistent; no inbound vendor email connector is enabled.' : 'This is recorded demo evidence only, not a guarantee of actual event execution.'}</div></div>{scenario.apiMode && scenario.ownerReviewTasks.length > 0 && <div className="panel evidence-legend"><div className="panel-kicker">OWNER REVIEW TASKS</div><h3>Routed vendor replies ({scenario.ownerReviewTasks.length})</h3>{scenario.ownerReviewTasks.map((task) => <div className="legend-row" key={task.id} style={{ justifyContent: 'space-between', gap: '8px' }}><span><span className="legend-dot legend-no" /> <strong>{task.reason_code}</strong>{task.obligation_id ? ` · ${task.obligation_id}` : ''} · <time>{formatTimestamp(task.created_at)}</time></span><button className="button button-outline" disabled={scenario.apiBusy} onClick={() => void scenario.resolveReviewTask(task.id)}>Resolve</button></div>)}</div>}</div></div>
    <ChatPanel messages={chatMessages} loading={chatLoading} onSend={sendMessage} />
  </div>
}
