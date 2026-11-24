import { AlertCircle, CheckCircle2, CircleDashed, ShieldAlert, ShieldCheck, Clock3 } from 'lucide-react'
import type { ActionStatus, ObligationStatus } from '../../types/guardian'

type BadgeStatus = ActionStatus | ObligationStatus | 'not_ready' | 'ready' | 'blocked_by_guardian'

const config: Record<BadgeStatus, { label: string; tone: string; icon: typeof CircleDashed }> = {
  stale: { label: 'STALE / BLOCKED', tone: 'red', icon: ShieldAlert },
  awaiting_approval: { label: 'AWAITING APPROVAL', tone: 'blue', icon: Clock3 },
  approved: { label: 'APPROVED FOR V2', tone: 'green', icon: ShieldCheck },
  rejected: { label: 'REJECTED', tone: 'red', icon: AlertCircle },
  provider_accepted: { label: 'Provider Accepted – Simulated', tone: 'blue', icon: CheckCircle2 },
  reconfirmation_required: { label: 'RECONFIRMATION REQUIRED', tone: 'amber', icon: Clock3 },
  confirmed: { label: 'CONFIRMED · RECORDED', tone: 'green', icon: CheckCircle2 },
  valid: { label: 'UNAFFECTED / VALID', tone: 'green', icon: ShieldCheck },
  pending: { label: 'PENDING', tone: 'slate', icon: CircleDashed },
  awaiting_confirmation: { label: 'AWAITING CONFIRMATION', tone: 'amber', icon: Clock3 },
  verified: { label: 'VERIFIED', tone: 'green', icon: CheckCircle2 },
  not_ready: { label: 'NOT READY', tone: 'red', icon: AlertCircle },
  ready: { label: 'READY · RECORDED', tone: 'green', icon: CheckCircle2 },
  blocked_by_guardian: { label: 'BLOCKED BY GUARDIAN', tone: 'red', icon: ShieldAlert },
}

export default function StatusBadge({ status, label, compact = false }: { status: BadgeStatus; label?: string; compact?: boolean }) {
  const item = config[status]
  const Icon = item.icon
  return <span className={`status-badge tone-${item.tone} ${compact ? 'badge-compact' : ''}`}><Icon size={compact ? 12 : 13} strokeWidth={2.1} />{label ?? item.label}</span>
}
