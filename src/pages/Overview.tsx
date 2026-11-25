import { useEffect, useState } from 'react'
import { ArrowDown, ArrowRight, ShieldAlert, ShieldCheck } from 'lucide-react'
import type { PageId } from '../types/guardian'
import type { ReturnTypeUseDemoScenario } from './pageTypes'
import EventDetails from '../components/dashboard/EventDetails'
import Modal from '../components/shared/Modal'

interface OverviewProps { scenario: ReturnTypeUseDemoScenario; onNavigate: (page: PageId) => void }

export default function Overview({ scenario, onNavigate }: OverviewProps) {
  const [selectedFactId, setSelectedFactId] = useState('venue.address')
  const [factDraft, setFactDraft] = useState('')
  const [newName, setNewName] = useState('')
  const [newVenue, setNewVenue] = useState('')
  const [newDate, setNewDate] = useState('2026-12-15T09:00:00+05:30')
  const [newHeadcount, setNewHeadcount] = useState('100')
  const [newBudget, setNewBudget] = useState('100000')
  const [newVendor, setNewVendor] = useState('')
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [renameDraft, setRenameDraft] = useState(scenario.facts.name)
  const [customFactId, setCustomFactId] = useState('')
  const [customFactValue, setCustomFactValue] = useState('')
  const [obName, setObName] = useState('')
  const [obFactId, setObFactId] = useState('venue.address')
  const [obVendorName, setObVendorName] = useState('')
  const [obVendorEmail, setObVendorEmail] = useState('catering@vendor.test')
  useEffect(() => setRenameDraft(scenario.facts.name), [scenario.facts.name])
  const selectedFact = scenario.rawFacts.find((item) => item.id === selectedFactId)
  useEffect(() => {
    if (selectedFact) setFactDraft(String(selectedFact.value ?? ''))
  }, [selectedFact?.id, selectedFact?.version, selectedFact?.value])
  const changed = scenario.facts.version > 1

  const submitFactUpdate = (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedFact) return
    const trimmed = factDraft.trim()
    if (!trimmed) return
    const parsed: unknown = typeof selectedFact.value === 'number' ? Number(trimmed) : trimmed
    if (typeof selectedFact.value === 'number' && Number.isNaN(parsed)) return
    void scenario.changeFact(selectedFact.id, parsed)
  }

  if (scenario.apiMode && scenario.isWorkspaceEmpty) {
    return (
      <div className="page-content overview-page">
        <div className="page-heading-row">
          <div>
            <div className="page-eyebrow"><span className="page-eyebrow-line" /> NEW WORKSPACE</div>
            <h1>Set up your event</h1>
            <p>Your SQLite workspace is empty. Enter your event details to initialize versioned facts and readiness tracking.</p>
          </div>
        </div>
        <form
          className="panel"
          style={{ padding: '24px', display: 'grid', gap: '14px', maxWidth: '640px' }}
          onSubmit={(event) => {
            event.preventDefault()
            void scenario.setupWorkspace({
              name: newName.trim(),
              venue: newVenue.trim(),
              event_start: newDate.trim(),
              headcount: Math.max(1, Number(newHeadcount) || 1),
              budget_cap: Math.max(0, Number(newBudget) || 0),
              vendor_name: newVendor.trim(),
            })
          }}
        >
          <label className="reason-field">Event name
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Annual Summit 2026" required />
          </label>
          <label className="reason-field">Primary venue
            <input value={newVenue} onChange={(e) => setNewVenue(e.target.value)} placeholder="e.g. Grand Hall A" required />
          </label>
          <label className="reason-field">Event start (ISO date/time)
            <input value={newDate} onChange={(e) => setNewDate(e.target.value)} required />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label className="reason-field">Expected headcount
              <input type="number" min={1} value={newHeadcount} onChange={(e) => setNewHeadcount(e.target.value)} required />
            </label>
            <label className="reason-field">Budget cap (₹)
              <input type="number" min={0} value={newBudget} onChange={(e) => setNewBudget(e.target.value)} required />
            </label>
          </div>
          <label className="reason-field">Mandatory vendor confirmation (optional)
            <input value={newVendor} onChange={(e) => setNewVendor(e.target.value)} placeholder="e.g. Acme Catering (leave blank for none)" />
          </label>
          <button className="button button-primary" type="submit" disabled={scenario.apiBusy}>
            Create event workspace
          </button>
        </form>
      </div>
    )
  }

  return <div className="page-content overview-page">
    <div className="page-heading-row"><div><div className="page-eyebrow"><span className="page-eyebrow-line" /> ORGANIZER WORKSPACE</div><h1>Goals &amp; Facts</h1><p>Confirmed outcomes, constraints, and the current event facts guiding work.</p></div><div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>{scenario.apiMode && <><button className="button button-primary" disabled={scenario.apiBusy} onClick={() => setCustomizeOpen(true)}>Customize workspace</button><button className="button button-outline" disabled={scenario.apiBusy} onClick={() => void scenario.clearWorkspace()}>New empty workspace</button></>}<button className="button button-quiet" onClick={() => onNavigate('decisions')}>Review decisions <ArrowRight size={15} /></button></div></div>
    <EventDetails facts={scenario.facts} />
    <section className="goals-facts-grid" aria-label="Organizer-confirmed goals, policies, and fact status">
      {scenario.apiMode
        ? <>
            <article className="panel goal-summary">
              <div className="panel-heading"><div><div className="panel-kicker">WORKSPACE · SQLITE</div><h2>{scenario.facts.name}</h2></div><ShieldCheck size={19} className="panel-heading-icon" /></div>
              <p>Deliver {scenario.facts.name} for {scenario.facts.attendees} guests at {scenario.facts.venue} on {scenario.facts.date}.</p>
              <div className="goal-version">{scenario.facts.venue} <span>· V{scenario.facts.version} owner-confirmed</span></div>
            </article>
            <article className="panel policy-summary">
              <div className="panel-heading"><div><div className="panel-kicker">CONFIRMED FACTS</div><h2>Live SQLite fact ledger</h2></div><ShieldAlert size={19} className="panel-heading-icon" /></div>
              {scenario.rawFacts.map((fact) => (
                <div className="policy-row" key={fact.id}>
                  <span className="policy-kind hard-policy">V{fact.version}</span>
                  <div><strong>{fact.id}</strong><small>{String(fact.value)}</small></div>
                </div>
              ))}
            </article>
          </>
        : <>
            <article className="panel goal-summary">
              <div className="panel-heading"><div><div className="panel-kicker">ORGANIZER-CONFIRMED GOAL</div><h2>Reliable, accessible community meetup</h2></div><ShieldCheck size={19} className="panel-heading-icon" /></div>
              <p>Deliver a dependable event for 120 guests, prioritizing essential arrangements over optional refinements.</p>
              <div className="goal-version">event_success@1 <span>· organizer-confirmed</span></div>
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
          </>}
    </section>
    <section className={`venue-alert ${changed ? '' : 'venue-alert-initial'}`} aria-live="polite">
      <div className="venue-alert-icon"><ShieldAlert size={18} /></div>
      <div className="venue-alert-main"><div className="venue-alert-title">{changed ? 'Venue Change Recorded' : 'Current Venue Confirmed'} <span>· Version control active</span></div><p>{changed ? `The venue changed from ${scenario.facts.previousVenue} to ${scenario.facts.venue}. Dependent work was invalidated; unrelated records remain unchanged.` : 'This is the currently confirmed venue. Changing it creates a new fact version and reopens dependent arrangements.'}</p><div className="venue-version-flow"><div className="venue-old"><span>{changed ? 'PREVIOUS VENUE' : 'CURRENT VENUE'}</span><strong>{changed ? scenario.facts.previousVenue : scenario.facts.venue}</strong><small>Fact version V{changed ? scenario.facts.previousVersion : scenario.facts.version}</small></div><ArrowDown className="version-arrow" size={16} /><div className="venue-new"><span>{changed ? 'CURRENT VENUE' : 'CONFIRMED FACT'}</span><strong>{scenario.facts.venue}</strong><small>Fact version V{scenario.facts.version}</small></div><div className="venue-flow-note"><span className="flow-note-dot" />{changed ? `${scenario.affectedActions} dependent records affected` : 'Owner-confirmed fact'}</div></div></div>
      <div className="alert-side"><span>{changed ? 'CHANGE REVIEW' : 'DEPENDENCIES'}</span><strong>{String(scenario.affectedActions).padStart(2, '0')}</strong><small>{changed ? 'actions affected' : 'actions affected'}</small></div>
    </section>
    {scenario.apiMode && <form className="venue-change-form" onSubmit={submitFactUpdate}>
      <label htmlFor="fact-selector">Update confirmed event facts</label>
      <span>Saving creates a new immutable fact version, invalidates dependent actions, and reopens dependent obligations.</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        <select id="fact-selector" value={selectedFactId} onChange={(event) => setSelectedFactId(event.target.value)}>
          {scenario.rawFacts.map((fact) => (
            <option key={fact.id} value={fact.id}>{fact.id} (V{fact.version})</option>
          ))}
        </select>
        <input
          aria-label="Confirmed fact value"
          value={factDraft}
          onChange={(event) => setFactDraft(event.target.value)}
          maxLength={200}
          required
        />
        <button
          className="button button-primary"
          type="submit"
          disabled={scenario.apiBusy || !factDraft.trim() || String(selectedFact?.value ?? '') === factDraft.trim()}
        >
          Save confirmed fact
        </button>
      </div>
    </form>}
    <div className="overview-footer"><span><span className="footer-dot" /> {scenario.apiMode ? 'PERSISTENT API MODE' : 'DEMO MODE'}</span><span>{scenario.apiMode ? 'Owner-confirmed fact changes are stored in the Guardian SQLite database.' : 'Facts shown are fixed demo data; editing and onboarding are not connected.'}</span></div>
    <Modal open={customizeOpen} onClose={() => setCustomizeOpen(false)} eyebrow="WORKSPACE SETTINGS · SQLITE" title="Customize workspace" width="wide">
      <div style={{ display: 'grid', gap: '18px' }}>
        <form onSubmit={(e) => { e.preventDefault(); if (renameDraft.trim()) void scenario.renameWorkspace(renameDraft.trim()) }} style={{ display: 'grid', gap: '8px' }}>
          <label className="reason-field">Workspace / event name
            <div style={{ display: 'flex', gap: '8px' }}>
              <input value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)} required style={{ flex: 1 }} />
              <button className="button button-primary" type="submit" disabled={scenario.apiBusy || !renameDraft.trim() || renameDraft.trim() === scenario.facts.name}>Rename</button>
            </div>
          </label>
        </form>
        <form onSubmit={(e) => {
          e.preventDefault()
          if (!customFactId.trim() || !customFactValue.trim()) return
          const numeric = Number(customFactValue.trim())
          const val: unknown = !Number.isNaN(numeric) && customFactValue.trim() !== '' ? numeric : customFactValue.trim()
          void scenario.createFact(customFactId.trim(), val).then(() => { setCustomFactId(''); setCustomFactValue('') })
        }} style={{ display: 'grid', gap: '8px' }}>
          <strong style={{ fontSize: '13px' }}>Add custom confirmed fact</strong>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px' }}>
            <input value={customFactId} onChange={(e) => setCustomFactId(e.target.value)} placeholder="Fact key (e.g. accessibility.step_free)" required />
            <input value={customFactValue} onChange={(e) => setCustomFactValue(e.target.value)} placeholder="Initial value" required />
            <button className="button button-outline" type="submit" disabled={scenario.apiBusy}>Add fact</button>
          </div>
        </form>
        <form onSubmit={(e) => {
          e.preventDefault()
          if (!obName.trim() || !obVendorName.trim() || !obVendorEmail.trim()) return
          void scenario.createObligation({
            name: obName.trim(),
            fact_id: obFactId,
            vendor_name: obVendorName.trim(),
            vendor_email: obVendorEmail.trim(),
          }).then(() => { setObName(''); setObVendorName('') })
        }} style={{ display: 'grid', gap: '8px' }}>
          <strong style={{ fontSize: '13px' }}>Add vendor readiness obligation</strong>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <input value={obName} onChange={(e) => setObName(e.target.value)} placeholder="Obligation name (e.g. AV check)" required />
            <select value={obFactId} onChange={(e) => setObFactId(e.target.value)}>
              {scenario.rawFacts.map((f) => <option key={f.id} value={f.id}>Bound to {f.id} (V{f.version})</option>)}
            </select>
            <input value={obVendorName} onChange={(e) => setObVendorName(e.target.value)} placeholder="Vendor name" required />
            <input value={obVendorEmail} onChange={(e) => setObVendorEmail(e.target.value)} placeholder="Vendor email" required />
          </div>
          <button className="button button-outline" type="submit" disabled={scenario.apiBusy} style={{ justifySelf: 'start' }}>Add obligation</button>
        </form>
        <div className="modal-action-footer">
          <span className="modal-sim-note">All customizations are persisted in SQLite.</span>
          <button className="button button-outline" onClick={() => setCustomizeOpen(false)}>Done</button>
        </div>
      </div>
    </Modal>
  </div>
}
