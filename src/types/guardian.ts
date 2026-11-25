export type PageId = 'goals' | 'decisions' | 'actions' | 'readiness' | 'history'
export type FactVersion = number
export type ActionStatus =
  | 'stale'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'provider_accepted'
  | 'reconfirmation_required'
  | 'confirmed'
  | 'valid'
  | 'claimed'
export type ApprovalState = 'not_required' | 'awaiting_organizer' | 'approved' | 'rejected' | 'invalidated'
export type ObligationStatus = 'pending' | 'awaiting_confirmation' | 'provider_accepted' | 'confirmed' | 'verified'
export type EvidenceKind = 'provider_readback' | 'counterparty_reply' | 'receipt' | 'late_reply'
export type ActivityTone = 'neutral' | 'info' | 'warning' | 'blocked' | 'success'
export type ReviewDisposition = 'accepted_recommendation' | 'accepted_tradeoff' | 'dismissed' | 'clarification_requested'

export interface EventFacts {
  name: string
  date: string
  attendees: number
  budgetCap: number
  venue: string
  version: FactVersion
  previousVenue: string
  previousVersion: FactVersion
}

export interface ActionDependency {
  fact: string
  version: FactVersion
  value: string
  current?: boolean
}

export interface ActionParameters {
  recipient: string
  venue: string
  date: string
  factVersion: FactVersion
  channel: string
}

export interface AgentAction {
  id: string
  backendActionId?: string
  revision?: number
  name: string
  agent: string
  status: ActionStatus
  dependencies: ActionDependency[]
  version: FactVersion
  approvalState: ApprovalState
  reason: string
  parameters?: ActionParameters
}

export interface Approval {
  actionId: string
  state: ApprovalState
  boundVersion: FactVersion
  boundParameters: ActionParameters
  decidedAt?: string
}

export interface Obligation {
  id: string
  name: string
  status: ObligationStatus
  requiredVersion?: FactVersion
  requiredVenue?: string
  mandatoryForReadiness: boolean
  description: string
}

export interface EvidenceRecord {
  id: string
  obligationId: string
  kind: EvidenceKind
  title: string
  detail: string
  factVersion?: FactVersion
  venue?: string
  timestamp: string
  accepted: boolean
}

export interface ActivityRecord {
  id: string
  title: string
  detail: string
  timestamp: string
  tone: ActivityTone
  code?: string
}

export interface ReviewerFinding {
  title: string
  explanation: string
  alternative: string
  totalBudget: number
  committed: number
  essentialForecast: number
  optionalUpgrade: number
}
