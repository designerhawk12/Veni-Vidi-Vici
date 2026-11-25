import { ArrowDown, ArrowRight, Check, CircleDot, Fingerprint, ShieldCheck } from 'lucide-react'

const demoUrl = '/demo'

export default function LandingPage() {
  return <main className="landing-page">
    <header className="landing-nav">
      <a className="landing-brand" href="/" aria-label="Event Guardian home">
        <span className="landing-brand-mark"><ShieldCheck size={21} /></span>
        <span><strong>Event Guardian</strong><small>CONTROL FOR COMPLEX EVENTS</small></span>
      </a>
      <nav className="landing-nav-links" aria-label="Main navigation">
        <a href="#how-it-works">How it works</a>
        <a href="#capabilities">Capabilities</a>
      </nav>
      <a className="landing-nav-cta" href={demoUrl} aria-label="Open interactive demo">Open demo <ArrowRight size={15} /></a>
    </header>

    <section className="landing-hero">
      <div className="landing-hero-copy">
        <h1>Plans change.<br /><span>Your guardrails shouldn’t.</span></h1>
        <p>Event Guardian is designed to keep event work grounded in current facts, owner decisions, and evidence—so a changed plan gets reviewed before stale work proceeds.</p>
        <div className="landing-actions">
          <a className="landing-primary-cta" href={demoUrl}>Explore the interactive demo <ArrowRight size={17} /></a>
          <a className="landing-secondary-cta" href="#how-it-works">See how it works <ArrowDown size={15} /></a>
        </div>
        <div className="landing-proof-points"><span><Check size={14} /> Current facts</span><span><Check size={14} /> Explicit owner decisions</span><span><Check size={14} /> Verifiable evidence</span></div>
      </div>

      <div className="landing-hero-visual" role="group" aria-label="Synthetic demo scenario showing a venue change and its effect on an invitation">
        <div className="landing-visual-label"><span className="landing-live-dot" /> SYNTHETIC DEMO <strong>VENUE CHANGE · V1 → V2</strong></div>
        <article className="landing-change-card">
          <div className="landing-card-topline"><span>EVENT FACT · VENUE</span><span>UPDATED</span></div>
          <div className="landing-venue-change"><div><small>PREVIOUS FACT · V1</small><strong>Venue A</strong></div><ArrowRight size={17} /><div><small>CURRENT FACT · V2</small><strong>Venue B</strong></div></div>
          <div className="landing-change-rule"><span /><p>Dependent actions rechecked against current facts</p></div>
          <div className="landing-blocked-action"><span className="landing-block-icon"><ShieldCheck size={17} /></span><div><strong>Old invitation blocked</strong><small>Venue A · fact version V1</small></div><span className="landing-block-status"><CircleDot size={13} /> BLOCKED</span></div>
          <div className="landing-approval-action"><span className="landing-approval-mark"><Fingerprint size={16} /></span><div><strong>New approval required</strong><small>Exact proposal · Venue B · V2</small></div><span className="landing-lock">OWNER GATE</span></div>
        </article>
        <p className="landing-visual-caption">Interactive prototype · All event actions are simulated.</p>
      </div>
    </section>

    <section className="landing-capabilities" id="capabilities">
      <div className="landing-section-heading"><h2>When a fact changes,<br />work must answer to it.</h2><p>The TechMeet prototype follows one venue change through a stale invitation, an owner decision, and the evidence still needed to call arrangements ready.</p></div>
      <div className="landing-feature-layout">
        <article className="landing-feature-main">
          <div className="landing-feature-main-heading"><span className="landing-feature-icon"><CircleDot size={19} /></span><h3>One change. Only dependent work is reopened.</h3></div>
          <p>When the event venue moves from Venue A / V1 to Venue B / V2, an invitation prepared with the old fact is blocked. Unrelated work stays intact. A corrected invitation waits for the owner to approve that exact proposal.</p>
          <div className="landing-event-ledger">
            <div className="landing-ledger-fact"><span>CONFIRMED FACT</span><strong>Venue A <i>V1</i></strong></div>
            <ArrowRight size={16} />
            <div className="landing-ledger-fact current"><span>UPDATED FACT</span><strong>Venue B <i>V2</i></strong></div>
            <div className="landing-ledger-result"><ShieldCheck size={17} /><span><strong>Old invitation blocked</strong><small>New owner approval required</small></span></div>
          </div>
        </article>
        <div className="landing-feature-support">
          <article><Fingerprint size={18} /><div><h3>Decisions stay with the owner</h3><p>Approval binds to the displayed action and its fact versions. Advice cannot authorize execution.</p></div></article>
          <article><ShieldCheck size={18} /><div><h3>Readiness needs evidence</h3><p>A recorded attempt is not a vendor confirmation. The demo keeps those states distinct.</p></div></article>
        </div>
      </div>
    </section>

    <section className="landing-how" id="how-it-works">
      <div><h2>From changed facts<br />to a confident next step.</h2><p>Follow the event owner through the same recovery sequence in the interactive prototype.</p></div>
      <ol className="landing-flow">
        <li><span>01</span><div><strong>Goals &amp; Facts</strong><small>See owner goals, constraints, and current event truth.</small></div></li>
        <li><span>02</span><div><strong>Decisions</strong><small>Review a proposal and record an explicit owner decision.</small></div></li>
        <li><span>03</span><div><strong>Actions</strong><small>Inspect current work and a simulated stale-action block.</small></div></li>
        <li><span>04</span><div><strong>Readiness &amp; Evidence</strong><small>Check what is confirmed, accepted, or still outstanding.</small></div></li>
      </ol>
    </section>

    <section className="landing-demo-callout">
      <div><span className="landing-demo-badge"><span /> INTERACTIVE PROTOTYPE</span><h2>See the controls in context.</h2><p>Explore the TechMeet scenario with simulated approvals, dispatch, and vendor evidence.</p><small>This is a frontend demo. It does not send emails or contact vendors.</small></div>
      <a className="landing-primary-cta" href={demoUrl}>Open the demo <ArrowRight size={17} /></a>
    </section>

    <footer className="landing-footer"><a className="landing-brand" href="/"><span className="landing-brand-mark"><ShieldCheck size={18} /></span><span><strong>Event Guardian</strong><small>CONTROL FOR COMPLEX EVENTS</small></span></a><span>Interactive frontend prototype · All event actions are simulated</span></footer>
  </main>
}
