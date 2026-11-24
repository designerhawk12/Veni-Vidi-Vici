import { Check, Circle, ShieldCheck } from 'lucide-react'
import StatusBadge from './StatusBadge'

export default function ReadinessCard({ ready, providerAccepted, vendorConfirmed }: { ready: boolean; providerAccepted: boolean; vendorConfirmed: boolean }) {
  const checks = [
    { title: 'Action attempted', detail: 'A guarded action was reviewed against current facts.', done: true },
    { title: 'Provider accepted', detail: providerAccepted ? 'Simulated provider readback recorded.' : 'No provider readback recorded yet.', done: providerAccepted },
    { title: 'Counterparty confirmed', detail: vendorConfirmed ? 'Vendor reply references Venue B / V2.' : 'Current catering vendor confirmation is still pending.', done: vendorConfirmed },
    { title: 'Current evidence verified', detail: vendorConfirmed ? 'Recorded evidence matches event facts V2.' : 'Waiting for current-version evidence.', done: vendorConfirmed },
  ]
  return <section className={`panel readiness-panel ${ready ? 'readiness-ready' : ''}`}>
    <div className="panel-heading"><div><div className="panel-kicker">CONTROL CHECK</div><h2>Event readiness</h2></div><ShieldCheck size={20} className="panel-heading-icon" /></div>
    <div className="readiness-status"><StatusBadge status={ready ? 'ready' : 'not_ready'} label={ready ? 'READY – RECORDED ARRANGEMENTS VERIFIED' : undefined} /><span>{ready ? 'Current mandatory arrangements are recorded.' : 'Current catering vendor confirmation is still pending.'}</span></div>
    <div className="readiness-steps">{checks.map((check) => <div className={`readiness-step ${check.done ? 'step-done' : ''}`} key={check.title}><span className="step-check">{check.done ? <Check size={12} /> : <Circle size={10} />}</span><span><strong>{check.title}</strong><small>{check.detail}</small></span></div>)}</div>
    {ready && <div className="readiness-disclaimer">Recorded prototype evidence only; this is not a guarantee of actual event execution.</div>}
    {!ready && <div className="readiness-disclaimer">A sent or provider-accepted action is not vendor confirmation.</div>}
  </section>
}
