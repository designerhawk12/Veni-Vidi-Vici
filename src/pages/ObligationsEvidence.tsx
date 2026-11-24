import { Check, CircleDashed, FileCheck2, Inbox, ShieldAlert, ShieldCheck, Truck } from 'lucide-react'
import type { EvidenceRecord, Obligation } from '../types/guardian'
import type { ReturnTypeUseDemoScenario } from './pageTypes'
import { formatTimestamp } from '../components/shared/Timeline'
import StatusBadge from '../components/dashboard/StatusBadge'
import ReadinessCard from '../components/dashboard/ReadinessCard'

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
    {obligation.id === 'catering-confirmation' && <div className="vendor-controls"><button className="button button-primary" onClick={scenario.simulateCurrentVendorReply} disabled={scenario.vendorConfirmed}><Check size={14} />{scenario.vendorConfirmed ? 'Current Reply Verified' : 'Simulate Current-Version Vendor Reply'}</button><button className="button button-outline button-late" onClick={scenario.simulateLateVendorReply} disabled={scenario.lateReplyAdded}><ShieldAlert size={14} />{scenario.lateReplyAdded ? 'Late Reply Recorded' : 'Simulate Late Venue A Reply'}</button><span>Both replies are synthetic.</span></div>}
    {obligation.id === 'guest-delivery' && <div className="obligation-note"><CircleDashed size={14} />{scenario.providerAccepted ? 'Provider acceptance/readback recorded for V2. Recipient delivery is not confirmed.' : 'Initially pending. Use the approved action to simulate provider acceptance; no real email is sent.'}</div>}
    {obligation.id === 'sponsor-receipt-obligation' && <div className="obligation-note note-green"><ShieldCheck size={14} />Unchanged by the venue update; the valid receipt evidence remains recorded.</div>}
    <div className="evidence-list"><div className="evidence-list-head"><span>Evidence trail</span><span>{evidence.length} {evidence.length === 1 ? 'record' : 'records'}</span></div>{evidence.length ? evidence.map((item) => <EvidenceItem key={item.id} item={item} />) : <div className="empty-evidence">No evidence recorded yet.</div>}</div>
  </article>
}

export default function ObligationsEvidence({ scenario }: { scenario: ReturnTypeUseDemoScenario }) {
  return <div className="page-content subpage-content">
    <div className="page-heading-row"><div><div className="page-eyebrow"><span className="page-eyebrow-line" /> OBLIGATION CONTROL</div><h1>Obligations &amp; Evidence</h1><p>A sent action is a signal—not proof that the counterparty confirmed.</p></div><span className="evidence-count-pill"><FileCheck2 size={14} />{scenario.evidence.length} evidence records</span></div>
    <div className="signal-strip"><div className="signal-intro"><strong>Four distinct signals</strong><span>Track what actually happened, not just what was attempted.</span></div><div className="signal-stage"><span className="signal-number">01</span><strong>Action attempted</strong><span>Agent proposal</span></div><i /><div className="signal-stage"><span className="signal-number">02</span><strong>Provider accepted</strong><span>Transport readback</span></div><i /><div className="signal-stage"><span className="signal-number">03</span><strong>Counterparty confirmed</strong><span>Vendor reply</span></div><i /><div className="signal-stage"><span className="signal-number">04</span><strong>Current evidence verified</strong><span>Version-matched record</span></div></div>
    <div className="obligations-layout"><div className="obligation-list">{scenario.obligations.map((obligation: Obligation) => <ObligationCard key={obligation.id} obligation={obligation} evidence={scenario.evidence.filter((item) => item.obligationId === obligation.id)} scenario={scenario} />)}</div><div className="obligation-aside"><ReadinessCard ready={scenario.readinessReady} providerAccepted={scenario.providerAccepted} vendorConfirmed={scenario.vendorConfirmed} /><div className="panel evidence-legend"><div className="panel-kicker">EVIDENCE POLICY</div><h3>Version-aware by design</h3><p>A reply for Venue A / V1 cannot close the current obligation for Venue B / V2.</p><div className="legend-row"><span className="legend-dot legend-ok" />Accepted for current facts</div><div className="legend-row"><span className="legend-dot legend-no" />Rejected as stale evidence</div><div className="prototype-note">This is recorded prototype evidence only, not a guarantee of actual event execution.</div></div></div></div>
  </div>
}
