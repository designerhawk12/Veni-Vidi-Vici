import { useState } from 'react'
import { AlertTriangle, ArrowDownRight, Eye, ShieldCheck } from 'lucide-react'
import { reviewerFinding } from '../../data/demoData'
import type { EventFacts, ReviewDisposition } from '../../types/guardian'

const inr = (value: number) => `₹${new Intl.NumberFormat('en-IN').format(value)}`
const reviewDispositions: ReviewDisposition[] = ['accepted_recommendation', 'accepted_tradeoff', 'dismissed', 'clarification_requested']

export default function ReviewerCard({
  onDisposition,
  apiMode = false,
  facts,
  openObligations = 0,
  persistedDispositions = [],
}: {
  onDisposition: (disposition: ReviewDisposition, reason: string) => void
  apiMode?: boolean
  facts?: EventFacts
  openObligations?: number
  persistedDispositions?: { id: string; disposition: ReviewDisposition; reason: string; created_at: string }[]
}) {
  const [disposition, setDisposition] = useState<ReviewDisposition | ''>('')
  const [reason, setReason] = useState('')
  const [recorded, setRecorded] = useState(false)
  const totalBudget = apiMode ? (facts?.budgetCap ?? 0) : reviewerFinding.totalBudget
  const committed = apiMode ? Math.round(totalBudget * 0.4) : reviewerFinding.committed
  const essentialForecast = apiMode ? (facts?.attendees ?? 0) * 500 : reviewerFinding.essentialForecast
  const optionalUpgrade = apiMode ? Math.round(totalBudget * 0.1) : reviewerFinding.optionalUpgrade
  const headroom = totalBudget - committed - essentialForecast
  const shortfall = Math.max(0, optionalUpgrade - headroom)
  const title = apiMode
    ? (shortfall > 0 ? 'Optional upgrade exceeds computed headroom' : 'Live SQLite budget & readiness check')
    : reviewerFinding.title
  const explanation = apiMode
    ? `Computed from SQLite facts: sponsor budget ${inr(totalBudget)}, ${facts?.attendees ?? 0} attendees at ${facts?.venue ?? 'current venue'} (V${facts?.version ?? 1}), with ${openObligations} open readiness item(s).`
    : reviewerFinding.explanation
  const alternative = apiMode
    ? (openObligations > 0 ? 'Close open vendor obligations before approving optional upgrades.' : 'All mandatory obligations are closed; optional spending remains within organizer discretion.')
    : reviewerFinding.alternative
  const reasonRequired = disposition === 'accepted_tradeoff' || disposition === 'dismissed' || disposition === 'clarification_requested'
  const recordResponse = () => {
    if (!disposition || reasonRequired && !reason.trim()) return
    onDisposition(disposition, reason)
    setRecorded(true)
  }
  return <section className="panel reviewer-panel">
    <div className="reviewer-top"><div className="reviewer-mark"><Eye size={17} /></div><div><div className="reviewer-title">Event Guardian <span>·</span> Budget Review</div><div className="reviewer-subtitle">{apiMode ? 'Persisted organizer dispositions · non-authorizing.' : 'Demo advice · no live integration.'}</div></div><span className="readonly-pill">READ ONLY</span></div>
    <div className="budget-table-wrap">
      <table className="budget-table">
        <thead><tr><th scope="col">Budget signal</th><th scope="col">Amount</th><th scope="col">Basis</th></tr></thead>
        <tbody>
          <tr><th scope="row">Budget cap</th><td>{inr(totalBudget)}</td><td>{apiMode ? 'SQLite fact' : 'Organizer fact'}</td></tr>
          <tr><th scope="row">Committed / reserved</th><td>− {inr(committed)}</td><td>{apiMode ? 'Estimated allocation' : 'Ledger'}</td></tr>
          <tr><th scope="row">Available</th><td>{inr(totalBudget - committed)}</td><td>Computed</td></tr>
          <tr><th scope="row">Essential forecast</th><td>− {inr(essentialForecast)}</td><td>Estimate</td></tr>
          <tr><th scope="row">Headroom</th><td>{inr(headroom)}</td><td>Computed</td></tr>
          <tr><th scope="row">Optional proposal</th><td>− {inr(optionalUpgrade)}</td><td>Estimate</td></tr>
          <tr className="budget-projection"><th scope="row">Projected shortfall</th><td>{inr(shortfall)}</td><td>Computed</td></tr>
        </tbody>
      </table>
    </div>
    <div className="budget-warning"><div className="warning-icon"><AlertTriangle size={16} /></div><div><strong>{title}</strong><p>{explanation}</p><div className="shortfall"><ArrowDownRight size={13} />{shortfall > 0 ? `Exceeds forecast headroom by ${inr(shortfall)}. You decide.` : 'Within computed headroom. You decide.'}</div></div></div>
    <div className="review-evidence"><strong>Basis</strong><span>{apiMode ? `SQLite facts (${facts?.venue ?? 'venue'} V${facts?.version ?? 1}) · ${openObligations} open readiness item(s)` : 'Goal event_success@1 · soft policy P1@1 · budget.cap@1 · essential forecast estimate'}</span><strong>Uncertainty</strong><span>Essential costs are estimated and may change when current vendor quotes arrive.</span></div>
    <div className="review-alternative"><span>Suggested alternative</span><p>{alternative}</p></div>
    <div className="review-response">
      <label htmlFor="review-disposition">Record organizer response</label>
      <select id="review-disposition" value={disposition} onChange={(event) => { setDisposition(reviewDispositions.find((item) => item === event.target.value) ?? ''); setRecorded(false) }}>
        <option value="">Choose a disposition</option>
        <option value="accepted_recommendation">Accept recommendation</option>
        <option value="accepted_tradeoff">Accept trade-off</option>
        <option value="dismissed">Dismiss advice</option>
        <option value="clarification_requested">Request clarification</option>
      </select>
      {reasonRequired && <textarea value={reason} onChange={(event) => { setReason(event.target.value); setRecorded(false) }} rows={2} placeholder="Record why (required for this response)." aria-label="Reason for organizer response" />}
      <button className="button button-outline" onClick={recordResponse} disabled={!disposition || recorded || reasonRequired && !reason.trim()}>{recorded ? 'Response recorded' : 'Record response'}</button>
      {recorded && <span className="review-recorded" role="status">{apiMode ? 'Response persisted in SQLite. Advice remains non-authorizing.' : 'Response recorded in demo history. Advice remains non-authorizing.'}</span>}
      {apiMode && persistedDispositions.length > 0 && (
        <div style={{ marginTop: '8px', fontSize: '12px', display: 'grid', gap: '4px' }}>
          <strong>Latest recorded disposition:</strong>
          <span>{persistedDispositions[0].disposition.replaceAll('_', ' ')}{persistedDispositions[0].reason ? ` — ${persistedDispositions[0].reason}` : ''}</span>
        </div>
      )}
    </div>
    <div className="advisory-stamp"><ShieldCheck size={15} /><strong>FOR REFERENCE – ORGANIZER DECIDES</strong><span>Review is for reference only.</span></div>
  </section>
}
