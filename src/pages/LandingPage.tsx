import { ArrowDown, ArrowRight, Check, CircleDot, Fingerprint, ShieldCheck } from 'lucide-react'

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
        <a href="/demo">Product demo</a>
      </nav>
      <a className="landing-nav-cta" href="/workspace">Open workspace <ArrowRight size={15} /></a>
    </header>

    <section className="landing-hero">
      <div className="landing-hero-copy">
        <h1>Plans change.<br /><span>Your guardrails shouldn’t.</span></h1>
        <p>Event Guardian keeps complex work grounded in current facts, explicit decisions, and verifiable evidence—so teams can move forward without losing control.</p>
        <div className="landing-actions">
          <a className="landing-primary-cta" href="/workspace">Create a workspace <ArrowRight size={17} /></a>
          <a className="landing-secondary-cta" href="#how-it-works">How it works <ArrowDown size={15} /></a>
        </div>
        <div className="landing-proof-points"><span><Check size={14} /> Current facts</span><span><Check size={14} /> Human decisions</span><span><Check size={14} /> Verifiable evidence</span></div>
      </div>

      <div className="landing-hero-visual" role="img" aria-label="Event Guardian links event facts, human decisions, guarded actions, and evidence">
        <div className="product-map">
          <div className="product-map-heading"><span className="landing-live-dot" /> ONE SHARED RECORD</div>
          <div className="product-map-core"><ShieldCheck size={23} /><strong>Event Guardian</strong><span>Grounded coordination</span></div>
          <div className="product-map-branches" aria-hidden="true"><i /><i /><i /></div>
          <div className="product-map-lanes">
            <article><span className="product-map-icon"><CircleDot size={16} /></span><strong>Current facts</strong><small>Versioned and visible</small></article>
            <article><span className="product-map-icon"><Fingerprint size={16} /></span><strong>Human decisions</strong><small>Exact work, explicit approval</small></article>
            <article><span className="product-map-icon"><ShieldCheck size={16} /></span><strong>Evidence</strong><small>Readiness backed by proof</small></article>
          </div>
        </div>
      </div>
    </section>

    <section className="landing-capabilities" id="capabilities">
      <div className="landing-section-heading"><h2>Every next step has a reason.</h2><p>Keep the moving parts of event work connected to the decisions and evidence that make them safe to act on.</p></div>
      <div className="landing-feature-layout">
        <article className="landing-feature-main">
          <div className="landing-feature-main-heading"><span className="landing-feature-icon"><CircleDot size={19} /></span><h3>One dependable picture of the work.</h3></div>
          <p>Facts, obligations, proposals, and outcomes live together. When something changes, dependent work can be checked against the latest confirmed information.</p>
          <div className="product-record">
            <div className="product-record-step"><span>01</span><strong>Record what is known</strong><small>Confirmed facts carry their history.</small></div>
            <ArrowRight size={17} />
            <div className="product-record-step"><span>02</span><strong>Review what should happen</strong><small>Proposals wait for the right decision.</small></div>
            <ArrowRight size={17} />
            <div className="product-record-step"><span>03</span><strong>Verify what is complete</strong><small>Evidence closes the loop.</small></div>
          </div>
        </article>
        <div className="landing-feature-support">
          <article><Fingerprint size={18} /><div><h3>People stay in control</h3><p>Approval is tied to the exact proposal under review—not a broad or implied permission.</p></div></article>
          <article><ShieldCheck size={18} /><div><h3>Readiness is earned</h3><p>A planned action is not proof of completion. Verified evidence makes the status clear.</p></div></article>
        </div>
      </div>
    </section>

    <section className="landing-how" id="how-it-works">
      <div><h2>Clear context.<br />Safer coordination.</h2><p>Event Guardian brings each part of the workflow into view, while keeping approvals and external actions behind clear safeguards.</p></div>
      <ol className="landing-flow">
        <li><span>01</span><div><strong>Set the goal</strong><small>Keep outcomes and constraints visible to the team.</small></div></li>
        <li><span>02</span><div><strong>Confirm the facts</strong><small>Track what is current and what has changed.</small></div></li>
        <li><span>03</span><div><strong>Review proposals</strong><small>Make decisions against the exact work presented.</small></div></li>
        <li><span>04</span><div><strong>Verify the result</strong><small>Use recorded evidence to understand readiness.</small></div></li>
      </ol>
    </section>

    <section className="landing-workspace-callout">
      <div><span className="landing-product-badge"><span /> EVENT GUARDIAN</span><h2>Bring your work into focus.</h2><p>Create a workspace around your goals, facts, and decisions.</p></div>
      <a className="landing-primary-cta" href="/workspace">Create a workspace <ArrowRight size={17} /></a>
    </section>

    <footer className="landing-footer">
      <a className="landing-brand" href="/" aria-label="Event Guardian home"><span className="landing-brand-mark"><ShieldCheck size={18} /></span><span><strong>Event Guardian</strong><small>CONTROL FOR COMPLEX EVENTS</small></span></a>
      <a href="/demo">Product demo <ArrowRight size={14} /></a>
    </footer>
  </main>
}
