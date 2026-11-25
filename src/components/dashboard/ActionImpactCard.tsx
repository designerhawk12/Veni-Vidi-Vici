import { ArrowUpRight, CheckCircle2, Clock3, MapPin, ShieldAlert } from 'lucide-react'
import type { AgentAction } from '../../types/guardian'
import StatusBadge from './StatusBadge'

const styles = {
  stale: { icon: ShieldAlert, className: 'impact-red' },
  reconfirmation_required: { icon: Clock3, className: 'impact-amber' },
  confirmed: { icon: CheckCircle2, className: 'impact-green' },
  valid: { icon: CheckCircle2, className: 'impact-green' },
}

export default function ActionImpactCard({ action, onOpen }: { action: AgentAction; onOpen?: (action: AgentAction) => void }) {
  const status = action.status === 'confirmed' ? 'confirmed' : action.status === 'provider_accepted' ? 'valid' : action.status === 'stale' ? 'stale' : action.status === 'reconfirmation_required' ? 'reconfirmation_required' : 'valid'
  const style = styles[status]
  const Icon = style.icon
  const description = action.id === 'invitation-old'
    ? 'Depends on the old venue version. A new organizer approval is required.'
    : action.id === 'catering'
      ? action.status === 'confirmed' ? 'Current vendor confirmation is recorded for Venue B / V2.' : 'Vendor confirmation is tied to the previous venue. Awaiting updated confirmation.'
      : 'Does not depend on the venue. No intervention required.'
  return <button className={`impact-card ${style.className}`} onClick={() => onOpen?.(action)}>
    <div className="impact-topline"><span className="impact-icon"><Icon size={16} /></span><span className="impact-arrow"><ArrowUpRight size={14} /></span></div>
    <div className="impact-title">{action.id === 'invitation-old' ? 'Guest Invitation' : action.id === 'catering' ? 'Catering Confirmation' : 'Sponsor Receipt'}</div>
    <StatusBadge status={status} compact />
    <p className="impact-copy">{description}</p>
    <div className="impact-dependency"><MapPin size={12} /><span>{action.id === 'sponsor-receipt' ? 'Venue independent' : action.id === 'catering' ? action.status === 'confirmed' ? 'Confirmed arrangement: Venue B · V2' : 'Previous arrangement: Venue A' : 'Previous address: Venue A'}</span></div>
  </button>
}
