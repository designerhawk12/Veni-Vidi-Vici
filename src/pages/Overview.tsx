import { ArrowDown, ArrowRight, ShieldAlert, ShieldCheck } from 'lucide-react'
import type { PageId } from '../types/guardian'
import type { ReturnTypeUseDemoScenario } from './pageTypes'
import EventDetails from '../components/dashboard/EventDetails'

interface OverviewProps { scenario: ReturnTypeUseDemoScenario; onNavigate: (page: PageId) => void }

export default function Overview({ scenario, onNavigate }: OverviewProps) {
  return <div className="page-content overview-page">
    <div className="page-heading-row"><div><div className="page-eyebrow"><span className="page-eyebrow-line" /> OWNER WORKSPACE</div><h1>Goals &amp; Facts</h1><p>Confirmed outcomes, constraints, and the current event facts guiding work.</p></div><button className="button button-quiet" onClick={() => onNavigate('decisions')}>Review decisions <ArrowRight size={15} /></button></div>
    <EventDetails facts={scenario.facts} />
    <section className="goals-facts-grid" aria-label="Owner-confirmed goals, policies, and fact status">
      <article className="panel goal-summary">
        <div className="panel-heading"><div><div className="panel-kicker">OWNER-CONFIRMED GOAL</div><h2>Reliable, accessible community meetup</h2></div><ShieldCheck size={19} className="panel-heading-icon" /></div>
        <p>Deliver a dependable event for 120 guests, prioritizing essential arrangements over optional refinements.</p>
        <div className="goal-version">event_success@1 <span>· owner-confirmed</span></div>
        <div className="priority-list" aria-label="Event priorities">
          <span className="priority-required"><strong>Required</strong> Venue, catering confirmation, accurate invitations</span>
          <span className="priority-important"><strong>Important</strong> Attendee convenience</span>
          <span className="priority-optional"><strong>Optional</strong> Decor upgrades, cosmetic refinements</span>
        </div>
      </article>
      <article className="panel policy-summary">
        <div className="panel-heading"><div><div className="panel-kicker">GOALS &amp; FACTS</div><h2>Policies and current evidence</h2></div><ShieldAlert size={19} className="panel-heading-icon" /></div>
        <div className="policy-row"><span className="policy-kind hard-policy">Hard limit</span><div><strong>Budget cap · ₹{new Intl.NumberFormat('en-IN').format(scenario.facts.budgetCap)}</strong><small>Confirmed constraint · must not be exceeded</small></div></div>
        <div className="policy-row"><span className="policy-kind hard-policy">Hard limit</span><div><strong>Minimum attendance · {scenario.facts.attendees}</strong><small>Event plan requirement</small></div></div>
        <div className="policy-row"><span className="policy-kind soft-policy">Soft policy</span><div><strong>Step-free access preferred</strong><small>Evidence not supplied · independent review should ask, not assume</small></div></div>
        <div className="policy-evidence-note"><span />Venue fact is current at V{scenario.facts.version}; access evidence remains unknown.</div>
      </article>
    </section>
    <section className="venue-alert" aria-live="polite">
      <div className="venue-alert-icon"><ShieldAlert size={18} /></div>
      <div className="venue-alert-main"><div className="venue-alert-title">Venue Change Detected <span>· Guardian control active</span></div><p>The event venue changed from Venue A to Venue B. Dependent actions were invalidated or reopened; unrelated records remain valid.</p><div className="venue-version-flow"><div className="venue-old"><span>PREVIOUS VENUE</span><strong>Venue A</strong><small>Fact version V1</small></div><ArrowDown className="version-arrow" size={16} /><div className="venue-new"><span>CURRENT VENUE</span><strong>{scenario.facts.venue}</strong><small>Fact version V{scenario.facts.version}</small></div><div className="venue-flow-note"><span className="flow-note-dot" />Only dependent actions were invalidated</div></div></div>
      <div className="alert-side"><span>CHANGE REVIEW</span><strong>{String(scenario.affectedActions).padStart(2, '0')}</strong><small>actions affected</small></div>
    </section>
    <div className="overview-footer"><span><span className="footer-dot" /> FRONTEND PROTOTYPE</span><span>Facts shown are fixed demo data; editing and onboarding are not connected.</span></div>
  </div>
}
