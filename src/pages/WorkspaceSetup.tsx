import { useState } from 'react'
import { ArrowRight, CalendarDays, Compass, ShieldCheck, Users, Wallet } from 'lucide-react'
import type { ReturnTypeUseDemoScenario } from './pageTypes'
import Modal from '../components/shared/Modal'

interface WorkspaceSetupProps {
  scenario: ReturnTypeUseDemoScenario
  onCreated: () => void
}

export default function WorkspaceSetup({ scenario, onCreated }: WorkspaceSetupProps) {
  const [name, setName] = useState('')
  const [venue, setVenue] = useState('')
  const [eventStart, setEventStart] = useState('')
  const [headcount, setHeadcount] = useState('100')
  const [budgetCap, setBudgetCap] = useState('100000')
  const [vendorName, setVendorName] = useState('')
  const [confirmOverwrite, setConfirmOverwrite] = useState(false)

  const createWorkspace = async () => {
    const saved = await scenario.setupWorkspace({
      name: name.trim(),
      venue: venue.trim(),
      event_start: eventStart,
      headcount: Math.max(1, Number(headcount) || 1),
      budget_cap: Math.max(0, Number(budgetCap) || 0),
      vendor_name: vendorName.trim(),
    })
    if (saved === true) onCreated()
    setConfirmOverwrite(false)
  }

  return <main className="workspace-empty-page">
    <header className="workspace-empty-nav">
      <a className="landing-brand" href="/" aria-label="Event Guardian product home">
        <span className="landing-brand-mark"><ShieldCheck size={20} /></span>
        <span><strong>Event Guardian</strong><small>WORKSPACE</small></span>
      </a>
      <a href="/demo">Explore the product demo <ArrowRight size={15} /></a>
    </header>

    <section className="workspace-empty-content" aria-labelledby="workspace-empty-title">
      <div className="workspace-empty-intro">
        <span className="workspace-empty-kicker"><span /> A clear space to begin</span>
        <h1 id="workspace-empty-title">Start with the event.<br /><em>Build from what’s true.</em></h1>
        <p>Create a workspace to bring goals, confirmed facts, decisions, and evidence together. Nothing is prefilled.</p>
        <div className="workspace-empty-principles" aria-label="Workspace principles">
          <span><Compass size={15} /> Your goals and facts</span>
          <span><ShieldCheck size={15} /> Decisions stay yours</span>
          <span><Users size={15} /> Evidence before readiness</span>
        </div>
      </div>

      <form className="workspace-create-card" onSubmit={(event) => {
        event.preventDefault()
        if (scenario.rawFacts.length > 0) setConfirmOverwrite(true)
        else void createWorkspace()
      }}>
        <div className="workspace-create-heading">
          <span className="workspace-create-icon"><Compass size={18} /></span>
          <div><h2>Create a workspace</h2><p>Start with a few event details. You can refine them later.</p></div>
        </div>

        {!scenario.apiMode
          ? <div className="workspace-api-required" role="status">
              <strong>Connect the Guardian API to create a workspace.</strong>
              <span>The interactive product demo is available while you set up the local API.</span>
              <a href="/demo">Open product demo <ArrowRight size={14} /></a>
            </div>
          : <>
              <label className="workspace-field">Workspace name
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Annual gathering" required />
              </label>
              <label className="workspace-field">Primary venue
                <input value={venue} onChange={(event) => setVenue(event.target.value)} placeholder="Venue or location" required />
              </label>
              <label className="workspace-field">Event date and time
                <span className="workspace-input-icon"><CalendarDays size={15} /><input type="datetime-local" value={eventStart} onChange={(event) => setEventStart(event.target.value)} required /></span>
              </label>
              <div className="workspace-field-pair">
                <label className="workspace-field">Expected attendees
                  <span className="workspace-input-icon"><Users size={15} /><input type="number" min={1} value={headcount} onChange={(event) => setHeadcount(event.target.value)} required /></span>
                </label>
                <label className="workspace-field">Budget cap
                  <span className="workspace-input-icon"><Wallet size={15} /><input type="number" min={0} value={budgetCap} onChange={(event) => setBudgetCap(event.target.value)} required /></span>
                </label>
              </div>
              <label className="workspace-field">Required vendor confirmation <span className="workspace-optional">Optional</span>
                <input value={vendorName} onChange={(event) => setVendorName(event.target.value)} placeholder="Vendor or service name" />
              </label>
              <button className="workspace-create-button" type="submit" disabled={scenario.apiBusy || !scenario.apiReady}>
                {scenario.apiBusy ? 'Creating workspace…' : !scenario.apiReady ? 'Connecting to Guardian…' : 'Create workspace'} <ArrowRight size={16} />
              </button>
              <p className="workspace-create-note">Your workspace starts only after you create it. All other sections stay closed until then.</p>
            </>}
      </form>
    </section>

    <footer className="workspace-empty-footer"><span>Event Guardian</span><span>Product workspace</span></footer>

    <Modal open={confirmOverwrite} onClose={() => setConfirmOverwrite(false)} eyebrow="EXISTING DATA" title="Replace the existing workspace?">
      <div className="switch-confirmation"><p>Creating this workspace will replace the data currently stored by this Guardian API. The product demo remains available separately.</p></div>
      <div className="modal-action-footer">
        <button className="button button-outline" onClick={() => setConfirmOverwrite(false)}>Keep existing data</button>
        <button className="button button-danger" disabled={scenario.apiBusy} onClick={() => void createWorkspace()}>Replace and create</button>
      </div>
    </Modal>
  </main>
}
