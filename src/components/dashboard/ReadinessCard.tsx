import { Check, Circle, ShieldCheck } from 'lucide-react'
import StatusBadge from './StatusBadge'

export default function ReadinessCard({ ready, providerAccepted, vendorConfirmed, openObligations, apiMode = false, claimRecorded = false, factVersion = 2 }: { ready: boolean; providerAccepted: boolean; vendorConfirmed: boolean; openObligations: number; apiMode?: boolean; claimRecorded?: boolean; factVersion?: number }) {
  const checks = [
    { title: apiMode ? 'Execution claim recorded' : 'Action attempted', detail: apiMode ? claimRecorded ? 'Authorization persisted; no connector dispatch occurred.' : 'No execution claim recorded.' : 'A guarded action was reviewed against current facts.', done: apiMode ? claimRecorded : true },
    { title: 'Provider accepted', detail: providerAccepted ? 'Demo provider readback recorded.' : 'No provider readback recorded.', done: providerAccepted },
    { title: 'Counterparty confirmed', detail: vendorConfirmed ? `Vendor reply references the current facts / V${factVersion}.` : 'Current catering vendor confirmation is still pending.', done: vendorConfirmed },
    { title: 'Current evidence verified', detail: vendorConfirmed ? `Recorded evidence matches event facts V${factVersion}.` : 'Waiting for current-version evidence.', done: vendorConfirmed },
  ]
  return <section className={`panel readiness-panel ${ready ? 'readiness-ready' : ''}`}>
    <div className="panel-heading"><div><div className="panel-kicker">CONTROL CHECK</div><h2>Event readiness</h2></div><ShieldCheck size={20} className="panel-heading-icon" /></div>
    <div className="readiness-status" aria-live="polite"><StatusBadge status={ready ? 'ready' : 'not_ready'} label={ready ? `Recorded arrangements ready as of event-facts V${factVersion}` : `Not ready · ${openObligations} open`} /><span>{ready ? 'Current mandatory arrangements are recorded; this is not a guarantee of actual event execution.' : 'Catering confirmation remains open. Provider acceptance is not counterparty confirmation.'}</span></div>
    <div className="readiness-steps">{checks.map((check) => <div className={`readiness-step ${check.done ? 'step-done' : ''}`} key={check.title}><span className="step-check">{check.done ? <Check size={12} /> : <Circle size={10} />}</span><span><strong>{check.title}</strong><small>{check.detail}</small></span></div>)}</div>
    {ready && <div className="readiness-disclaimer">{apiMode ? 'Readiness is computed from persisted current-version evidence.' : 'Recorded demo evidence only; this is not a guarantee of actual event execution.'}</div>}
    {!ready && <div className="readiness-disclaimer">A sent or provider-accepted action is not vendor confirmation.</div>}
  </section>
}
