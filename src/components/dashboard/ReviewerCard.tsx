import { AlertTriangle, ArrowDownRight, Eye, ShieldCheck } from 'lucide-react'
import { reviewerFinding } from '../../data/demoData'

const inr = (value: number) => `₹${new Intl.NumberFormat('en-IN').format(value)}`

export default function ReviewerCard() {
  const review = reviewerFinding
  const headroom = review.totalBudget - review.committed - review.essentialForecast
  const shortfall = Math.max(0, review.optionalUpgrade - headroom)
  return <section className="panel reviewer-panel">
    <div className="reviewer-top"><div className="reviewer-mark"><Eye size={17} /></div><div><div className="reviewer-title">Goal Guardian <span>·</span> Independent Review</div><div className="reviewer-subtitle">Read-only reasoning and opportunity-cost analysis.</div></div><span className="readonly-pill">READ ONLY</span></div>
    <div className="budget-grid">
      <div><span>Total budget</span><strong>{inr(review.totalBudget)}</strong></div>
      <div><span>Committed / reserved</span><strong>{inr(review.committed)}</strong></div>
      <div><span>Essential unreserved forecast</span><strong>{inr(review.essentialForecast)}</strong></div>
      <div><span>Optional stage upgrade</span><strong className="budget-optional">{inr(review.optionalUpgrade)}</strong></div>
    </div>
    <div className="budget-equation"><span>Available headroom</span><strong>{inr(review.totalBudget)} − {inr(review.committed)} − {inr(review.essentialForecast)} = <b>{inr(headroom)}</b></strong></div>
    <div className="budget-warning"><div className="warning-icon"><AlertTriangle size={16} /></div><div><strong>{review.title}</strong><p>{review.explanation}</p><div className="shortfall"><ArrowDownRight size={13} />{inr(review.optionalUpgrade)} upgrade creates a {inr(shortfall)} forecast shortfall</div></div></div>
    <div className="review-alternative"><span>Suggested alternative</span><p>{review.alternative}</p></div>
    <div className="advisory-stamp"><ShieldCheck size={15} /><strong>ADVISORY ONLY – OWNER DECIDES</strong><span>Reviewer cannot approve or execute actions.</span></div>
  </section>
}
