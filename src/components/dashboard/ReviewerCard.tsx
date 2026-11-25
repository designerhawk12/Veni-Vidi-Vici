import { useState } from 'react'
import { AlertTriangle, ArrowDownRight, Eye, ShieldCheck } from 'lucide-react'
import { reviewerFinding } from '../../data/demoData'
import type { ReviewDisposition } from '../../types/guardian'

const inr = (value: number) => `₹${new Intl.NumberFormat('en-IN').format(value)}`
const reviewDispositions: ReviewDisposition[] = ['accepted_recommendation', 'accepted_tradeoff', 'dismissed', 'clarification_requested']

export default function ReviewerCard({ onDisposition }: { onDisposition: (disposition: ReviewDisposition, reason: string) => void }) {
  const [disposition, setDisposition] = useState<ReviewDisposition | ''>('')
  const [reason, setReason] = useState('')
  const [recorded, setRecorded] = useState(false)
  const review = reviewerFinding
  const headroom = review.totalBudget - review.committed - review.essentialForecast
  const shortfall = Math.max(0, review.optionalUpgrade - headroom)
  const reasonRequired = disposition === 'accepted_tradeoff' || disposition === 'dismissed' || disposition === 'clarification_requested'
  const recordResponse = () => {
    if (!disposition || reasonRequired && !reason.trim()) return
    onDisposition(disposition, reason)
    setRecorded(true)
  }
  return <section className="panel reviewer-panel">
    <div className="reviewer-top"><div className="reviewer-mark"><Eye size={17} /></div><div><div className="reviewer-title">Goal Guardian <span>·</span> Independent Review</div><div className="reviewer-subtitle">Fixture-based advice · no live model call · no execution authority.</div></div><span className="readonly-pill">READ ONLY</span></div>
    <div className="budget-table-wrap">
      <table className="budget-table">
        <thead><tr><th scope="col">Budget signal</th><th scope="col">Amount</th><th scope="col">Basis</th></tr></thead>
        <tbody>
          <tr><th scope="row">Budget cap</th><td>{inr(review.totalBudget)}</td><td>Owner fact</td></tr>
          <tr><th scope="row">Committed / reserved</th><td>− {inr(review.committed)}</td><td>Ledger</td></tr>
          <tr><th scope="row">Available</th><td>{inr(review.totalBudget - review.committed)}</td><td>Computed</td></tr>
          <tr><th scope="row">Essential forecast</th><td>− {inr(review.essentialForecast)}</td><td>Estimate</td></tr>
          <tr><th scope="row">Headroom</th><td>{inr(headroom)}</td><td>Computed</td></tr>
          <tr><th scope="row">Optional proposal</th><td>− {inr(review.optionalUpgrade)}</td><td>Estimate</td></tr>
          <tr className="budget-projection"><th scope="row">Projected shortfall</th><td>{inr(shortfall)}</td><td>Computed</td></tr>
        </tbody>
      </table>
    </div>
    <div className="budget-warning"><div className="warning-icon"><AlertTriangle size={16} /></div><div><strong>{review.title}</strong><p>{review.explanation}</p><div className="shortfall"><ArrowDownRight size={13} />The proposal exceeds forecast headroom by {inr(shortfall)}. You decide.</div></div></div>
    <div className="review-evidence"><strong>Basis</strong><span>Goal event_success@1 · soft policy P1@1 · budget.cap@1 · essential forecast estimate</span><strong>Uncertainty</strong><span>Essential costs are estimated and may change when current vendor quotes arrive.</span></div>
    <div className="review-alternative"><span>Suggested alternative</span><p>{review.alternative}</p></div>
    <div className="review-response">
      <label htmlFor="review-disposition">Record owner response</label>
      <select id="review-disposition" value={disposition} onChange={(event) => { setDisposition(reviewDispositions.find((item) => item === event.target.value) ?? ''); setRecorded(false) }}>
        <option value="">Choose a disposition</option>
        <option value="accepted_recommendation">Accept recommendation</option>
        <option value="accepted_tradeoff">Accept trade-off</option>
        <option value="dismissed">Dismiss advice</option>
        <option value="clarification_requested">Request clarification</option>
      </select>
      {reasonRequired && <textarea value={reason} onChange={(event) => { setReason(event.target.value); setRecorded(false) }} rows={2} placeholder="Record why (required for this response)." aria-label="Reason for owner response" />}
      <button className="button button-outline" onClick={recordResponse} disabled={!disposition || recorded || reasonRequired && !reason.trim()}>{recorded ? 'Response recorded' : 'Record response'}</button>
      {recorded && <span className="review-recorded" role="status">Response recorded in demo history. Advice remains non-authorizing.</span>}
    </div>
    <div className="advisory-stamp"><ShieldCheck size={15} /><strong>ADVISORY ONLY – OWNER DECIDES</strong><span>Reviewer cannot approve or execute actions.</span></div>
  </section>
}
