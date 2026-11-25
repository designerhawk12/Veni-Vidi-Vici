import { AlertCircle, CheckCircle2, CircleDashed, ShieldAlert, ShieldCheck, Clock3 } from 'lucide-react'
import type { ActionStatus, ObligationStatus } from '../../types/guardian'

type BadgeStatus = ActionStatus | ObligationStatus | 'not_ready' | 'ready' | 'blocked_by_guardian'

const config: Record<BadgeStatus, { label: string; tone: string; icon: typeof CircleDashed }> = {
  stale: { label: 'Stale · blocked', tone: 'red', icon: ShieldAlert },
  awaiting_approval: { label: 'Pending owner approval', tone: 'blue', icon: Clock3 },
  approved: { label: 'Approved · V2', tone: 'green', icon: ShieldCheck },
  rejected: { label: 'Rejected', tone: 'red', icon: AlertCircle },
  provider_accepted: { label: 'Provider-accepted · simulated', tone: 'blue', icon: CheckCircle2 },
  reconfirmation_required: { label: 'Reconfirmation required', tone: 'amber', icon: Clock3 },
  confirmed: { label: 'Confirmed · recorded', tone: 'green', icon: CheckCircle2 },
  valid: { label: 'Unaffected · valid', tone: 'green', icon: ShieldCheck },
  pending: { label: 'Pending', tone: 'slate', icon: CircleDashed },
  awaiting_confirmation: { label: 'Awaiting confirmation', tone: 'amber', icon: Clock3 },
  verified: { label: 'Verified', tone: 'green', icon: CheckCircle2 },
  not_ready: { label: 'Not ready', tone: 'red', icon: AlertCircle },
  ready: { label: 'Recorded arrangements ready', tone: 'green', icon: CheckCircle2 },
  blocked_by_guardian: { label: 'Blocked by Guardian', tone: 'red', icon: ShieldAlert },
}

export default function StatusBadge({ status, label, compact = false }: { status: BadgeStatus; label?: string; compact?: boolean }) {
  const item = config[status]
  const Icon = item.icon
  return <span className={`status-badge tone-${item.tone} ${compact ? 'badge-compact' : ''}`}><Icon size={compact ? 12 : 13} strokeWidth={2.1} />{label ?? item.label}</span>
}
